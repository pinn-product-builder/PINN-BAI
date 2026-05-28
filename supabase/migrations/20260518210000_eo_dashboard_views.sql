-- ──────────────────────────────────────────────────────────────────────────
-- Email Outreach: views agregadas pro dashboard "Pinn Smart" (Pinn SDR)
-- ──────────────────────────────────────────────────────────────────────────
-- Contexto:
-- Substitui a fonte da aba "Pinn Smart" (que lia de smartlead_sync_snapshots)
-- por agregações em tempo real das tabelas eo_*. Sem precisar de sync job.
--
-- Views criadas:
--   eo_v_org_metrics       — KPIs por org (1 row por org)
--   eo_v_campaign_metrics  — KPIs por campanha (1 row por campaign)
--   eo_v_inbox_metrics     — Capacidade e reputação por inbox
--   eo_v_step_metrics      — Performance por step/variant (pra A/B test)
--   eo_v_daily_timeline    — Sends/Opens/Replies por dia, últimos 30 dias
-- ──────────────────────────────────────────────────────────────────────────

-- ── eo_v_org_metrics ──────────────────────────────────────────────────────
drop view if exists public.eo_v_org_metrics cascade;
create view public.eo_v_org_metrics as
with sends as (
  select
    org_id,
    count(*)                                                     as total_messages,
    count(*) filter (where status = 'sent')                      as total_sent,
    count(*) filter (where status = 'queued')                    as total_queued,
    count(*) filter (where status = 'failed')                    as total_failed
  from public.eo_messages
  group by org_id
),
ev as (
  select
    m.org_id,
    count(*) filter (where e.event_type = 'open')                as total_opens,
    count(distinct case when e.event_type = 'open' then e.message_id end)
                                                                 as unique_opens,
    count(*) filter (where e.event_type = 'click')               as total_clicks,
    count(distinct case when e.event_type = 'click' then e.message_id end)
                                                                 as unique_clicks,
    count(*) filter (where e.event_type = 'reply')               as total_replies,
    count(*) filter (where e.event_type = 'bounce')              as total_bounces,
    count(*) filter (where e.event_type = 'unsubscribe')         as total_unsubs,
    count(*) filter (where e.event_type = 'complaint')           as total_complaints
  from public.eo_message_events e
  join public.eo_messages m on m.id = e.message_id
  group by m.org_id
),
camps as (
  select
    org_id,
    count(*)                                                     as total_campaigns,
    count(*) filter (where status = 'active')                    as active_campaigns,
    count(*) filter (where status = 'completed')                 as completed_campaigns,
    count(*) filter (where status = 'paused')                    as paused_campaigns,
    count(*) filter (where status = 'draft')                     as draft_campaigns
  from public.eo_campaigns
  group by org_id
),
lds as (
  select
    org_id,
    count(*)                                                     as total_leads,
    count(*) filter (where status = 'active')                    as active_leads,
    count(*) filter (where status = 'bounced')                   as bounced_leads,
    count(*) filter (where status = 'unsubscribed')              as unsub_leads
  from public.eo_leads
  group by org_id
),
clds as (
  select
    cmp.org_id,
    count(*)                                                     as total_enrollments,
    count(*) filter (where cl.status = 'enrolled')               as enrolled_active,
    count(*) filter (where cl.status = 'replied')                as enrolled_replied,
    count(*) filter (where cl.status = 'finished')               as enrolled_finished,
    count(*) filter (where cl.status = 'paused')                 as enrolled_paused,
    count(*) filter (where cl.status = 'bounced')                as enrolled_bounced
  from public.eo_campaign_leads cl
  join public.eo_campaigns cmp on cmp.id = cl.campaign_id
  group by cmp.org_id
)
select
  coalesce(camps.org_id, lds.org_id, sends.org_id, ev.org_id, clds.org_id) as org_id,

  -- Campanhas
  coalesce(camps.total_campaigns, 0)     as total_campaigns,
  coalesce(camps.active_campaigns, 0)    as active_campaigns,
  coalesce(camps.completed_campaigns, 0) as completed_campaigns,
  coalesce(camps.paused_campaigns, 0)    as paused_campaigns,
  coalesce(camps.draft_campaigns, 0)     as draft_campaigns,

  -- Leads
  coalesce(lds.total_leads, 0)           as total_leads,
  coalesce(lds.active_leads, 0)          as active_leads,
  coalesce(lds.bounced_leads, 0)         as bounced_leads,
  coalesce(lds.unsub_leads, 0)           as unsub_leads,

  -- Enrollments (leads dentro de campanhas)
  coalesce(clds.total_enrollments, 0)    as total_enrollments,
  coalesce(clds.enrolled_active, 0)      as enrolled_active,
  coalesce(clds.enrolled_replied, 0)     as enrolled_replied,
  coalesce(clds.enrolled_finished, 0)    as enrolled_finished,
  coalesce(clds.enrolled_paused, 0)      as enrolled_paused,
  coalesce(clds.enrolled_bounced, 0)     as enrolled_bounced,

  -- Envios
  coalesce(sends.total_messages, 0)      as total_messages,
  coalesce(sends.total_sent, 0)          as total_sent,
  coalesce(sends.total_queued, 0)        as total_queued,
  coalesce(sends.total_failed, 0)        as total_failed,

  -- Eventos
  coalesce(ev.total_opens, 0)            as total_opens,
  coalesce(ev.unique_opens, 0)           as unique_opens,
  coalesce(ev.total_clicks, 0)           as total_clicks,
  coalesce(ev.unique_clicks, 0)          as unique_clicks,
  coalesce(ev.total_replies, 0)          as total_replies,
  coalesce(ev.total_bounces, 0)          as total_bounces,
  coalesce(ev.total_unsubs, 0)           as total_unsubs,
  coalesce(ev.total_complaints, 0)       as total_complaints,

  -- Taxas (%) — protege div by zero
  case when coalesce(sends.total_sent, 0) > 0
       then round(100.0 * coalesce(ev.unique_opens, 0) / sends.total_sent, 1)
       else 0 end                        as open_rate,
  case when coalesce(sends.total_sent, 0) > 0
       then round(100.0 * coalesce(ev.unique_clicks, 0) / sends.total_sent, 1)
       else 0 end                        as click_rate,
  case when coalesce(sends.total_sent, 0) > 0
       then round(100.0 * coalesce(ev.total_replies, 0) / sends.total_sent, 1)
       else 0 end                        as reply_rate,
  case when coalesce(sends.total_sent, 0) > 0
       then round(100.0 * coalesce(ev.total_bounces, 0) / sends.total_sent, 1)
       else 0 end                        as bounce_rate,
  case when coalesce(sends.total_sent, 0) > 0
       then round(100.0 * coalesce(ev.total_unsubs, 0) / sends.total_sent, 1)
       else 0 end                        as unsub_rate
from camps
full outer join lds   on lds.org_id    = camps.org_id
full outer join sends on sends.org_id  = coalesce(camps.org_id, lds.org_id)
full outer join ev    on ev.org_id     = coalesce(camps.org_id, lds.org_id, sends.org_id)
full outer join clds  on clds.org_id   = coalesce(camps.org_id, lds.org_id, sends.org_id, ev.org_id);

comment on view public.eo_v_org_metrics is
  'KPIs agregados por organização. Substitui smartlead_sync_snapshots.aggregated no PinnSDR dashboard.';

-- ── eo_v_campaign_metrics ─────────────────────────────────────────────────
drop view if exists public.eo_v_campaign_metrics cascade;
create view public.eo_v_campaign_metrics as
with sends as (
  select
    cl.campaign_id,
    count(*)                                                     as total_messages,
    count(*) filter (where m.status = 'sent')                    as total_sent,
    count(*) filter (where m.status = 'queued')                  as total_queued,
    count(*) filter (where m.status = 'failed')                  as total_failed,
    max(m.sent_at)                                               as last_sent_at
  from public.eo_messages m
  join public.eo_campaign_leads cl on cl.id = m.campaign_lead_id
  group by cl.campaign_id
),
ev as (
  select
    cl.campaign_id,
    count(*) filter (where e.event_type = 'open')                as total_opens,
    count(distinct case when e.event_type = 'open' then e.message_id end)
                                                                 as unique_opens,
    count(*) filter (where e.event_type = 'click')               as total_clicks,
    count(*) filter (where e.event_type = 'reply')               as total_replies,
    count(*) filter (where e.event_type = 'bounce')              as total_bounces,
    count(*) filter (where e.event_type = 'unsubscribe')         as total_unsubs
  from public.eo_message_events e
  join public.eo_messages m on m.id = e.message_id
  join public.eo_campaign_leads cl on cl.id = m.campaign_lead_id
  group by cl.campaign_id
),
clds as (
  select
    campaign_id,
    count(*)                                                     as total_leads,
    count(*) filter (where status = 'enrolled')                  as leads_active,
    count(*) filter (where status = 'replied')                   as leads_replied,
    count(*) filter (where status = 'finished')                  as leads_finished,
    count(*) filter (where status = 'bounced')                   as leads_bounced,
    count(*) filter (where status = 'paused')                    as leads_paused
  from public.eo_campaign_leads
  group by campaign_id
)
select
  c.id                                   as campaign_id,
  c.org_id,
  c.name,
  c.description,
  c.status,
  c.activated_at,
  c.created_at,

  -- Leads
  coalesce(clds.total_leads, 0)          as total_leads,
  coalesce(clds.leads_active, 0)         as leads_active,
  coalesce(clds.leads_replied, 0)        as leads_replied,
  coalesce(clds.leads_finished, 0)       as leads_finished,
  coalesce(clds.leads_bounced, 0)        as leads_bounced,
  coalesce(clds.leads_paused, 0)         as leads_paused,

  -- Envios
  coalesce(sends.total_messages, 0)      as total_messages,
  coalesce(sends.total_sent, 0)          as total_sent,
  coalesce(sends.total_queued, 0)        as total_queued,
  coalesce(sends.total_failed, 0)        as total_failed,
  sends.last_sent_at,

  -- Eventos
  coalesce(ev.total_opens, 0)            as total_opens,
  coalesce(ev.unique_opens, 0)           as unique_opens,
  coalesce(ev.total_clicks, 0)           as total_clicks,
  coalesce(ev.total_replies, 0)          as total_replies,
  coalesce(ev.total_bounces, 0)          as total_bounces,
  coalesce(ev.total_unsubs, 0)           as total_unsubs,

  -- Taxas
  case when coalesce(sends.total_sent, 0) > 0
       then round(100.0 * coalesce(ev.unique_opens, 0) / sends.total_sent, 1)
       else 0 end                        as open_rate,
  case when coalesce(sends.total_sent, 0) > 0
       then round(100.0 * coalesce(ev.total_replies, 0) / sends.total_sent, 1)
       else 0 end                        as reply_rate,
  case when coalesce(sends.total_sent, 0) > 0
       then round(100.0 * coalesce(ev.total_bounces, 0) / sends.total_sent, 1)
       else 0 end                        as bounce_rate
from public.eo_campaigns c
left join sends on sends.campaign_id = c.id
left join ev    on ev.campaign_id    = c.id
left join clds  on clds.campaign_id  = c.id;

comment on view public.eo_v_campaign_metrics is
  'KPIs por campanha. Substitui smartlead_sync_snapshots.campaigns/analytics no PinnSDR dashboard.';

-- ── eo_v_inbox_metrics ────────────────────────────────────────────────────
drop view if exists public.eo_v_inbox_metrics cascade;
create view public.eo_v_inbox_metrics as
with sent_today as (
  select
    inbox_id,
    count(*) filter (where status = 'sent' and sent_at >= now() - interval '24 hours')
                                                                 as sent_24h
  from public.eo_messages
  group by inbox_id
),
sent_total as (
  select
    inbox_id,
    count(*) filter (where status = 'sent')                      as sent_lifetime,
    count(*) filter (where status = 'failed')                    as failed_lifetime
  from public.eo_messages
  group by inbox_id
),
ev as (
  select
    m.inbox_id,
    count(*) filter (where e.event_type = 'bounce')              as bounces_lifetime
  from public.eo_message_events e
  join public.eo_messages m on m.id = e.message_id
  group by m.inbox_id
)
select
  i.id                                   as inbox_id,
  i.org_id,
  i.email,
  i.display_name,
  i.provider,
  i.status,
  i.daily_limit,
  i.last_sent_at,
  i.last_health_check_at,
  i.last_health_error,
  i.warmup_enabled,
  i.warmup_score,

  coalesce(st.sent_24h, 0)               as sent_24h,
  coalesce(stot.sent_lifetime, 0)        as sent_lifetime,
  coalesce(stot.failed_lifetime, 0)      as failed_lifetime,
  coalesce(ev.bounces_lifetime, 0)       as bounces_lifetime,

  case when coalesce(stot.sent_lifetime, 0) > 0
       then round(100.0 * coalesce(ev.bounces_lifetime, 0) / stot.sent_lifetime, 1)
       else 0 end                        as bounce_rate,
  case when i.daily_limit > 0
       then round(100.0 * coalesce(st.sent_24h, 0) / i.daily_limit, 1)
       else 0 end                        as daily_usage_pct
from public.eo_inboxes i
left join sent_today st on st.inbox_id  = i.id
left join sent_total stot on stot.inbox_id = i.id
left join ev on ev.inbox_id              = i.id;

comment on view public.eo_v_inbox_metrics is
  'Métricas por inbox: capacidade diária (sent_24h vs daily_limit), reputação (bounce_rate), saúde.';

-- ── eo_v_step_metrics ─────────────────────────────────────────────────────
-- Performance por step/variant (utilizada pra exibir vencedor do A/B test).
drop view if exists public.eo_v_step_metrics cascade;
create view public.eo_v_step_metrics as
with sends as (
  select
    sequence_step_id,
    count(*) filter (where status = 'sent')                      as sent
  from public.eo_messages
  group by sequence_step_id
),
ev as (
  select
    m.sequence_step_id,
    count(distinct case when e.event_type = 'open' then e.message_id end)
                                                                 as unique_opens,
    count(*) filter (where e.event_type = 'reply')               as replies
  from public.eo_message_events e
  join public.eo_messages m on m.id = e.message_id
  group by m.sequence_step_id
)
select
  s.id                                   as sequence_step_id,
  s.campaign_id,
  s.step_order,
  s.variant_label,
  s.weight,
  s.subject_template,
  coalesce(sends.sent, 0)                as sent,
  coalesce(ev.unique_opens, 0)           as unique_opens,
  coalesce(ev.replies, 0)                as replies,
  case when coalesce(sends.sent, 0) > 0
       then round(100.0 * coalesce(ev.unique_opens, 0) / sends.sent, 1)
       else 0 end                        as open_rate,
  case when coalesce(sends.sent, 0) > 0
       then round(100.0 * coalesce(ev.replies, 0) / sends.sent, 1)
       else 0 end                        as reply_rate
from public.eo_sequence_steps s
left join sends on sends.sequence_step_id = s.id
left join ev    on ev.sequence_step_id    = s.id;

comment on view public.eo_v_step_metrics is
  'Performance por step/variant. Usada pra mostrar vencedor do A/B test.';

-- ── eo_v_daily_timeline ───────────────────────────────────────────────────
-- Série diária últimos 30 dias por org: sends + opens + replies.
drop view if exists public.eo_v_daily_timeline cascade;
create view public.eo_v_daily_timeline as
with date_series as (
  select generate_series(
    date_trunc('day', now()) - interval '29 days',
    date_trunc('day', now()),
    interval '1 day'
  )::date as day
),
orgs as (
  select distinct org_id from public.eo_messages
),
grid as (
  select o.org_id, d.day
  from orgs o
  cross join date_series d
),
sends_by_day as (
  select
    org_id,
    date_trunc('day', sent_at at time zone 'UTC')::date as day,
    count(*) as sent
  from public.eo_messages
  where status = 'sent' and sent_at is not null
  group by org_id, day
),
events_by_day as (
  select
    m.org_id,
    date_trunc('day', e.occurred_at at time zone 'UTC')::date as day,
    count(*) filter (where e.event_type = 'open')        as opens,
    count(*) filter (where e.event_type = 'click')       as clicks,
    count(*) filter (where e.event_type = 'reply')       as replies,
    count(*) filter (where e.event_type = 'bounce')      as bounces
  from public.eo_message_events e
  join public.eo_messages m on m.id = e.message_id
  group by m.org_id, day
)
select
  g.org_id,
  g.day,
  coalesce(s.sent, 0)              as sent,
  coalesce(e.opens, 0)             as opens,
  coalesce(e.clicks, 0)            as clicks,
  coalesce(e.replies, 0)           as replies,
  coalesce(e.bounces, 0)           as bounces
from grid g
left join sends_by_day s  on s.org_id = g.org_id and s.day = g.day
left join events_by_day e on e.org_id = g.org_id and e.day = g.day
order by g.org_id, g.day;

comment on view public.eo_v_daily_timeline is
  'Timeline diária últimos 30 dias por org: sends/opens/clicks/replies/bounces.';

-- ── Grants pra anon/authenticated lerem as views ──────────────────────────
-- (RLS continua nas tabelas originais; views herdam por padrão.)
grant select on public.eo_v_org_metrics       to anon, authenticated;
grant select on public.eo_v_campaign_metrics  to anon, authenticated;
grant select on public.eo_v_inbox_metrics     to anon, authenticated;
grant select on public.eo_v_step_metrics      to anon, authenticated;
grant select on public.eo_v_daily_timeline    to anon, authenticated;
