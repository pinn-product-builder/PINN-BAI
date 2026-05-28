-- E4.S2 — Prompts customizáveis pela equipe Pinn, versionados.
--
-- Hoje os prompts da IA (insights, meeting_brief, live_generate, chat) estão
-- hardcoded na edge function `ai-data-chat`. Quer ajustar tom ou regra?
-- Precisa deploy. Esta tabela permite editar via UI admin sem touch no código.
--
-- Estratégia "active flag":
--   - `prompt_key` é o slot lógico (ex: "insights", "meeting_brief").
--   - Cada versão é uma row imutável com `version` incrementando.
--   - `is_active = true` marca a versão em uso. UI só promove uma de cada vez.
--   - Edge function lê WHERE is_active=true AND prompt_key=$1.
--   - Histórico preservado pra rollback.

create table if not exists public.ai_prompts (
  id            uuid primary key default gen_random_uuid(),
  prompt_key    text not null,
  version       int  not null default 1,
  title         text not null,
  body          text not null,
  description   text,
  is_active     boolean not null default false,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (prompt_key, version)
);

create index if not exists ai_prompts_active_idx
  on public.ai_prompts (prompt_key) where is_active = true;

comment on table public.ai_prompts is
  'Prompts versionados da IA. Edge function lê WHERE is_active=true. Histórico preservado pra rollback.';

create or replace function public.touch_ai_prompts()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_touch_ai_prompts on public.ai_prompts;
create trigger trg_touch_ai_prompts
  before update on public.ai_prompts
  for each row execute function public.touch_ai_prompts();

-- Garantir apenas uma versão ativa por prompt_key.
create or replace function public.ai_prompts_enforce_single_active()
returns trigger language plpgsql as $$
begin
  if new.is_active then
    update public.ai_prompts set is_active = false
      where prompt_key = new.prompt_key and id <> new.id and is_active = true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ai_prompts_single_active on public.ai_prompts;
create trigger trg_ai_prompts_single_active
  after insert or update of is_active on public.ai_prompts
  for each row when (new.is_active) execute function public.ai_prompts_enforce_single_active();

-- ── Seeds: prompts atuais hardcoded na edge function ──────────────────────────
insert into public.ai_prompts (prompt_key, version, title, body, description, is_active)
values
  ('insights', 1, 'Insights v1 — atual da edge function',
   '(deixe vazio para usar o prompt embutido no código da edge function ai-data-chat)',
   'Versão hardcoded ativa hoje. Para customizar, crie uma nova versão e marque is_active=true.',
   true)
on conflict (prompt_key, version) do nothing;

insert into public.ai_prompts (prompt_key, version, title, body, description, is_active)
values
  ('meeting_brief', 1, 'Pauta de reunião v1',
   '(deixe vazio para usar o prompt embutido no código)',
   'Pauta consultiva gerada pelo BAI no menu admin do dashboard.',
   true),
  ('chat', 1, 'BAI Copilot v1',
   '(deixe vazio para usar o prompt embutido no código)',
   'Chat conversacional do Bacilot.',
   true)
on conflict (prompt_key, version) do nothing;

alter table public.ai_prompts enable row level security;

drop policy if exists "ai_prompts_select_authenticated" on public.ai_prompts;
create policy "ai_prompts_select_authenticated"
  on public.ai_prompts for select to authenticated
  using (true);

drop policy if exists "ai_prompts_write_platform_admin" on public.ai_prompts;
create policy "ai_prompts_write_platform_admin"
  on public.ai_prompts for all to authenticated
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));
