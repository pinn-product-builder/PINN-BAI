import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const PLOOMES_API_KEY = Deno.env.get('PLOOMES_API_KEY');
    if (!PLOOMES_API_KEY) {
      throw new Error('PLOOMES_API_KEY not configured');
    }

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
        url: '/Deals?$top=200&$orderby=CreateDate desc&$expand=Contact,Pipeline,Stage',
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

    return new Response(JSON.stringify({
      success: true,
      synced: Object.keys(results),
      summary: results,
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
