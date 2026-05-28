import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PLOOMES_BASE = 'https://api2.ploomes.com';

interface SyncRequest {
  org_id: string;
  endpoints?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { org_id, endpoints }: SyncRequest = await req.json();
    if (!org_id) {
      return new Response(JSON.stringify({ error: 'org_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Tenta credenciais per-tenant primeiro (ideal — cada org com sua chave Ploomes).
    // Cai pro env global PLOOMES_API_KEY como compat com setup antigo.
    const { data: connRows } = await supabase
      .from('crm_auditor_connections')
      .select('credentials')
      .eq('tenant_id', org_id)
      .eq('provider', 'ploomes')
      .limit(1);
    const conn = (connRows ?? [])[0];
    const tenantKey = ((conn?.credentials ?? {}) as { api_key?: string }).api_key;
    const PLOOMES_API_KEY = tenantKey || Deno.env.get('PLOOMES_API_KEY');
    if (!PLOOMES_API_KEY) {
      await supabase
        .from('crm_auditor_connections')
        .update({ sync_status: 'error', sync_error: 'Ploomes: API key não configurada (nem por tenant nem global).' })
        .eq('tenant_id', org_id)
        .eq('provider', 'ploomes');
      return new Response(
        JSON.stringify({ error: 'API key Ploomes não configurada. Adicione em Setup CRM (Ploomes) ou defina PLOOMES_API_KEY como secret.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const ploomesHeaders = {
      'User-Key': PLOOMES_API_KEY,
      'Content-Type': 'application/json',
    };

    const endpointsToSync = endpoints || [
      'deals',
      'deals_stages',
      'deals_pipelines',
      'contacts',
      'tasks',
      'interaction_records',
      'users',
    ];

    const endpointMap: Record<string, { url: string; snapshotType: string }> = {
      deals: {
        url: '/Deals?$top=500&$orderby=CreateDate desc&$expand=Contact,Pipeline,Stage',
        snapshotType: 'deals',
      },
      deals_stages: {
        url: '/Deals@Stages',
        snapshotType: 'deals_stages',
      },
      deals_pipelines: {
        url: '/Deals@Pipelines',
        snapshotType: 'deals_pipelines',
      },
      contacts: {
        url: '/Contacts?$top=200&$orderby=CreateDate desc',
        snapshotType: 'contacts',
      },
      tasks: {
        url: '/Tasks?$top=200&$orderby=CreateDate desc',
        snapshotType: 'tasks',
      },
      interaction_records: {
        url: '/InteractionRecords?$top=200&$orderby=Date desc',
        snapshotType: 'interaction_records',
      },
      users: {
        url: '/Users',
        snapshotType: 'users',
      },
    };

    const results: Record<string, unknown> = {};

    for (const endpoint of endpointsToSync) {
      const config = endpointMap[endpoint];
      if (!config) continue;

      try {
        const resp = await fetch(`${PLOOMES_BASE}${config.url}`, {
          headers: ploomesHeaders,
        });

        if (!resp.ok) {
          const errText = await resp.text();
          console.warn(`Ploomes ${endpoint} failed [${resp.status}]: ${errText.substring(0, 200)}`);
          continue;
        }

        const data = await resp.json();
        const records = data.value || data;
        results[endpoint] = { count: Array.isArray(records) ? records.length : 1, sample: Array.isArray(records) ? records.slice(0, 3) : records };

        // Upsert snapshot
        await supabase
          .from('ploomes_sync_snapshots')
          .delete()
          .eq('org_id', org_id)
          .eq('snapshot_type', config.snapshotType);

        await supabase
          .from('ploomes_sync_snapshots')
          .insert({
            org_id,
            snapshot_type: config.snapshotType,
            data: { value: records },
            synced_at: new Date().toISOString(),
          });
      } catch (err) {
        console.warn(`Error syncing Ploomes ${endpoint}:`, err);
      }
    }

    // Mapeia Ploomes → tabelas crm_* unificadas. Isso permite que a auditoria
    // (/crm-audit) funcione automaticamente para Pinn igual funciona para Kitou.
    const crmStats = await mapPloomesToCrmTables(supabase, org_id, results);

    // Atualiza status da connection Ploomes
    const totalLeads = (crmStats?.leads ?? 0) as number;
    await supabase
      .from('crm_auditor_connections')
      .update({
        sync_status: 'success',
        sync_error: null,
        last_sync_at: new Date().toISOString(),
      })
      .eq('tenant_id', org_id)
      .eq('provider', 'ploomes');

    return new Response(JSON.stringify({
      success: true,
      synced: Object.keys(results),
      summary: results,
      crm_stats: crmStats,
      total_leads: totalLeads,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('sync-ploomes error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ── Mapper Ploomes → tabelas crm_* ─────────────────────────────────────────────
// O auditor CRM (/crm-audit) lê de crm_leads/crm_norm_contacts/crm_stages/
// crm_pipelines/crm_users — mesmo shape do adapter Kommo. Pra que a Pinn
// (que usa Ploomes) tenha auditoria funcionando, espelhamos os dados.
//
// Esquema esperado do Ploomes (OData v2):
//   Pipeline:  { Id, Name, Order }
//   Stage:     { Id, Name, PipelineId, Order, Won, Lost }
//   Deal:      { Id, Title, Amount, ContactId, PipelineId, StageId, OwnerId,
//                CreateDate, LastUpdateDate, StatusId } — Status 1=open, 2=won, 3=lost
//   Contact:   { Id, Name, Email, Phone, CompanyId, Document (CPF/CNPJ) }
//   User:      { Id, Name, Email, Active }

type PloomesEntity = Record<string, unknown>;

interface SyncResults {
  [endpoint: string]: { count: number; sample?: unknown } | undefined;
}

async function mapPloomesToCrmTables(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  tenantId: string,
  results: SyncResults,
): Promise<Record<string, number> | null> {
  try {
    const stats: Record<string, number> = {};
    const syncedAt = new Date().toISOString();

    // Recupera os snapshots crus dessa sync — o sample no `results` só tem 3 itens.
    async function loadSnapshot(snapshotType: string): Promise<PloomesEntity[]> {
      const { data } = await supabase
        .from('ploomes_sync_snapshots')
        .select('data')
        .eq('org_id', tenantId)
        .eq('snapshot_type', snapshotType)
        .maybeSingle();
      const raw = data?.data?.value;
      return Array.isArray(raw) ? (raw as PloomesEntity[]) : [];
    }

    // Pipelines
    if (results.deals_pipelines) {
      const rows = await loadSnapshot('deals_pipelines');
      const mapped = rows.map((p) => ({
        tenant_id: tenantId,
        external_id: String(p.Id ?? ''),
        name: String(p.Name ?? '') .slice(0, 500),
        is_active: true,
        raw: p,
        synced_at: syncedAt,
      })).filter((r) => r.external_id);
      if (mapped.length > 0) {
        await supabase.from('crm_pipelines').upsert(mapped, { onConflict: 'tenant_id,external_id' });
      }
      stats.pipelines = mapped.length;
    }

    // Stages — type "won"/"lost"/"progress" derivado de Won/Lost flags do Ploomes
    if (results.deals_stages) {
      const rows = await loadSnapshot('deals_stages');
      const mapped = rows.map((s) => ({
        tenant_id: tenantId,
        pipeline_external_id: String(s.PipelineId ?? ''),
        external_id: String(s.Id ?? ''),
        name: String(s.Name ?? '').slice(0, 500),
        sort_order: typeof s.Order === 'number' ? s.Order : null,
        stage_type: s.Won ? 'won' : s.Lost ? 'lost' : 'progress',
        raw: s,
        synced_at: syncedAt,
      })).filter((r) => r.external_id && r.pipeline_external_id);
      if (mapped.length > 0) {
        await supabase.from('crm_stages').upsert(mapped, { onConflict: 'tenant_id,pipeline_external_id,external_id' });
      }
      stats.stages = mapped.length;
    }

    // Users
    if (results.users) {
      const rows = await loadSnapshot('users');
      const mapped = rows.map((u) => ({
        tenant_id: tenantId,
        external_id: String(u.Id ?? ''),
        name: String(u.Name ?? '').slice(0, 500),
        email: (u.Email as string | null) ?? null,
        is_active: u.Active !== false,
        raw: u,
        synced_at: syncedAt,
      })).filter((r) => r.external_id);
      if (mapped.length > 0) {
        await supabase.from('crm_users').upsert(mapped, { onConflict: 'tenant_id,external_id' });
      }
      stats.users = mapped.length;
    }

    // Contacts (com person_type derivado do Document — CPF=11 dígitos, CNPJ=14)
    if (results.contacts) {
      const rows = await loadSnapshot('contacts');
      const mapped = rows.map((c) => {
        const doc = String((c.Document ?? c.CPF ?? c.CNPJ ?? '') as string).replace(/\D/g, '');
        const personType = doc.length === 14 ? 'PJ' : doc.length === 11 ? 'PF' : null;
        return {
          tenant_id: tenantId,
          external_id: String(c.Id ?? ''),
          name: String(c.Name ?? '').slice(0, 500),
          email: (c.Email as string | null) ?? null,
          phone: (c.Phone as string | null) ?? null,
          person_type: personType,
          company_external_id: c.CompanyId ? String(c.CompanyId) : null,
          raw: c,
          synced_at: syncedAt,
        };
      }).filter((r) => r.external_id);
      if (mapped.length > 0) {
        await supabase.from('crm_norm_contacts').upsert(mapped, { onConflict: 'tenant_id,external_id' });
      }
      stats.contacts = mapped.length;
    }

    // Deals → crm_leads
    if (results.deals) {
      const rows = await loadSnapshot('deals');
      const mapped = rows.map((d) => {
        const statusId = typeof d.StatusId === 'number' ? d.StatusId : 1;
        const leadStatus = statusId === 2 ? 'won' : statusId === 3 ? 'lost' : 'open';
        const amount = typeof d.Amount === 'number' ? d.Amount : parseFloat(String(d.Amount ?? 0)) || 0;
        return {
          tenant_id: tenantId,
          external_id: String(d.Id ?? ''),
          name: String(d.Title ?? '').slice(0, 500),
          pipeline_external_id: d.PipelineId ? String(d.PipelineId) : null,
          stage_external_id: d.StageId ? String(d.StageId) : null,
          lead_status: leadStatus,
          value: amount,
          currency: null,
          owner_external_id: d.OwnerId ? String(d.OwnerId) : null,
          contact_external_id: d.ContactId ? String(d.ContactId) : null,
          company_external_id: null,
          source: null,
          lost_reason: leadStatus === 'lost' && d.LossReason ? String(d.LossReason) : null,
          created_at: (d.CreateDate as string | null) ?? null,
          closed_at: (d.FinishDate as string | null) ?? null,
          external_updated_at: (d.LastUpdateDate as string | null) ?? null,
          raw: d,
          synced_at: syncedAt,
        };
      }).filter((r) => r.external_id);
      if (mapped.length > 0) {
        await supabase.from('crm_leads').upsert(mapped, { onConflict: 'tenant_id,external_id' });
      }
      stats.leads = mapped.length;
    }

    return stats;
  } catch (err) {
    console.error('[sync-ploomes] mapper crm_* falhou:', err);
    return null;
  }
}
