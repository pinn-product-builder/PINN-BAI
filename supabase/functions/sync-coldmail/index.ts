import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CMH_API_KEY = Deno.env.get('CMH_API_KEY');
    const CMH_BASE_URL = Deno.env.get('CMH_BASE_URL');
    if (!CMH_API_KEY || !CMH_BASE_URL) {
      throw new Error('CMH_API_KEY or CMH_BASE_URL not configured');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { org_id, actions } = await req.json();
    if (!org_id) {
      return new Response(JSON.stringify({ error: 'org_id é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const actionsToSync = actions || ['stats', 'campaigns', 'pipeline', 'linkedin-metrics', 'timeline'];
    const headers = { 'X-API-Key': CMH_API_KEY };
    const results: Record<string, unknown> = {};

    for (const action of actionsToSync) {
      try {
        const params = action === 'timeline' ? `?action=${action}&days=30` : `?action=${action}`;
        const resp = await fetch(`${CMH_BASE_URL}${params}`, { headers });
        if (!resp.ok) {
          console.warn(`Action ${action} failed: ${resp.status}`);
          continue;
        }
        const data = await resp.json();
        results[action] = data;

        // Upsert snapshot (delete old + insert new)
        const snapshotType = action.replace('-', '_');
        await supabase
          .from('cmh_sync_snapshots')
          .delete()
          .eq('org_id', org_id)
          .eq('snapshot_type', snapshotType);

        await supabase
          .from('cmh_sync_snapshots')
          .insert({
            org_id,
            snapshot_type: snapshotType,
            data,
            synced_at: new Date().toISOString(),
          });
      } catch (err) {
        console.warn(`Error syncing ${action}:`, err);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      synced: Object.keys(results),
      data: results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('sync-coldmail error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
