-- ── Gamification: Achievements & Leaderboard ─────────────────────────────────

-- Achievement definitions (seeded catalogue)
create table if not exists public.achievement_definitions (
  id          text primary key,  -- slug: 'first_conversion', 'century_leads', etc.
  name        text not null,
  description text not null,
  icon        text not null,
  xp          integer not null default 100,
  category    text not null default 'sales' check (category in ('sales', 'quality', 'growth', 'retention'))
);

-- Per-user earned achievements within an org
create table if not exists public.user_achievements (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  achievement_id  text not null references public.achievement_definitions(id),
  earned_at       timestamptz not null default now(),
  unique(org_id, user_id, achievement_id)
);

-- Weekly/monthly leaderboard snapshots
create table if not exists public.leaderboard_entries (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  period_type text not null check (period_type in ('week', 'month')),
  period_key  text not null,   -- e.g. '2026-W18', '2026-04'
  metric_key  text not null,   -- e.g. 'conversions', 'revenue', 'leads'
  value       numeric not null default 0,
  rank        integer,
  created_at  timestamptz not null default now(),
  unique(org_id, user_id, period_type, period_key, metric_key)
);

-- RLS
alter table public.achievement_definitions enable row level security;
alter table public.user_achievements      enable row level security;
alter table public.leaderboard_entries    enable row level security;

create policy "public read achievement_definitions"
  on public.achievement_definitions for select using (true);

create policy "org user_achievements"
  on public.user_achievements for all
  using (org_id in (select org_id from public.org_members where user_id = auth.uid()));

create policy "org leaderboard_entries"
  on public.leaderboard_entries for all
  using (org_id in (select org_id from public.org_members where user_id = auth.uid()));

-- Indexes
create index on public.user_achievements (org_id, user_id);
create index on public.leaderboard_entries (org_id, period_type, period_key, metric_key);

-- ── Seed achievement catalogue ────────────────────────────────────────────────

insert into public.achievement_definitions (id, name, description, icon, xp, category) values
  ('first_conversion',   'Primeira Conversão',      'Converteu o primeiro lead',               '🎯', 100, 'sales'),
  ('century_leads',      'Centurião',                'Gerou 100 leads em um mês',               '💯', 200, 'sales'),
  ('conversion_streak',  'Em Chamas',                'Converteu leads 5 dias seguidos',         '🔥', 150, 'sales'),
  ('top_revenue',        'Maior Receita',            'Gerou a maior receita do mês no time',    '👑', 300, 'sales'),
  ('high_ctr',           'Clique Campeão',           'CTR acima de 5% em campanhas de ads',    '🖱️', 150, 'quality'),
  ('low_cpl',            'CPL Ótimo',                'CPL abaixo de R$50 em um período',       '💸', 200, 'quality'),
  ('roas_3x',            'ROAS 3x',                  'ROAS ≥ 3x em período de 30 dias',        '📈', 250, 'quality'),
  ('healthy_base',       'Base Saudável',            '80%+ dos clientes na banda Saudável',     '💚', 200, 'retention'),
  ('zero_critical',      'Zero Críticos',            'Nenhum cliente na banda Crítico',         '🛡️', 300, 'retention'),
  ('churn_buster',       'Anti-Churn',               'Reduziu churn rate em 20% no mês',       '🏰', 250, 'retention'),
  ('ltv_3x_cac',         'Unidade Saudável',         'LTV:CAC ratio ≥ 3x no período',           '⚖️', 250, 'growth'),
  ('fast_payback',       'Payback Rápido',           'Payback period ≤ 3 meses',               '⚡', 200, 'growth')
on conflict (id) do nothing;
