// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

// ─── Meta Ads ────────────────────────────────────────────────────────────────
async function syncMetaAds(creds: Record<string, string>, daysBack: number) {
  const accessToken = creds.access_token;
  const adAccountId = (creds.ad_account_id || '').replace(/^act_/, '');
  if (!accessToken || !adAccountId) {
    throw new Error('Meta Ads requer access_token e ad_account_id.');
  }

  const base = `https://graph.facebook.com/v20.0`;
  const since = daysAgoISO(daysBack);
  const until = todayISO();

  // Campaigns
  const campRes = await fetch(
    `${base}/act_${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time&limit=200&access_token=${accessToken}`,
  );
  if (!campRes.ok) throw new Error(`Meta Ads campaigns: ${campRes.status} ${await campRes.text()}`);
  const campaigns = (await campRes.json()).data ?? [];

  // Insights (daily)
  const insightsRes = await fetch(
    `${base}/act_${adAccountId}/insights?level=campaign&fields=campaign_id,impressions,clicks,spend,reach,actions,action_values&time_increment=1&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&limit=500&access_token=${accessToken}`,
  );
  if (!insightsRes.ok) throw new Error(`Meta Ads insights: ${insightsRes.status} ${await insightsRes.text()}`);
  const insights = (await insightsRes.json()).data ?? [];

  return {
    campaigns: campaigns.map((c: any) => ({
      external_id: String(c.id),
      account_id: adAccountId,
      name: c.name ?? '',
      status: c.status ?? 'UNKNOWN',
      objective: c.objective ?? null,
      daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
      lifetime_budget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
      start_date: c.start_time ? c.start_time.slice(0, 10) : null,
      end_date: c.stop_time ? c.stop_time.slice(0, 10) : null,
      raw: c,
    })),
    metrics: insights.map((i: any) => {
      const actions = (i.actions ?? []) as Array<{ action_type: string; value: string }>;
      const values = (i.action_values ?? []) as Array<{ action_type: string; value: string }>;
      const leadAction = actions.find((a) =>
        ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'].includes(a.action_type),
      );
      const purchaseAction = actions.find((a) =>
        ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'].includes(a.action_type),
      );
      const purchaseValue = values.find((v) =>
        ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'].includes(v.action_type),
      );
      return {
        campaign_id: String(i.campaign_id),
        adset_id: '',
        date: i.date_start,
        impressions: Number(i.impressions ?? 0),
        clicks: Number(i.clicks ?? 0),
        spend: Number(i.spend ?? 0),
        reach: i.reach ? Number(i.reach) : null,
        leads: leadAction ? Number(leadAction.value) : 0,
        purchases: purchaseAction ? Number(purchaseAction.value) : 0,
        purchase_value: purchaseValue ? Number(purchaseValue.value) : 0,
        raw: i,
      };
    }),
  };
}

// ─── Google Ads ──────────────────────────────────────────────────────────────
async function getGoogleAccessToken(creds: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: creds.refresh_token,
      client_id: creds.client_id,
      client_secret: creds.client_secret,
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token as string;
}

async function googleAdsQuery(creds: Record<string, string>, customerId: string, gaql: string) {
  const token = await getGoogleAccessToken(creds);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'developer-token': creds.developer_token,
    'Content-Type': 'application/json',
  };
  if (creds.login_customer_id) headers['login-customer-id'] = creds.login_customer_id.replace(/-/g, '');

  const res = await fetch(
    `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`,
    { method: 'POST', headers, body: JSON.stringify({ query: gaql, pageSize: 1000 }) },
  );
  if (!res.ok) throw new Error(`Google Ads: ${res.status} ${await res.text()}`);
  return (await res.json()).results ?? [];
}

async function syncGoogleAds(creds: Record<string, string>, daysBack: number) {
  if (!creds.developer_token || !creds.customer_id || !creds.refresh_token || !creds.client_id || !creds.client_secret) {
    throw new Error('Google Ads requer developer_token, customer_id, refresh_token, client_id e client_secret.');
  }
  const customerId = creds.customer_id.replace(/-/g, '');
  const since = daysAgoISO(daysBack);
  const until = todayISO();

  const campaignRows = await googleAdsQuery(creds, customerId, `
    SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
           campaign.start_date, campaign.end_date
    FROM campaign WHERE campaign.status != 'REMOVED'
  `);

  const metricRows = await googleAdsQuery(creds, customerId, `
    SELECT campaign.id, segments.date,
           metrics.impressions, metrics.clicks, metrics.cost_micros,
           metrics.conversions, metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${since}' AND '${until}'
      AND campaign.status != 'REMOVED'
  `);

  return {
    campaigns: campaignRows.map((row: any) => {
      const c = row.campaign ?? {};
      return {
        external_id: String(c.id ?? ''),
        account_id: customerId,
        name: c.name ?? '',
        status: c.status ?? 'UNKNOWN',
        objective: c.advertisingChannelType ?? null,
        daily_budget: null,
        lifetime_budget: null,
        start_date: c.startDate && c.startDate !== '2037-12-30' ? c.startDate : null,
        end_date: c.endDate && c.endDate !== '2037-12-30' ? c.endDate : null,
        raw: c,
      };
    }),
    metrics: metricRows.map((row: any) => {
      const m = row.metrics ?? {};
      const c = row.campaign ?? {};
      const seg = row.segments ?? {};
      const conversions = Math.round(Number(m.conversions ?? 0));
      return {
        campaign_id: String(c.id ?? ''),
        adset_id: '',
        date: seg.date,
        impressions: Number(m.impressions ?? 0),
        clicks: Number(m.clicks ?? 0),
        spend: Number(m.costMicros ?? 0) / 1_000_000,
        reach: null,
        leads: conversions,
        purchases: conversions,
        purchase_value: Number(m.conversionsValue ?? 0),
        raw: row,
      };
    }),
  };
}

// ─── Main handler ────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const orgId: string = body.orgId;
    const platformSlug: string = body.platformSlug;
    const daysBack: number = Number(body.daysBack ?? 30);

    if (!orgId || !platformSlug) return json({ error: 'orgId e platformSlug são obrigatórios.' }, 400);
    if (!['meta_ads', 'google_ads'].includes(platformSlug)) {
      return json({ error: `Plataforma não suportada: ${platformSlug}` }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: connection, error: connErr } = await admin
      .from('paid_traffic_connections')
      .select('credentials')
      .eq('org_id', orgId)
      .eq('platform_slug', platformSlug)
      .maybeSingle();

    if (connErr || !connection) return json({ error: 'Conexão não encontrada. Conecte o provider primeiro.' }, 404);

    const creds = (connection.credentials ?? {}) as Record<string, string>;
    const syncedAt = new Date().toISOString();

    await admin
      .from('paid_traffic_connections')
      .update({ sync_status: 'syncing', sync_error: null, updated_at: syncedAt })
      .eq('org_id', orgId)
      .eq('platform_slug', platformSlug);

    try {
      const { campaigns, metrics } =
        platformSlug === 'meta_ads'
          ? await syncMetaAds(creds, daysBack)
          : await syncGoogleAds(creds, daysBack);

      if (campaigns.length) {
        await admin.from('paid_traffic_campaigns').upsert(
          campaigns.map((c) => ({ org_id: orgId, platform_slug: platformSlug, synced_at: syncedAt, ...c })),
          { onConflict: 'org_id,platform_slug,external_id' },
        );
      }

      if (metrics.length) {
        await admin.from('paid_traffic_daily_metrics').upsert(
          metrics.map((m) => ({ org_id: orgId, platform_slug: platformSlug, synced_at: syncedAt, ...m })),
          { onConflict: 'org_id,platform_slug,campaign_id,adset_id,date' },
        );
      }

      await admin
        .from('paid_traffic_connections')
        .update({ sync_status: 'success', last_sync_at: syncedAt, sync_error: null, updated_at: syncedAt })
        .eq('org_id', orgId)
        .eq('platform_slug', platformSlug);

      return json({ ok: true, counts: { campaigns: campaigns.length, metrics: metrics.length } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin
        .from('paid_traffic_connections')
        .update({ sync_status: 'error', sync_error: msg, updated_at: syncedAt })
        .eq('org_id', orgId)
        .eq('platform_slug', platformSlug);
      return json({ error: msg }, 500);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
