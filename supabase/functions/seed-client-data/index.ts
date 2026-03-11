import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const internalSupabase = createClient(supabaseUrl, serviceRoleKey);

    const { orgId, action } = await req.json();

    if (!orgId) {
      return new Response(
        JSON.stringify({ error: "orgId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: integration, error: intError } = await internalSupabase
      .from("integrations")
      .select("*")
      .eq("org_id", orgId)
      .eq("type", "supabase")
      .eq("status", "connected")
      .maybeSingle();

    if (intError || !integration) {
      return new Response(
        JSON.stringify({ error: "Integration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = integration.config as { projectUrl?: string; anonKey?: string };
    const externalSupabase = createClient(config.projectUrl!, config.anonKey!);

    // Clear existing
    if (action === "clear" || action === "seed") {
      const { error: delError } = await externalSupabase
        .from("kommo_leads")
        .delete()
        .neq("lead_id", -99999);

      if (delError) {
        return new Response(
          JSON.stringify({ error: `Cannot delete: ${delError.message}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (action === "clear") {
        return new Response(
          JSON.stringify({ success: true, message: "Table cleared" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Generate realistic BF Company leads data (30 days)
    const leads: any[] = [];
    const now = new Date();
    let leadCounter = 9000001;

    for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
      const date = new Date(now);
      date.setDate(date.getDate() - dayOffset);
      const dateStr = date.toISOString().split("T")[0];

      // 4-10 leads per day (realistic for BF Company)
      const dailyLeads = Math.floor(Math.random() * 7) + 4;

      for (let j = 0; j < dailyLeads; j++) {
        const rand = Math.random();
        const hour = 8 + Math.floor(Math.random() * 12);
        const min = Math.floor(Math.random() * 60);
        const sec = Math.floor(Math.random() * 60);
        const createdIso = `${dateStr}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}Z`;
        const createdTs = Math.floor(new Date(createdIso).getTime() / 1000);

        // Realistic funnel progression with proper drop-off rates
        const encaminhado = true;
        const desqualificado = rand < 0.12;
        const disparo_feito = !desqualificado && rand >= 0.12;
        const atendimento_feito = disparo_feito && rand >= 0.25;
        const nao_confirmou = atendimento_feito && rand >= 0.45 && rand < 0.55;
        const reuniao_confirmada = atendimento_feito && rand >= 0.55;
        const faltou_reuniao = reuniao_confirmada && rand >= 0.55 && rand < 0.65;
        const reuniao_realizada = reuniao_confirmada && rand >= 0.65;
        const venda = reuniao_realizada && rand >= 0.85;

        // Hermes stages mirror main stages
        const hermes_entrada = true;
        const hermes_encaminhado = encaminhado;
        const hermes_atendimento_finalizado = atendimento_feito;
        const hermes_nao_confirmou = nao_confirmou;
        const hermes_reuniao_confirmada = reuniao_confirmada;
        const hermes_faltou_reuniao = faltou_reuniao;
        const hermes_reuniao_feita = reuniao_realizada;
        const hermes_venda_ganha = venda;
        const hermes_lead_perdido = desqualificado;

        // Agendamento for confirmed meetings
        let agendamento_iso = null;
        let agendamento_ts = null;
        if (reuniao_confirmada) {
          const agendDate = new Date(date);
          agendDate.setDate(agendDate.getDate() + Math.floor(Math.random() * 5) + 1);
          agendamento_iso = agendDate.toISOString();
          agendamento_ts = Math.floor(agendDate.getTime() / 1000);
        }

        // Won/lost dates
        let won_at_iso = null;
        let won_at_ts = null;
        let lost_at_iso = null;
        let lost_at_ts = null;
        let closed_at_iso = null;
        let closed_at_ts = 0;

        if (venda) {
          const wonDate = new Date(date);
          wonDate.setDate(wonDate.getDate() + Math.floor(Math.random() * 10) + 3);
          won_at_iso = wonDate.toISOString();
          won_at_ts = Math.floor(wonDate.getTime() / 1000);
          closed_at_iso = won_at_iso;
          closed_at_ts = won_at_ts;
        } else if (desqualificado) {
          const lostDate = new Date(date);
          lostDate.setDate(lostDate.getDate() + Math.floor(Math.random() * 3) + 1);
          lost_at_iso = lostDate.toISOString();
          lost_at_ts = Math.floor(lostDate.getTime() / 1000);
          closed_at_iso = lost_at_iso;
          closed_at_ts = lost_at_ts;
        }

        // Status ID (Kommo CRM pipeline status)
        let status_id = 101134931; // Default: incoming
        if (venda) status_id = 142;
        else if (reuniao_realizada) status_id = 101134935;
        else if (reuniao_confirmada) status_id = 101134934;
        else if (atendimento_feito) status_id = 101134933;
        else if (encaminhado) status_id = 101134932;
        else if (desqualificado) status_id = 143;

        const updatedDate = new Date(date);
        updatedDate.setHours(updatedDate.getHours() + Math.floor(Math.random() * 48));

        leads.push({
          lead_id: leadCounter++,
          pipeline_id: 13115747,
          status_id,
          created_at_ts: createdTs,
          created_at_iso: createdIso,
          updated_at_ts: Math.floor(updatedDate.getTime() / 1000),
          updated_at_iso: updatedDate.toISOString(),
          closed_at_ts,
          closed_at_iso,
          won_at_ts,
          won_at_iso,
          lost_at_ts,
          lost_at_iso,
          agendamento_ts,
          agendamento_iso,
          encaminhado,
          atendimento_feito,
          reuniao_confirmada,
          reuniao_realizada,
          nao_confirmou,
          faltou_reuniao,
          venda,
          desqualificado,
          hermes_entrada,
          disparo_feito,
          hermes_encaminhado,
          hermes_atendimento_finalizado,
          hermes_nao_confirmou,
          hermes_reuniao_confirmada,
          hermes_faltou_reuniao,
          hermes_reuniao_feita,
          hermes_venda_ganha,
          hermes_lead_perdido,
          synced_at_iso: now.toISOString(),
        });
      }
    }

    // Insert in batches
    const batchSize = 50;
    let inserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      const { error: insertError } = await externalSupabase
        .from("kommo_leads")
        .insert(batch);

      if (insertError) {
        errors.push(`Batch ${i}: ${insertError.message}`);
      } else {
        inserted += batch.length;
      }
    }

    const summary = {
      total: leads.length,
      encaminhados: leads.filter(l => l.encaminhado).length,
      disparo_feito: leads.filter(l => l.disparo_feito).length,
      atendimento_feito: leads.filter(l => l.atendimento_feito).length,
      reuniao_confirmada: leads.filter(l => l.reuniao_confirmada).length,
      reuniao_realizada: leads.filter(l => l.reuniao_realizada).length,
      vendas: leads.filter(l => l.venda).length,
      desqualificados: leads.filter(l => l.desqualificado).length,
      nao_confirmou: leads.filter(l => l.nao_confirmou).length,
      faltou_reuniao: leads.filter(l => l.faltou_reuniao).length,
    };

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        message: `Inserted ${inserted} leads across 30 days`,
        inserted,
        errors: errors.length > 0 ? errors : undefined,
        summary,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
