-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Email Outreach (EO) — Motor próprio de cold email estilo SmartLead       ║
-- ║  Sprint 1 / Épico 1 — Fundação                                            ║
-- ║  Escopo MVP: org única PINN, inbox OAuth (Gmail/Outlook) + SMTP genérico, ║
-- ║  sequências multi-step, tracking, reply detection, suppressions.          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- pgcrypto pra criptografar refresh_tokens dentro do banco (PGP_SYM_*).
create extension if not exists pgcrypto;

-- ── eo_inboxes ──────────────────────────────────────────────────────────────
-- Uma "caixa" conectada. Pode ser Gmail OAuth, Outlook OAuth, SMTP/IMAP
-- genérico ou um ESP transacional (SES/Resend). Usada como remetente.
create table if not exists public.eo_inboxes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,

  provider text not null check (provider in ('gmail', 'outlook', 'smtp', 'ses')),
  email text not null,
  display_name text not null default '',

  -- OAuth (gmail/outlook): tokens criptografados no insert/update via trigger.
  oauth_tokens_enc bytea,
  oauth_scopes text,
  oauth_expires_at timestamptz,

  -- SMTP/IMAP (provider='smtp'): senha criptografada.
  smtp_host text,
  smtp_port int,
  smtp_username text,
  smtp_password_enc bytea,
  imap_host text,
  imap_port int,
  imap_username text,
  imap_password_enc bytea,

  -- Limites e ramp-up (warmup respeita esses números).
  daily_limit int not null default 50 check (daily_limit > 0 and daily_limit <= 2000),
  ramp_up_target int,
  ramp_up_start_at timestamptz,

  -- Estado operacional.
  status text not null default 'active' check (
    status in ('active','paused','disconnected','warming','error')
  ),
  warmup_enabled boolean not null default false,
  warmup_score numeric(5,2) not null default 0,  -- 0..100

  last_health_check_at timestamptz,
  last_health_error text,
  last_sent_at timestamptz,

  -- Auditoria.
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (org_id, email)
);

create index if not exists eo_inboxes_org_status_idx
  on public.eo_inboxes (org_id, status);

comment on table public.eo_inboxes is
  'Caixas de entrada conectadas para envio de cold email (Gmail/Outlook OAuth, SMTP genérico, ESP).';
comment on column public.eo_inboxes.oauth_tokens_enc is
  'JSON {access_token, refresh_token, token_type} criptografado via pgp_sym_encrypt usando EO_ENCRYPTION_KEY.';
comment on column public.eo_inboxes.daily_limit is
  'Teto de envios por dia (rolling 24h). Ramp-up sobe este valor automaticamente até ramp_up_target.';

-- ── eo_campaigns ────────────────────────────────────────────────────────────
create table if not exists public.eo_campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,

  name text not null,
  description text,

  status text not null default 'draft' check (
    status in ('draft','active','paused','completed','archived')
  ),

  -- Comportamento padrão da campanha.
  timezone text not null default 'America/Sao_Paulo',  -- IANA tz; fallback se o lead não tiver.
  send_window jsonb not null default '{"mon":[9,18],"tue":[9,18],"wed":[9,18],"thu":[9,18],"fri":[9,17]}'::jsonb,

  stop_on_reply boolean not null default true,
  stop_on_click boolean not null default false,
  track_opens boolean not null default true,
  track_clicks boolean not null default true,

  -- Quando ativada pela primeira vez.
  activated_at timestamptz,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists eo_campaigns_org_status_idx
  on public.eo_campaigns (org_id, status);

comment on column public.eo_campaigns.send_window is
  'Janela de envio por dia da semana (timezone do lead, fallback campaign.timezone). Formato {"mon":[startHour,endHour],...}.';

-- ── eo_campaign_inboxes (N:N) ──────────────────────────────────────────────
-- Uma campanha pode rotacionar entre N inboxes; cada uma com peso para
-- round-robin ponderado.
create table if not exists public.eo_campaign_inboxes (
  campaign_id uuid not null references public.eo_campaigns(id) on delete cascade,
  inbox_id uuid not null references public.eo_inboxes(id) on delete cascade,
  weight int not null default 1 check (weight > 0 and weight <= 10),
  added_at timestamptz not null default now(),
  primary key (campaign_id, inbox_id)
);

-- ── eo_sequence_steps ───────────────────────────────────────────────────────
-- Cada step da sequência. Variants compartilham step_order e diferem em
-- variant_label (A/B testing — Épico 7).
create table if not exists public.eo_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.eo_campaigns(id) on delete cascade,

  step_order int not null check (step_order >= 1),
  variant_label text not null default 'A',

  -- Delay desde o step anterior (ou desde enrollment, no step 1).
  delay_days int not null default 0 check (delay_days >= 0),
  delay_hours int not null default 0 check (delay_hours >= 0),

  subject_template text not null,
  body_template text not null,  -- HTML; texto plano gerado no envio.

  -- Threading: se true, step responde o último email do step anterior
  -- mantendo "Re: ..." e In-Reply-To. Step 1 sempre é false.
  is_reply_to_previous boolean not null default true,

  -- Peso da variant (default 1 = uniforme entre variants do mesmo step_order).
  weight int not null default 1 check (weight > 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (campaign_id, step_order, variant_label)
);

create index if not exists eo_sequence_steps_campaign_idx
  on public.eo_sequence_steps (campaign_id, step_order);

-- ── eo_leads ────────────────────────────────────────────────────────────────
-- Pool de leads importáveis em N campanhas. Dedup por (org_id, email).
create table if not exists public.eo_leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,

  email text not null check (length(email) <= 320),
  first_name text,
  last_name text,
  company text,
  title text,
  phone text,
  linkedin_url text,

  custom_fields jsonb not null default '{}',
  timezone text,  -- IANA tz; fallback p/ campaign.timezone.

  -- Origem (import csv, ploomes, manual, api, etc).
  source text not null default 'manual',
  external_ref text,  -- ex.: ploomes contact_id, p/ writeback (Épico 8).

  -- Status global do lead (independente de campanha).
  status text not null default 'active' check (
    status in ('active','bounced','unsubscribed','suppressed')
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (org_id, email)
);

create index if not exists eo_leads_org_status_idx on public.eo_leads (org_id, status);
create index if not exists eo_leads_external_ref_idx on public.eo_leads (org_id, external_ref);

-- ── eo_campaign_leads ──────────────────────────────────────────────────────
-- Enrollment de um lead em uma campanha. Mantém o "ponteiro" da sequência.
create table if not exists public.eo_campaign_leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.eo_campaigns(id) on delete cascade,
  lead_id uuid not null references public.eo_leads(id) on delete cascade,

  current_step int not null default 0,  -- 0 = ainda não recebeu o step 1.
  next_send_at timestamptz,              -- quando o próximo email deve sair.
  variant_assignment jsonb not null default '{}',  -- {step_order: variant_label} fixado no enrollment.

  status text not null default 'enrolled' check (
    status in ('enrolled','paused','replied','bounced','unsubscribed','finished','failed')
  ),
  status_reason text,

  enrolled_at timestamptz not null default now(),
  finished_at timestamptz,
  paused_at timestamptz,

  unique (campaign_id, lead_id)
);

create index if not exists eo_campaign_leads_due_idx
  on public.eo_campaign_leads (status, next_send_at)
  where status = 'enrolled';

create index if not exists eo_campaign_leads_campaign_idx
  on public.eo_campaign_leads (campaign_id, status);

-- ── eo_messages ─────────────────────────────────────────────────────────────
-- 1 lead × 1 step = 1 row. Granularidade de auditoria e fila de envio.
create table if not exists public.eo_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  campaign_lead_id uuid not null references public.eo_campaign_leads(id) on delete cascade,
  sequence_step_id uuid not null references public.eo_sequence_steps(id) on delete restrict,
  inbox_id uuid not null references public.eo_inboxes(id) on delete restrict,

  to_email text not null,
  to_name text,
  subject text not null,
  body_html text not null,
  body_text text,

  -- Headers RFC pra reconciliar com IMAP/Gmail API depois.
  message_id_header text,        -- Message-ID gerado no envio.
  in_reply_to_header text,       -- Para threading.
  thread_id text,                -- Gmail threadId / Outlook conversationId.

  scheduled_at timestamptz not null,
  sent_at timestamptz,

  status text not null default 'queued' check (
    status in ('queued','sending','sent','failed','skipped','cancelled')
  ),
  attempt_count int not null default 0,
  last_attempt_at timestamptz,

  provider_response jsonb,       -- payload bruto do Gmail/Outlook/SMTP.
  error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índice central da fila: scheduler busca aqui.
create index if not exists eo_messages_queue_idx
  on public.eo_messages (status, scheduled_at)
  where status in ('queued','sending');

create index if not exists eo_messages_inbox_sent_idx
  on public.eo_messages (inbox_id, sent_at)
  where status = 'sent';

create index if not exists eo_messages_msgid_idx
  on public.eo_messages (message_id_header)
  where message_id_header is not null;

create index if not exists eo_messages_campaign_lead_idx
  on public.eo_messages (campaign_lead_id);

-- ── eo_message_events ───────────────────────────────────────────────────────
-- Eventos de tracking: open, click, reply, bounce, unsubscribe, complaint.
create table if not exists public.eo_message_events (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.eo_messages(id) on delete cascade,

  event_type text not null check (
    event_type in ('open','click','reply','bounce','unsubscribe','complaint','delivered','deferred')
  ),

  -- Para click: URL clicada (não-codificada).
  -- Para reply: thread/headers.
  -- Para bounce: classification (hard/soft) e diagnostic.
  metadata jsonb not null default '{}',

  user_agent text,
  ip_address inet,

  occurred_at timestamptz not null default now()
);

create index if not exists eo_message_events_message_idx
  on public.eo_message_events (message_id, event_type, occurred_at);

create index if not exists eo_message_events_type_idx
  on public.eo_message_events (event_type, occurred_at);

-- ── eo_suppressions ─────────────────────────────────────────────────────────
-- Lista global de bloqueios por org. Checada antes de cada envio.
-- Diferente de eo_unsubscribes (que é o registro user-facing).
create table if not exists public.eo_suppressions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,

  email text not null,
  kind text not null check (kind in ('bounce_hard','bounce_soft','complaint','manual','unsubscribe')),
  reason text,

  -- Soft suppression pode ter expiração (retry depois de X dias).
  expires_at timestamptz,

  created_at timestamptz not null default now(),

  unique (org_id, email, kind)
);

create index if not exists eo_suppressions_lookup_idx
  on public.eo_suppressions (org_id, email);

-- ── eo_unsubscribes ────────────────────────────────────────────────────────
create table if not exists public.eo_unsubscribes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.eo_leads(id) on delete set null,

  email text not null,
  source text not null default 'one_click' check (
    source in ('one_click','reply_keyword','manual','complaint','list_unsubscribe_header')
  ),
  campaign_id uuid references public.eo_campaigns(id) on delete set null,
  user_agent text,
  ip_address inet,

  created_at timestamptz not null default now(),

  unique (org_id, email)
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Triggers de updated_at                                                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create or replace function public.eo_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'eo_inboxes','eo_campaigns','eo_sequence_steps',
    'eo_leads','eo_messages'
  ] loop
    execute format('drop trigger if exists trg_touch_%I on public.%I', t, t);
    execute format(
      'create trigger trg_touch_%I before update on public.%I
       for each row execute function public.eo_touch_updated_at()',
      t, t
    );
  end loop;
end;
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  RLS — padrão da plataforma: get_user_org_id + is_platform_admin           ║
-- ║  Service role (backend FastAPI) bypassa RLS automaticamente.              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table public.eo_inboxes          enable row level security;
alter table public.eo_campaigns        enable row level security;
alter table public.eo_campaign_inboxes enable row level security;
alter table public.eo_sequence_steps   enable row level security;
alter table public.eo_leads            enable row level security;
alter table public.eo_campaign_leads   enable row level security;
alter table public.eo_messages         enable row level security;
alter table public.eo_message_events   enable row level security;
alter table public.eo_suppressions     enable row level security;
alter table public.eo_unsubscribes     enable row level security;

-- Helper: tabelas que têm coluna org_id direta.
-- SELECT: qualquer membro autenticado da org.
-- WRITE (insert/update/delete): client_admin ou analyst (mesmo padrão usado
-- nas policies do crm_auditor / user_widget_layouts).

do $$
declare
  tbl text;
  -- Tabelas com coluna org_id direta. eo_campaign_leads NÃO está aqui — é filha
  -- de eo_campaigns (acesso via JOIN, policy explícita abaixo).
  org_tables text[] := array[
    'eo_inboxes','eo_campaigns','eo_leads',
    'eo_messages','eo_suppressions','eo_unsubscribes'
  ];
begin
  foreach tbl in array org_tables loop
    execute format($f$
      drop policy if exists "%1$s_select_org" on public.%1$I;
      create policy "%1$s_select_org"
        on public.%1$I for select to authenticated
        using (
          org_id = public.get_user_org_id(auth.uid())
          or public.is_platform_admin(auth.uid())
        );

      drop policy if exists "%1$s_insert_org" on public.%1$I;
      create policy "%1$s_insert_org"
        on public.%1$I for insert to authenticated
        with check (
          (
            org_id = public.get_user_org_id(auth.uid())
            or public.is_platform_admin(auth.uid())
          )
          and (
            public.is_platform_admin(auth.uid())
            or exists (
              select 1 from public.user_roles ur
              where ur.user_id = auth.uid()
                and ur.role in ('client_admin'::public.app_role, 'analyst'::public.app_role)
            )
          )
        );

      drop policy if exists "%1$s_update_org" on public.%1$I;
      create policy "%1$s_update_org"
        on public.%1$I for update to authenticated
        using (
          org_id = public.get_user_org_id(auth.uid())
          or public.is_platform_admin(auth.uid())
        )
        with check (
          org_id = public.get_user_org_id(auth.uid())
          or public.is_platform_admin(auth.uid())
        );

      drop policy if exists "%1$s_delete_org" on public.%1$I;
      create policy "%1$s_delete_org"
        on public.%1$I for delete to authenticated
        using (
          org_id = public.get_user_org_id(auth.uid())
          or public.is_platform_admin(auth.uid())
        );
    $f$, tbl);
  end loop;
end;
$$;

-- Tabelas filhas (sem org_id direto): herdam acesso via JOIN com a tabela pai.
-- eo_campaign_inboxes → eo_campaigns
drop policy if exists "eo_campaign_inboxes_select" on public.eo_campaign_inboxes;
create policy "eo_campaign_inboxes_select"
  on public.eo_campaign_inboxes for select to authenticated
  using (
    exists (
      select 1 from public.eo_campaigns c
      where c.id = campaign_id
        and (c.org_id = public.get_user_org_id(auth.uid())
             or public.is_platform_admin(auth.uid()))
    )
  );

drop policy if exists "eo_campaign_inboxes_write" on public.eo_campaign_inboxes;
create policy "eo_campaign_inboxes_write"
  on public.eo_campaign_inboxes for all to authenticated
  using (
    exists (
      select 1 from public.eo_campaigns c
      where c.id = campaign_id
        and (c.org_id = public.get_user_org_id(auth.uid())
             or public.is_platform_admin(auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.eo_campaigns c
      where c.id = campaign_id
        and (c.org_id = public.get_user_org_id(auth.uid())
             or public.is_platform_admin(auth.uid()))
    )
  );

-- eo_sequence_steps → eo_campaigns
drop policy if exists "eo_sequence_steps_select" on public.eo_sequence_steps;
create policy "eo_sequence_steps_select"
  on public.eo_sequence_steps for select to authenticated
  using (
    exists (
      select 1 from public.eo_campaigns c
      where c.id = campaign_id
        and (c.org_id = public.get_user_org_id(auth.uid())
             or public.is_platform_admin(auth.uid()))
    )
  );

drop policy if exists "eo_sequence_steps_write" on public.eo_sequence_steps;
create policy "eo_sequence_steps_write"
  on public.eo_sequence_steps for all to authenticated
  using (
    exists (
      select 1 from public.eo_campaigns c
      where c.id = campaign_id
        and (c.org_id = public.get_user_org_id(auth.uid())
             or public.is_platform_admin(auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.eo_campaigns c
      where c.id = campaign_id
        and (c.org_id = public.get_user_org_id(auth.uid())
             or public.is_platform_admin(auth.uid()))
    )
  );

-- eo_campaign_leads → eo_campaigns (via campaign_id)
drop policy if exists "eo_campaign_leads_select" on public.eo_campaign_leads;
create policy "eo_campaign_leads_select"
  on public.eo_campaign_leads for select to authenticated
  using (
    exists (
      select 1 from public.eo_campaigns c
      where c.id = campaign_id
        and (c.org_id = public.get_user_org_id(auth.uid())
             or public.is_platform_admin(auth.uid()))
    )
  );

drop policy if exists "eo_campaign_leads_write" on public.eo_campaign_leads;
create policy "eo_campaign_leads_write"
  on public.eo_campaign_leads for all to authenticated
  using (
    exists (
      select 1 from public.eo_campaigns c
      where c.id = campaign_id
        and (c.org_id = public.get_user_org_id(auth.uid())
             or public.is_platform_admin(auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.eo_campaigns c
      where c.id = campaign_id
        and (c.org_id = public.get_user_org_id(auth.uid())
             or public.is_platform_admin(auth.uid()))
    )
  );

-- eo_message_events → eo_messages → org
drop policy if exists "eo_message_events_select" on public.eo_message_events;
create policy "eo_message_events_select"
  on public.eo_message_events for select to authenticated
  using (
    exists (
      select 1 from public.eo_messages m
      where m.id = message_id
        and (m.org_id = public.get_user_org_id(auth.uid())
             or public.is_platform_admin(auth.uid()))
    )
  );

-- Eventos sempre são gravados pelo backend (service role), não há insert via JWT.

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Helpers de criptografia (PGP simétrico)                                  ║
-- ║  A key vem de uma GUC custom configurada na sessão pelo backend:          ║
-- ║    SET app.eo_encryption_key = '<EO_ENCRYPTION_KEY env var>';             ║
-- ║  Em produção, usar Supabase Vault é o ideal — esta é a versão MVP.        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create or replace function public.eo_encrypt(plaintext text)
returns bytea
language plpgsql
as $$
declare
  k text;
begin
  if plaintext is null then return null; end if;
  k := current_setting('app.eo_encryption_key', true);
  if k is null or k = '' then
    raise exception 'app.eo_encryption_key não configurada nesta sessão';
  end if;
  return pgp_sym_encrypt(plaintext, k);
end;
$$;

create or replace function public.eo_decrypt(ciphertext bytea)
returns text
language plpgsql
as $$
declare
  k text;
begin
  if ciphertext is null then return null; end if;
  k := current_setting('app.eo_encryption_key', true);
  if k is null or k = '' then
    raise exception 'app.eo_encryption_key não configurada nesta sessão';
  end if;
  return pgp_sym_decrypt(ciphertext, k);
end;
$$;

comment on function public.eo_encrypt(text) is
  'Criptografa segredos do email outreach. Requer SET app.eo_encryption_key na sessão.';
comment on function public.eo_decrypt(bytea) is
  'Decriptografa segredos do email outreach. Backend (service role) chama antes de usar tokens.';
