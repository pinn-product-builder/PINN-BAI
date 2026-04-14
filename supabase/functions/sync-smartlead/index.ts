import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SMARTLEAD_BASE = 'https://server.smartlead.ai/api/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const API_KEY = Deno.env.get('SMARTLEAD_API_KEY');
    if (!API_KEY) throw new Error('SMARTLEAD_API_KEY not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { org_id } = await req.json();
    if (!org_id) {
      return new Response(JSON.stringify({ error: 'org_id é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: Record<string, unknown> = {};

    // 1. Fetch all campaigns
    const campaignsResp = await fetch(`${SMARTLEAD_BASE}/campaigns?api_key=${API_KEY}`);
    if (!campaignsResp.ok) {
      const errText = await campaignsResp.text();
      throw new Error(`Failed to fetch campaigns [${campaignsResp.status}]: ${errText}`);
    }
    const campaigns = await campaignsResp.json();
    results.campaigns = campaigns;

    // Save campaigns snapshot
    await upsertSnapshot(supabase, org_id, 'campaigns', campaigns);

    // 2. Fetch analytics for each campaign (limit to 20 most recent)
    const campaignList = Array.isArray(campaigns) ? campaigns : (campaigns?.data || []);
    const recentCampaigns = campaignList.slice(0, 20);

    const allAnalytics: any[] = [];
    const allLeadStats: any[] = [];

    for (const campaign of recentCampaigns) {
      const campaignId = campaign.id;
      if (!campaignId) continue;

      try {
        // Analytics
        const analyticsResp = await fetch(
          `${SMARTLEAD_BASE}/campaigns/${campaignId}/analytics?api_key=${API_KEY}`
        );
        if (analyticsResp.ok) {
          const analytics = await analyticsResp.json();
          allAnalytics.push({ campaign_id: campaignId, campaign_name: campaign.name, ...analytics });
        } else {
          await analyticsResp.text();
        }

        // Lead statistics (first page)
        const leadsResp = await fetch(
          `${SMARTLEAD_BASE}/campaigns/${campaignId}/leads-statistics?api_key=${API_KEY}&limit=100&offset=0`
        );
        if (leadsResp.ok) {
          const leadStats = await leadsResp.json();
          allLeadStats.push({ campaign_id: campaignId, campaign_name: campaign.name, leads: leadStats });
        } else {
          await leadsResp.text();
        }
      } catch (err) {
        console.warn(`Error fetching campaign ${campaignId} details:`, err);
      }
    }

    results.analytics = allAnalytics;
    results.lead_stats = allLeadStats;

    await upsertSnapshot(supabase, org_id, 'analytics', allAnalytics);
    await upsertSnapshot(supabase, org_id, 'lead_stats', allLeadStats);

    // 3. Compute aggregated stats
    const totalCampaigns = campaignList.length;
    let totalSent = 0, totalOpened = 0, totalClicked = 0, totalReplied = 0, totalBounced = 0, totalLeads = 0;

    for (const a of allAnalytics) {
      totalSent += a.sent_count || a.total_emails_sent || 0;
      totalOpened += a.open_count || a.unique_opened || 0;
      totalClicked += a.click_count || a.unique_clicked || 0;
      totalReplied += a.reply_count || a.unique_replied || 0;
      totalBounced += a.bounce_count || a.bounced || 0;
    }

    for (const ls of allLeadStats) {
      const leads = Array.isArray(ls.leads) ? ls.leads : (ls.leads?.data || []);
      totalLeads += leads.length;
    }

    const aggregated = {
      total_campaigns: totalCampaigns,
      total_leads: totalLeads,
      total_sent: totalSent,
      total_opened: totalOpened,
      total_clicked: totalClicked,
      total_replied: totalReplied,
      total_bounced: totalBounced,
      open_rate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100 * 10) / 10 : 0,
      click_rate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 100 * 10) / 10 : 0,
      reply_rate: totalSent > 0 ? Math.round((totalReplied / totalSent) * 100 * 10) / 10 : 0,
      bounce_rate: totalSent > 0 ? Math.round((totalBounced / totalSent) * 100 * 10) / 10 : 0,
    };

    results.aggregated = aggregated;
    await upsertSnapshot(supabase, org_id, 'aggregated', aggregated);

    return new Response(JSON.stringify({
      success: true,
      synced: Object.keys(results),
      data: results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('sync-smartlead error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function upsertSnapshot(supabase: any, orgId: string, snapshotType: string, data: unknown) {
  await supabase
    .from('smartlead_sync_snapshots')
    .delete()
    .eq('org_id', orgId)
    .eq('snapshot_type', snapshotType);

  await supabase
    .from('smartlead_sync_snapshots')
    .insert({
      org_id: orgId,
      snapshot_type: snapshotType,
      data,
      synced_at: new Date().toISOString(),
    });
}
