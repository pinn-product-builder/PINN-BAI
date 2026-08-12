import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Sync Omie ERP → tabelas crm_* unificadas.
 *
 * Credenciais (per-tenant) em `crm_auditor_connections.credentials`:
 *   { app_key: string, app_secret: string }
 *
 * Endpoints Omie:
 *   - Clientes: POST https://app.omie.com.br/api/v1/geral/clientes/
 *     call=ListarClientes, param=[{pagina, registros_por_pagina, apenas_importado_api}]
 *   - Pedidos:  POST https://app.omie.com.br/api/v1/produtos/pedido/
 *     call=ListarPedidos
 *
 * Para piloto, sincronizamos só Clientes → crm_norm_contacts (com CNPJ/CPF
 * detectado). Pedidos viram TODO — ainda não há mapeamento 1:1 com lead/deal.
 */

interface SyncRequest {
  org_id: string;
}

interface OmieClient {
  codigo_cliente_omie?: number;
  nome_fantasia?: string;
  razao_social?: string;
  cnpj_cpf?: string;
  email?: string;
  telefone1_ddd?: string;
  telefone1_numero?: string;
  cidade?: string;
  estado?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { org_id }: SyncRequest = await req.json();
    if (!org_id) {
      return new Response(JSON.stringify({ error: "org_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SEM requireOrgAccess: pg_cron (sync_all_crm_connections) chama sem
    // Authorization — ver comentário em sync-kommo/index.ts.

    // Lê credenciais per-tenant
    const { data: connRows } = await supabase
      .from("crm_auditor_connections")
      .select("id, credentials")
      .eq("tenant_id", org_id)
      .eq("provider", "omie")
      .limit(1);
    const conn = (connRows ?? [])[0];
    const creds = (conn?.credentials ?? {}) as { app_key?: string; app_secret?: string };
    if (!creds.app_key || !creds.app_secret) {
      await supabase
        .from("crm_auditor_connections")
        .update({ sync_status: "error", sync_error: "Omie: credenciais ausentes (app_key/app_secret)." })
        .eq("tenant_id", org_id)
        .eq("provider", "omie");
      return new Response(JSON.stringify({ error: "Credenciais Omie ausentes" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Paginação Omie: ListarClientes retorna { pagina, total_de_paginas, clientes_cadastro: [...] }
    const allClients: OmieClient[] = [];
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages && page <= 50 /* safety cap */) {
      const resp = await fetch("https://app.omie.com.br/api/v1/geral/clientes/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call: "ListarClientes",
          app_key: creds.app_key,
          app_secret: creds.app_secret,
          param: [{ pagina: page, registros_por_pagina: 500, apenas_importado_api: "N" }],
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        await supabase
          .from("crm_auditor_connections")
          .update({ sync_status: "error", sync_error: `Omie ListarClientes ${resp.status}: ${txt.slice(0, 200)}` })
          .eq("tenant_id", org_id)
          .eq("provider", "omie");
        return new Response(JSON.stringify({ error: `Omie respondeu ${resp.status}`, body: txt.slice(0, 500) }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await resp.json();
      const list: OmieClient[] = Array.isArray(data?.clientes_cadastro) ? data.clientes_cadastro : [];
      allClients.push(...list);
      totalPages = Number(data?.total_de_paginas ?? 1);
      page += 1;
    }

    // Mapeia Cliente Omie → crm_norm_contacts (com person_type derivado de CNPJ/CPF).
    const syncedAt = new Date().toISOString();
    const contactRows = allClients.map((c) => {
      const doc = String(c.cnpj_cpf ?? "").replace(/\D/g, "");
      const personType = doc.length === 14 ? "PJ" : doc.length === 11 ? "PF" : null;
      const phone = [c.telefone1_ddd, c.telefone1_numero].filter(Boolean).join(" ");
      return {
        tenant_id: org_id,
        external_id: String(c.codigo_cliente_omie ?? ""),
        name: (c.nome_fantasia || c.razao_social || "").slice(0, 500),
        email: c.email || null,
        phone: phone || null,
        person_type: personType,
        company_external_id: null,
        raw: c,
        synced_at: syncedAt,
      };
    }).filter((r) => r.external_id);

    if (contactRows.length > 0) {
      await supabase
        .from("crm_norm_contacts")
        .upsert(contactRows, { onConflict: "tenant_id,external_id" });
    }

    await supabase
      .from("crm_auditor_connections")
      .update({
        sync_status: "success",
        sync_error: null,
        last_sync_at: syncedAt,
      })
      .eq("tenant_id", org_id)
      .eq("provider", "omie");

    return new Response(JSON.stringify({
      success: true,
      synced: { clients: contactRows.length, pages: page - 1 },
      note: "Pedidos Omie ainda não importados (mapeamento pedido → lead pendente).",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("sync-omie error:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
