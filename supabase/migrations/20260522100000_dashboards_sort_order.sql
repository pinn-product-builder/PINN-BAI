-- Permite ao admin reordenar dashboards na sidebar/selector.
-- Sem coluna explícita, hoje a ordem é is_default DESC, depois alfabético —
-- não tem como o admin priorizar manualmente "Pipeline" antes de "ROAS".

alter table public.dashboards
  add column if not exists sort_order integer not null default 0;

-- Popula sort_order existente por (org_id, is_default DESC, created_at ASC).
-- is_default fica no topo (sort_order menor), depois cronológico.
with ranked as (
  select id,
         row_number() over (
           partition by org_id
           order by is_default desc nulls last, created_at asc
         ) * 10 as new_order
  from public.dashboards
)
update public.dashboards d
   set sort_order = r.new_order
  from ranked r
 where d.id = r.id
   and d.sort_order = 0; -- só popula rows ainda no default

create index if not exists dashboards_org_sort_idx
  on public.dashboards (org_id, sort_order);

comment on column public.dashboards.sort_order is
  'Ordem manual no selector. Multiplicado por 10 pra permitir inserções entre rows sem renumerar. Admin reordena pela UI.';
