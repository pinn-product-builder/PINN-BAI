# 🧭 Norte — Bugs da reunião de 10/jun/2026 × estado do código local

> Cruzamento entre os problemas levantados na reunião (Renan + Pedro + Igor, auditoria com Claude)
> e o **estado atual do working tree local** (analisado em 11/jun/2026, inclui mudanças não commitadas).
> Complementa o `TODO.md` (des-hardcode F0–F5) — aqui o foco são os bugs operacionais da reunião.

## ⚡ STATUS 11/jun (pós-execução)

| Item | Status |
|---|---|
| P0.1 IDOR edge functions | ✅ FECHADO + deployado (helper `_shared/auth.ts`; anon→401, org cruzada→403). Exceção: `sync-kommo/ploomes/omie` ficam SEM auth (pg_cron chama sem header) → **P0.3 novo**: fechar via Vault. 3 chamadores diretos do front (AIChat, DashboardAdminMenu×2, Insights) corrigidos p/ mandar `session.access_token` |
| P0.2 .env no git | ⏳ pendente (ação Pedro: rotacionar + scrub) |
| P1.1 churn_predictions | ✅ removido (threshold, achievement, ai-data-chat, useUnitEconomics) |
| P1.2 leads→crm_leads | ✅ KPI services no padrão crm_leads-first (`backend/core/kpi/lead_data.py`); resto (Kanban CRM) vai pro P2.4 |
| P1.3 duração "Sem informação" | ✅ resolvido GERAL via RPC `custom_field_distribution` (93+55+6=154 ✔); view eco corrigida tb (`20260611170000`) até o drop no P2.4 |
| P1.4 nomes de métrica | ✅ "Conversão p/ Reunião" → "Taxa de Agendamento" (decisão Igor na reunião); widget vazio "Novo widget" removido |
| P1.5 widgets→RPC período | ✅ Ecológica 100% (RPCs gerais `20260611160000`); Afonsina(46)/Pinn(20)/QuitouBR(12) ficam pro F4 |
| P2.1 stage history | ✅ `crm_lead_stage_history` + TRIGGER em crm_leads (`20260611180000`) — engine-agnóstico, backfill=marco de corte (2082 leads), RLS, validado ao vivo |
| P2.2 crm_snapshots | ✅ NÃO era zumbi — sync Python escreve, metrics lê, 9 rows. Nada a fazer |
| P2.3 filtro global de funil | ⏳ pendente |
| P2.4 higienização órfãos | ⏳ pendente (vw_bai_eco_*, vw_linkedin_sdr_*, kommo_leads, Kanban leads→crm_leads) |
| P2.5 conector Pipedrive | ⏳ pendente (depende F3) |
| P3 CI + testes + stress | ⏳ pendente |
| Commit do working tree | ⏳ **PRIMEIRO PASSO AINDA PENDENTE** (~45 arquivos) |

---

## ✅ JÁ RESOLVIDO no local (validar → commitar → deployar)

> ⚠️ **Quase tudo isso está em ~43 arquivos NÃO COMMITADOS.** Primeiro passo do norte: commitar.

| # | Item da reunião | Onde está a correção |
|---|---|---|
| 1 | **Composio removido** (mock de pipes/leads fake que inflava contagem 159→154) | 5 arquivos deletados (`composio_*.py`, `composioClient.ts`, `kommoComposioExecute.ts`); `sync-kommo` agora chama API Kommo direto; endpoints POST antigos retornam 501 |
| 2 | **Filtro de período ignorado pelos KPI cards** | `useFilters()` → `dateRangeISO` → RPCs com período: `eco_kpis_period` e `funnel_distribution` (`supabase/migrations/20260611140000_period_rpcs.sql`) via `fetch-client-data` com `rpc:` prefix |
| 3 | **Layout não persistia (posição X/Y + tamanho)** | `src/hooks/useDashboardLayout.ts` — localStorage + tabela `user_widget_layouts` (upsert com debounce 500ms) |
| 4 | **Editar fonte de dados + fórmula do widget** | `src/components/dashboard/admin/WidgetEditorDialog.tsx` — dataSource, métrica, agregação, formato e fórmula (modo simples A/B e avançado com validação live) |
| 5 | **FunnelWidget contagens erradas / mesmo nº em todas as etapas** | `src/components/dashboard/widgets/FunnelWidget.tsx` — contagem real por etapa, `showEmptyStages`, dropdown de pipeline quando há >1, guarda anti-conversão-100%-falsa (amostra < 5) |
| 6 | **Won/lost por nome de etapa** | `backend/crm_auditor/modules/kommo/mapper.py:12-33` — status IDs fixos do Kommo (142=won, 143=lost) + `stage_type`, independente de nome/idioma |
| 7 | **Fonte de verdade dupla (Supabase × Kommo live misturados)** | Fluxo unificado: sync (live Kommo) → grava `crm_leads`/`crm_stages`/etc → TODA leitura vem do banco. Sem polling live no dashboard |
| 8 | **Analytics lendo da tabela `leads` (vazia) em vez de `crm_leads`** | `backend/core/health/service.py:81-170` (crm_leads first, fallback leads) e `metrics_service.py:28-38` (crm_leads direto) — **exceções abaixo em P1** |
| 9 | **Custom fields omitidos quando null (payload Kommo)** | `raw` JSONB completo em `crm_leads` + view `vw_bai_crm_lead_custom_fields` explode `custom_fields_values` |
| 10 | **Leads de teste no banco (167 vs 154)** | Sync com reconcile delete-missing (`sync-kommo/index.ts:195-207`) — o que não volta da API é deletado |

---

## 🔴 P0 — SEGURANÇA (fazer antes de qualquer venda/demo)

### P0.1 — IDOR real nas edge functions (`verify_jwt = false` + service_role + org_id do body)
**O bug que o Claude do Renan apontou ("troca org_id na URL → lê dados de qualquer cliente") existe — só que na edge function, não na URL.**

- `supabase/functions/fetch-client-data/index.ts:43-45` — só verifica a **presença** do header `Authorization` (qualquer string passa), depois usa `service_role` (bypass de RLS) e filtra pelo `orgId` **que veio no body do request**, sem validar pertencimento.
- `supabase/config.toml` — `verify_jwt = false` em ~13 functions: `fetch-client-data`, `compose-dashboard`, `ai-data-chat`, `calculate-dashboard-metrics`, `recommend-widgets`, `suggest-tables`, `suggest-mappings`, `create-org-admin`, `calculate-rfm`, `predict-churn`, `sync-external-api`, `fetch-google-sheets`, `test-supabase-connection`…
- **Consequência:** qualquer pessoa com a anon key (pública, está no bundle do frontend) chama a function com qualquer `org_id` e lê dados de qualquer cliente.
- O teste que o Pedro fez na reunião (trocar URL → redirect pro login) só prova que a **UI** redireciona; a function continua aberta por trás.

**Fix (padrão único para todas):**
1. Validar o JWT de verdade: `supabase.auth.getUser(token)` no início da function (ou `verify_jwt = true` onde não há chamada server-to-server).
2. Com o `user_id` validado, checar membership: `profiles.org_id === orgId` OU `platform_admin` — igual ao `assertOrgAccess()` que **já existe** em `server/src/modules/crm-auditor/service.ts:47-73`. Extrair como helper compartilhado das functions.
3. `create-org-admin` merece atenção especial (criação de admin sem JWT verificado).

> Obs: `dashboards`/`dashboard_widgets` TÊM RLS correto (org-scoped, migration `20260203142931:398-435`). O problema não é RLS — é o bypass via service_role nas functions.

### P0.2 — `.env` no histórico do git (já mapeado como F0/#40 no TODO.md)
- Rotacionar `service_role` + `anon` + OpenAI + Maps; `git filter-repo` no histórico; confirmar visibilidade do repo GitHub. **Continua pendente.**

---

## 🟠 P1 — DADOS / CÁLCULO (quebra silenciosa de métricas)

### P1.1 — Tabela `churn_predictions` NÃO EXISTE (código quebra em runtime)
A tabela real é `customer_churn_scores`. Referências quebradas:
- `backend/core/kpi/threshold_service.py:78`
- `backend/core/kpi/achievement_service.py:70`
- `supabase/functions/ai-data-chat/index.ts:311`

**Decisão a tomar:** como RFM+Churn foi removido da superfície do produto (commit `131aaef`), o caminho mais limpo é **remover esses code paths de vez** (não renomear a tabela). Se mantiver, trocar para `customer_churn_scores`.

### P1.2 — `achievement_service` ainda lê da tabela `leads` (legado)
- `backend/core/kpi/achievement_service.py:75-79` — usar `crm_leads` (mesmo padrão crm_leads-first do `health/service.py`).

### P1.3 — View `vw_bai_eco_duracao` descarta 60% dos leads (sem bucket "Sem informação")
- `supabase/migrations/20260610180000_baseline_capture_drift_views_funcs.sql` (~linha 337) — o `CASE` até tem `ELSE 'Não especificado'`, mas o `WHERE value IS NOT NULL AND btrim(value) <> ''` filtra antes, então o bucket nunca aparece. 93 de 154 leads ficam invisíveis no widget.
- **Fix:** mover o filtro pro CASE (LEFT JOIN / sem WHERE) para que leads sem o campo caiam em "Sem informação". Reavaliar normalização de texto livre ("4 dias 3 noites", "2 casal"…).

### P1.4 — Semântica "reuniões marcadas" × "em reunião agendada" (definida na reunião — fixar no produto)
- **Reuniões marcadas (cumulativo)** = custom field `reuniao_agendada=true` → 5 — é a métrica fiel do período. ✔ card atual.
- **Em reunião agendada (snapshot)** = leads atualmente na etapa → 1 — é retrato do funil. ✔ funil atual.
- Garantir nomes distintos na UI ("taxa de agendamento", não "conversão") e documentar nos `metric_definitions` (F5) para nunca mais confundir os dois.

### P1.5 — Padrão para filtro de período: toda métrica nova nasce como RPC
- Views `vw_bai_eco_*` / `vw_bai_crm_*` são **all-time** (sem coluna de data) — não filtram período.
- O caminho que funciona já existe: RPCs `(p_org, p_start, p_end)` (`20260611140000_period_rpcs.sql`) chamadas via `fetch-client-data` com `rpc:`.
- **Regra:** widget que precisa de período → RPC. Migrar gradualmente os widgets que ainda apontam para views all-time.

---

## 🟡 P2 — ARQUITETURA ("o brinquedo novo": dados online × persistência)

### P2.1 — Histórico de movimentação de estágio (Kommo não guarda; nós precisamos guardar)
Hoje só existe o estágio atual (`stage_external_id`). Sem isso não dá para responder "lead foi pra reunião e voltou pro follow-up", nem "onde os leads empacam".

**Proposta:**
1. Tabela `crm_lead_stage_history` (`tenant_id, lead_external_id, from_stage, to_stage, occurred_at, source`).
2. Popular por **duas vias**: (a) na sync, diff do estágio atual vs último conhecido (detecta movimentação entre syncs); (b) eventos `lead_status_changed` do Kommo (`sync_service.py:236-247` já puxa eventos — estruturar em vez de guardar raw).
3. **Marco de corte explícito** por org: "histórico confiável a partir de `connected_at`" — não dá para reconstruir o passado pré-conexão (decisão da reunião).

### P2.2 — Snapshots: ligar o que já existe
- `bai_kpi_snapshots` (diário, pg_cron 03:30) ✔ funcionando.
- `crm_snapshots` (migration `20260506120000:165-176`) — **criada mas nunca preenchida**. Ligar na sync (gravar métricas por sync_run) ou dropar. Não deixar tabela zumbi.

### P2.3 — Filtro global de funil
- Dropdown por widget já existe (`FunnelWidget.tsx:138-148`). Falta o **filtro global** (todos os funis / A / B) no `GlobalFilterBar`/`FilterContext`, propagando para os widgets — pedido explícito da reunião (clientes com funil de prospecção + negociação + parceria…).

### P2.4 — Higienização de objetos órfãos (entrelaça com #41/#45 do TODO)
- Views por pessoa: `vw_linkedin_sdr_kpis_jaqueline` / `_renan` → generalizar por alias ou dropar.
- Legado Quitou: tabela `kommo_leads` + `qb_refresh_kommo_leads()` → migrar para o padrão `crm_leads` ou deprecar.
- `onboarding_requests`/`onboarding_steps` → confirmar se ainda em uso.
- Remover type `composio_connected_account_id` de `src/integrations/supabase/types.ts` na próxima migration.

### P2.5 — Próximos conectores (Pipedrive → Ploomes)
- O caminho é o F3 do TODO (`org_crm_stage_mappings`, `org_field_mappings` — populados na sync, confirmados na UI). Primeiro conector novo: **Pipedrive** (uso interno do Igor = cliente beta interno). Cada conector novo valida o padrão antes do próximo.

---

## 🟢 P3 — QUALIDADE / ESCALA

| Item | Estado | Ação |
|---|---|---|
| Testes | 7 testes (só mapper Kommo); sync/health/metrics/rotas = 0 | Smoke test da sync (mock API Kommo) + testes das RPCs de período + dos cálculos de KPI |
| CI | **Não existe** `.github/workflows/` | GitHub Actions mínimo: pytest + tsc + build front em PR |
| Stress | Nunca rodado ("com 100 clientes vai agachar") | k6/locust contra `fetch-client-data` + RPCs; medir antes de otimizar; cache (Redis) só se o número mandar |
| Working tree | ~43 arquivos modificados sem commit | Commitar em blocos lógicos (Composio removal / period RPCs / fixes de widget) |

---

## 🚫 Fora do escopo do BAI (anotar, não misturar)

Itens da reunião que são do **fluxo da Ecológica (brain/SDR Fernanda)**, não do código BAI:

1. Follow-up eterno: lead com 3 follow-ups sem resposta deve mover para **perdido** (+ funil de recuperação depois) — automação no brain/Kommo.
2. IA não responde após 21h / fins de semana → leads quentes perdidos (caso Luca) — regra de negócio da Ecológica a rediscutir com Cleriston.
3. Histórico de conversas do lead não persiste no fluxo da Fernanda — feature do ecologica-brain.
4. Campanhas liga/desliga (sem campanha coringa always-on) — recomendação de marketing (Igor).
5. Etapa "reunião realizada" no funil Kommo (operação manual) — setup do CRM do cliente.

---

## 🗓️ Ordem de ataque sugerida

1. **Commit do estado atual** (destravar tudo que já foi corrigido) — hoje.
2. **P0.1** — helper de auth compartilhado nas edge functions + membership check (1 dia). Junto: **P0.2** (rotação + scrub do git).
3. **P1.1–P1.3** — remover code paths de churn quebrados, achievement→crm_leads, view duração com "Sem informação" (1 dia).
4. **P1.4–P1.5** — nomenclatura das métricas + migrar widgets restantes para RPCs com período.
5. **P2.1–P2.2** — stage history + ligar/dropar crm_snapshots (design primeiro: 1 página, depois implementação).
6. **P2.3** — filtro global de funil.
7. **P3** — CI mínimo + smoke tests (em paralelo, qualquer brecha).
8. **P2.5** — conector Pipedrive sobre o F3 do TODO (depois que o Kommo estiver redondo).

> Des-hardcode (TODO.md F1–F5) continua como trilha paralela — F3 (CRM mapeável) é pré-requisito do P2.5.
