-- ──────────────────────────────────────────────────────────────────────────
-- Email Outreach: previne duplicate sends por (campaign_lead, sequence_step)
-- ──────────────────────────────────────────────────────────────────────────
-- Contexto:
-- O sequencer (_tick_enrollments + _tick_send_queue) não tinha lock atômico.
-- Quando 2 ticks rodavam em paralelo (auto via APScheduler + manual via
-- endpoint /sequencer/tick), ambos liam o mesmo campaign_lead com
-- current_step=N e inseriam 2 rows em eo_messages pro mesmo
-- sequence_step_id, resultando em 2 emails idênticos ao destinatário.
--
-- Bug observado em 2026-05-18: igor.bernardes@pinnpb.com recebeu 2 emails
-- com ~6s de diferença.
--
-- Defesa #1 (esta migration): UNIQUE constraint impede no nível DB.
-- Defesa #2 (asyncio.Lock no sequencer.py): impede no nível app mesmo
-- antes de tentar o INSERT.
-- Defesa #3 (catch UniqueViolation no sequencer.py): se 2 instâncias do
-- backend rodarem (cluster), a segunda recebe erro e ignora gracefully.

-- 1) Limpa duplicatas existentes (mantém a mais antiga por (campaign_lead, step))
with ranked as (
  select id,
         campaign_lead_id,
         sequence_step_id,
         row_number() over (
           partition by campaign_lead_id, sequence_step_id
           order by created_at asc, id asc
         ) as rn
  from public.eo_messages
  where campaign_lead_id is not null
    and sequence_step_id is not null
),
to_delete as (
  select id from ranked where rn > 1
)
delete from public.eo_message_events
where message_id in (select id from to_delete);

with ranked as (
  select id,
         campaign_lead_id,
         sequence_step_id,
         row_number() over (
           partition by campaign_lead_id, sequence_step_id
           order by created_at asc, id asc
         ) as rn
  from public.eo_messages
  where campaign_lead_id is not null
    and sequence_step_id is not null
)
delete from public.eo_messages
where id in (select id from ranked where rn > 1);

-- 2) UNIQUE constraint
-- Cada (campaign_lead × sequence_step) só pode ter 1 message.
-- A/B variants têm sequence_step_id diferentes (são rows distintas em
-- eo_sequence_steps), então não conflita.
create unique index if not exists eo_messages_unique_step_per_lead
  on public.eo_messages (campaign_lead_id, sequence_step_id);

comment on index public.eo_messages_unique_step_per_lead is
  'Previne envios duplicados pro mesmo (campaign_lead × step). Sequencer concorrente cai aqui se passar do asyncio.Lock no app.';
