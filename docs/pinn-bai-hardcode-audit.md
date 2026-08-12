# Auditoria de Hardcode — Pinn BAI

> Síntese de uma auditoria de 10 dimensões sobre o que está "preso no código" e bloqueia o multi-tenant.
> Objetivo: mapear o caminho de **tirar do código → botar na tela** (config dirigida por DB + UI de admin/org).
> Data: 2026-06-10 · Repo: `/Users/pedrohenrique/PINN-BAI`

---

## 1. Sumário executivo

### Estado da configurabilidade hoje
O Pinn BAI já tem **fundações boas mas inertes**: existem `organizations.settings` (JSONB), tabelas `plans`, `platform_settings`, `dashboard_data_sources`, `crm_auditor_connections.value_config`, `data_mappings` e as views genéricas `vw_bai_crm_*` (catálogo de campos, flatten de custom fields). O problema é que **essas estruturas não estão sendo usadas como fonte de verdade** — a lógica real de quem-vê-o-quê, como cada métrica é calculada, quais etapas/cores/labels aparecem e quais features estão ligadas vive em **constantes TypeScript, arrays de UUID/slug, `switch/case`, prompts de IA fixos e migrations específicas de cliente**.

O resultado prático: **cada novo cliente "especial" = commit + redeploy** (frontend e/ou edge), e em vários casos **migration SQL nova por cliente**. A escalabilidade é O(N clientes) em código, quando deveria ser O(1) código genérico + O(N) linhas de configuração no banco.

### Os maiores ofensores (o que mais trava o multi-tenant)

1. **Gating por org via UUID/slug hardcoded** — `ARGUTO_ORG_ID` ('b72718e7-…') aparece em 4+ arquivos; `RFM_CHURN_ALLOWED_ORG_IDS`, `DEMO_ORG_IDS`, `hideForSlugs:['ecologica-turismo-kommo']`, `onlyForSlugs:['arguto']`. Toda feature/menu/landing é decidida por allowlist em código (`featureFlags.ts`, `ClientLayout.tsx`, `App.tsx`).
2. **Mapeamentos de CRM presos ao Kommo/PT-BR** — nomes de etapa (`encaminhado`, `reuniao_confirmada`, `venda`), ordem do funil, cores hex, field_codes `EMAIL`/`PHONE`, `Won/Lost` do Ploomes — tudo fixo. Cliente com naming diferente quebra silenciosamente (DashboardEngine, AreaChartWidget, mapper.py, sync-ploomes, ai-data-chat).
3. **Presets de cliente "first class" no código** — `afonsinaExactMapping.ts` + `afonsinaWidgetConfig.ts` (35+ mapeamentos exatos de view/campo) e `arguto-demo.ts` + `arguto-extra-demo.ts` (~67 KB de fixtures). Próximo cliente "como Afonsina/Arguto" = novo arquivo.
4. **Lógica de scoring hardcoded no backend** — pesos do health score (35/30/20/15), thresholds de alerta (60/30/14 dias), penalidades de data quality, janela de KPI de 30 dias, modelo de churn (pesos 0.4/0.2/…, bandas 0.7/0.4) — todos `const`, não per-org (`backend/core/health/service.py`, `predict-churn`).
5. **Credenciais e endpoints hardcoded / em `.env` comitado** — Supabase URL+keys (anon **e service_role**), OpenAI key, Google Maps key, projeto Mari, backend `bai.srv879715.hstgr.cloud` como fallback. Risco de segurança **e** amarração a 1 instância.
6. **Planos/entitlements sem camada efetiva** — `planLimits` em `mock-data.ts`, sem enforcement no backend; tabela `plans` existe mas componentes leem maps hardcoded; label "Plano Empresarial" fixo no menu.
7. **Templates de dashboard como migration por cliente** — INSERT de widgets com `dashboard_id` e `org_id` fixos (Afonsina, Ecológica/BF Company UUID '2153eb97-…'), `dataSource` apontando para `vw_afonsina_*`/`kommo_leads_ecologica`.
8. **Dívida não versionada no banco** — tabelas/views de cliente (`kommo_leads_ecologica`, `katalogo_ecologica`, `ecologica_rag_chunks`, `vw_bai_eco_*`, `vw_afonsina_*`, e o `qb_refresh`/`kommo_leads` da Quitou BR) referenciadas em código mas **ausentes das migrations** → schema do repo ≠ schema da VPS.

---

## 2. Achados consolidados por tema

> Severidade: **High / Medium / Low**. Esforço: **S / M / L**.

### Tema A — Gating de org, features e menu (UUID/slug em código)
**O que está hardcoded:** `ARGUTO_ORG_ID`, `ARGUTO_ORG_SLUG`, `RFM_CHURN_ALLOWED_ORG_IDS`, `DEMO_ORG_IDS`, `PINN_PB_ORG_NAME_LIKE='%pinn%'` (pattern-matching de nome!), `window.__pinnActiveOrgSlug` como fallback frágil; `onlyForSlugs`/`hideForSlugs`/`adminOnly`/`mockFeature` nos itens de menu; redirect de landing `if (isArgutoOrg(orgId))`.
**Onde:** `src/lib/featureFlags.ts` (4, 10, 14-16, 27-29, 48-68, 101-134, 143), `src/components/layouts/ClientLayout.tsx` (53-88, 132-138), `src/App.tsx` (59-72), `src/hooks/useIsPinnProductBuilderOrg.ts`.
**Por que é problema:** novo cliente especial = PR + redeploy; UUID muda entre staging/prod; pattern de nome quebra com homônimos ("Pinn Help Center").
**Mecanismo proposto:**
- Colunas em `organizations`: `org_type` enum (`client|internal|demo`), `is_demo_org` bool, `default_landing_path` text.
- Tabela **`org_feature_flags`** (`org_id`, `feature_key`, `enabled`, `metadata jsonb`, `enabled_at`, `enabled_by`).
- Tabela **`org_menu_visibility`** (`org_id`, `menu_item_key`, `mode: show|hide|admin_only`, `sort_order`) — ou `organizations.settings.visible_modules`.
- Hooks `useOrgFeatures(orgId)` / `useOrgMenu(orgId)` lendo do `OrganizationBrandingContext`; `featureFlags.ts` vira só fallback default.
- **Tela:** `Admin → Organização → Features & Navegação` (toggles por feature/menu) + `Landing padrão`.
**Severidade: High · Esforço: M-L.**

### Tema B — RBAC granular (admin-only tudo-ou-nada)
**O que está hardcoded:** `adminOnly:true` em `crm-audit`/`crm-auditor` filtrado por `isPlatformAdmin`; não há "org_admin" (admin do cliente).
**Onde:** `ClientLayout.tsx` (82, 86, 132).
**Mecanismo proposto:** coluna `role` em `organization_users` (`member|org_admin|platform_admin`); `hasPermission(orgId,userId,key)`; navs filtram por permissão. **Tela:** `Admin → Org → Usuários & Papéis`.
**Severidade: Medium · Esforço: L.**

### Tema C — Dados de demo / fixtures por cliente em arquivos TS
**O que está hardcoded:** `arguto-demo.ts` + `arguto-extra-demo.ts` (`ARGUTO_CLIENTS`, `HERO_KPIS`, `DEMO_HEALTH_SCORES`, `DEMO_KPI_GOALS`, `DEMO_UNIT_ECONOMICS`, `DEMO_RFM_PERSISTED_LEADS`, `ROI_BASELINE`, greetings do AIChat). Hooks retornam mock se `isDemoOrg(orgId)`.
**Onde:** `src/data/arguto-demo.ts`, `src/data/arguto-extra-demo.ts`, `src/hooks/useCustomerHealth.ts` (27,53), `useKpiGoals.ts` (51,110,181), `useUnitEconomics.ts` (43), `src/pages/client/Dashboard.tsx` (41-50), `src/components/ai/AIChat.tsx` (43-60,147-150).
**Por que é problema:** próximo cliente demo = novo arquivo; fixtures desatualizam quando a UI muda; UI acoplada a 400+ linhas de dados.
**Mecanismo proposto:** tabela **`organization_demo_data`** (`org_id`, `data_type enum`, `data jsonb`) **ou** seed real em `crm_contacts`/`unit_economics_snapshots` com `org_id`. Hooks fazem query; remover branch `isDemoOrg`. Colunas `ai_greeting`/`ai_questions` em `organizations` (ou reusar `ai_prompts`). **Tela:** `Admin → Org → Dados de Demo` (upload de fixtures).
**Severidade: High (acoplamento) · Esforço: M-L.**

### Tema D — Mapeamento de CRM (etapas, campos, stage→métrica)
**O que está hardcoded:** `CANONICAL_SERIES_ORDER`/`SERIES_COLOR_MAP` com nomes de etapa Kommo + cores hex; `TECH_NAME_MAP` (`new→Novos`…); field_codes `EMAIL`/`PHONE` e stage type `won=1/lost=2` no mapper; `Won/Lost`/`statusId 2/3` do Ploomes; campos booleanos `venda`/`desqualificado`/`reuniao_*` em `ai-data-chat`; `REFERENCE_MAPPINGS` (regex PT-BR) e `data-profiler` (`/sale|venda|revenue/`).
**Onde:** `DashboardEngine.tsx` (165-174, 965-984), `widgets/AreaChartWidget.tsx` (41-94), `LineChartWidget.tsx` (44-51), `src/lib/stageNames.ts` (14-25), `src/lib/referenceMappings.ts` (35-244), `src/lib/data-profiler.ts`, `backend/crm_auditor/modules/kommo/mapper.py` (12-30, 212-233, 312-325), `supabase/functions/sync-ploomes/index.ts` (248, 305), `ai-data-chat/index.ts` (146-216), `calculate-dashboard-metrics/index.ts` (80-141).
**Por que é problema:** cada cliente nomeia etapas livremente; naming diferente → widget vazio/funil fora de ordem; field_code ausente → contato sem telefone.
**Mecanismo proposto:**
- **`org_crm_stage_mappings`** (`org_id`, `external_stage_id`, `display_name`, `color`, `sort_order`, `stage_type`) — populada na sincronização lendo os stages reais da API.
- **`org_field_mappings`** (`org_id`, `provider`, `logical_field`, `source_field_name`, `target_metric_id`, `aggregation`, `format`) — descoberta automática no onboarding + confirmação na UI.
- `crm_connections.config` ganha `email_field_code`/`phone_field_code`/`opportunity_field_id` (este já existe em `value_config`).
- DashboardEngine/widgets fazem lookup em runtime; `referenceMappings.ts`/`data-profiler.ts` viram **fallback**.
- **Tela:** `Setup CRM → Mapeamento de Etapas` (campo origem → stage_type/cor/ordem) e `→ Mapeamento de Campos` (dropdown descoberto via API).
**Severidade: High · Esforço: M (cada), L no total.**

### Tema E — Templates de dashboard e binding de widget
**O que está hardcoded:** templates org-specific em migration (org_id Afonsina/Ecológica, `dashboard_id` '2153eb97-…'); `afonsinaExactMapping.ts`/`afonsinaWidgetConfig.ts` (viewName/metricField); `dataSource:'vw_dashboard_kpis_30d_v3'` em config de widget. O template genérico "Visão Executiva Premium" (`targetMetric`) existe mas **não há onde persistir a resolução** por org.
**Onde:** `migrations/20260217145144_*.sql`, `20260306134214_*.sql`, `20260211000000_*.sql`, `20260317113048_*.sql`; `src/lib/afonsina*.ts`; `src/hooks/useTemplates.ts` (656-668).
**Mecanismo proposto:**
- **`dashboard_templates`** (`template_key`, `name`, `widgets jsonb`, `org_id` nullable=global) + **`org_dashboard_instance_configs`** (`org_id`, `dashboard_id`, `widget_id`, `resolved_dataSource`, `resolved_metricField`, `resolved_aggregation`).
- `applyTemplate()` grava a resolução; DashboardEngine lê dali em vez de heurística.
- **Deprecar** `afonsina*.ts` migrando seus 35 mapeamentos para `dashboard_templates`/`org_field_mappings` via seed.
- **Tela:** `Admin → Templates de Dashboard` (CRUD) + step de onboarding "mapear campos".
**Severidade: High · Esforço: L.**

### Tema F — Widgets: tipos, cores, labels, formatação, defaults de render
**O que está hardcoded:** `widget_type` ENUM (novo tipo = migration+componente); `EXTENDED_COLORS`; `DEFAULT_LABEL_MAP`/labels PT-BR; defaults `showTrend/showSparkline/animate/curveType/gradientFill/innerRadius`; formato de número/moeda fixo; regras de dedup; prioridade de métrica; branding fixo "PINN" no PDF.
**Onde:** `migrations/20260203142931_*.sql`, `WidgetEditorDialog.tsx` (42, 277-292), `AreaChartWidget.tsx` (55-94), `MetricCard.tsx` (38-95), `recommend-widgets/index.ts` (34-148, 231-340, 449-501), `suggest-mappings/index.ts` (525-536), `src/lib/report-generator.ts` (30, 48-94).
**Mecanismo proposto:**
- **`widget_type_registry`** (`slug`, `component_name`, `org_id` nullable).
- `organizations.settings`: `color_palette`, `widget_render_defaults`, `number_format`, `metric_priority`, `pdf_branding` (logo/cores/footer — white-label), `stage_name_overrides`.
- **`column_label_translations`** (`org_id`, `column_name`, `language`, `label`) para i18n.
- **Tela:** `Admin → Configuração de Dashboards` (aba Aparência/Branding/Formatação).
**Severidade: Medium (cores/labels/format), High (branding PDF para white-label) · Esforço: S-M.**

### Tema G — Edge functions de IA com prompts/catálogos fixos
**O que está hardcoded:** `SYSTEM_PROMPT` (~180 linhas) do `compose-dashboard` com catálogo de 8 widgets e regras genéricas; `METRIC_SCORES`/`WIDGET_DESCRIPTIONS`/`WEIGHTS` do `recommend-widgets`; `ROUTE_LABELS` PT; filtro fixo `org_id/tenant_id/id` no schema discovery; funil fixo `['Leads','Qualificados',…]`.
**Onde:** `compose-dashboard/index.ts` (64, 140-182), `recommend-widgets/index.ts` (34-148, 449), `ai-data-chat/index.ts` (908-927), `useWidgetRecommendations.ts` (258).
**Mecanismo proposto:** **`dashboard_composition_templates`** (`org_id`, `system_prompt`, `widget_count_min/max`, `required_metric_types`, `language`) + **`metric_definitions`** (`org_id` nullable, `target_metric`, `widget_type`, `base_score`, `format`, `description_pt/en`). Edges consultam por `org_id` antes de montar. `org_funnel_stages` para o funil. **Tela:** `Admin → IA/Recomendações` (avançado).
**Severidade: High (prompt/scores travam vertical) · Esforço: L.**

### Tema H — Scoring e thresholds no backend (per-instância, não per-org)
**O que está hardcoded:** health score 35/30/20/15, bandas 80/60/40, `_RFM_SEGMENT_LOYALTY`, recência 2pts/dia, freq 15pts, monetário 50k; alertas 60/30/14 dias; penalidades de data quality (35/20/15/10/5); achievements (100 leads, CTR 5, ROAS 3x, CPL 50); janela KPI 30d; modelo de churn (pesos 0.4/0.2/…, bandas 0.7/0.4); paginação Kommo 250/999; stuck-lead e engagement-pages só via env (global).
**Onde:** `backend/core/health/service.py` (27-43, 105, 217-297), `backend/crm_auditor/modules/analytics/metrics_service.py` (253-289, 688), `backend/core/kpi/threshold_service.py` (30-33, 191), `achievement_service.py` (47, 82-89), `predict-churn/index.ts` (93-114), `adapters/kommo/adapter.py` (128-130), `crm_auditor/core/config.py` (34-36).
**Por que é problema:** B2B de ciclo longo quer stuck-lead=45 e janela 90d; e-commerce quer 3d; SaaS prioriza receita, serviços priorizam engajamento. Thresholds uniformes geram alert fatigue e insights errados.
**Mecanismo proposto (env = fallback global, DB = override por org):**
- **`org_scoring_models`**/`org_health_config` (pesos, decay, thresholds, bandas).
- **`org_alert_config`** (dias no-activity, bandas de churn, deal stalled).
- **`org_audit_config`** (penalidades, stuck_lead_days, engagement_max_pages).
- **`org_kpi_config`** (lookback_days, ads_sync_lookback_days).
- **`org_churn_model`** (janelas, baselines, pesos jsonb, bandas).
- **`org_achievements`** (`criteria_json`, `enabled`).
- **`org_adapter_config`** (`batch_size`, `max_pages`, `timeout`).
- **`org_llm_config`** (`provider`, `model`, `base_url`, `api_key`) — hoje `OPENAI_MODEL` é global.
- Services carregam config por `org_id` no `__init__`. **Tela:** `Admin → Org → Modelos & Scoring` (sliders).
**Severidade: High (scoring/alertas/churn), Medium (paginação/LLM) · Esforço: M.**

### Tema I — Credenciais, endpoints e project refs (segurança + amarração)
**O que está hardcoded:** Supabase URL+anon key no frontend (`usePlatformUsers.ts`, `NewOrganization.tsx`); anon **e service_role** + URL em `scripts/diag-arguto.py` e `.env` comitado; `OPENAI_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY`; projeto Mari (`cyavnqsrptrkciiqtqyb`); backend fallback `https://bai.srv879715.hstgr.cloud` em 5 hooks; `project_id` em `supabase/config.toml`; endpoint Cold Mail Hackers default; API versions Meta v20.0 / Google v17; `PLOOMES_BASE`; Composio endpoint; parse de subdomínio `.kommo.com`.
**Onde:** `src/hooks/usePlatformUsers.ts` (17-19), `pages/admin/NewOrganization.tsx` (98-99), `scripts/diag-arguto.py` (35-38), `.env` (2-17), `useCustomerHealth.ts` (14) e similares, `onboarding/integrations/ApiIntegration.tsx` (31), `supabase/config.toml` (1), `sync-paid-traffic/index.ts` (35, 121), `sync-ploomes/index.ts` (9, 62-70), `sync-kommo/index.ts` (260-313).
**Por que é problema:** **service_role no repo = banco comprometido se vazar**; tudo amarrado a 1 instância Supabase/1 backend; impossível rotacionar chaves ou isolar tenants.
**Mecanismo proposto:**
- **URGENTE:** tirar chaves do `.env` comitado → Secrets do deploy/Vault; `VITE_BACKEND_URL` obrigatório (sem fallback hardcoded); `project_id` via `SUPABASE_PROJECT_ID`. **Nunca** prefixar segredo de servidor com `VITE_`.
- **`org_external_credentials`** / `org_integrations` (`org_id`, `provider`, `config_json`, `status`) para Maps/OpenAI/Mari/CMH; hooks `useExternalCredential(provider)`.
- API versions → env (`FACEBOOK_API_VERSION`, `GOOGLE_ADS_API_VERSION`); base URLs de provider → `crm_auditor_connections.credentials` (guardar `base_url` completo, não só subdomínio).
- **Tela:** `Admin → Integrações` (por provider, por org).
**Severidade: High · Esforço: M.**

### Tema J — Planos, limites e entitlements
**O que está hardcoded:** `planLimits` (3/10/25/-1 usuários, "Até 1.000 leads"…) em `mock-data.ts`; `mockPlatformSettings.defaultPlan=2`, `trialDays=14`, `supportEmail`; maps `planNames` duplicados em vários componentes (tabela `plans` existe, **não é usada**); label "Plano Empresarial" fixo; **sem enforcement de limite no backend** (sync ilimitado).
**Onde:** `src/lib/mock-data.ts` (262-298), `ConfirmationStep.tsx` (20-25), `OrganizationsSettingsCard.tsx` (187-190), `GeneralSettingsCard.tsx` (65-66), `ClientLayout.tsx` (257-259), `featureFlags.ts` (122-134).
**Mecanismo proposto:**
- Usar a tabela `plans` existente via `usePlans()`; **`plan_features`** + **`org_feature_entitlements`** + **`plan_limits`** (`max_users`, `max_leads`, `max_widgets`).
- RPC `check_org_lead_quota(org_id)` + validação na API `POST /crm/sync`; UI mostra "3.200 / 10.000 leads".
- `platform_settings` (migration `20260514080000` já existe) para `defaultPlan`/`trialDays`/`supportEmail`.
- **Tela:** `Admin → Planos` (CRUD nomes/limites/entitlements) + barra de quota no cliente.
**Severidade: High · Esforço: L.**

### Tema K — Sync scheduling e webhooks
**O que está hardcoded:** pg_cron fixo (scheduler Python ignora `sync_config.frequency_minutes`); webhook timeout 10s sem retry; email outreach defaults na migration (daily_limit 50, tz São Paulo, send_window).
**Onde:** `migrations/20260522150000_sync_crm_pg_cron.sql`, `backend/main.py` (310-340), `threshold_service.py` (191), `migrations/20260514150000_email_outreach_init.sql` (38-90).
**Mecanismo proposto:** APScheduler lendo `sync_config` por connection; **`org_webhook_config`** (timeout/retries/backoff); **`org_email_defaults`** (tz/send_window/daily_limit). **Tela:** `Admin → Org → Sincronização & Webhooks`.
**Severidade: Medium · Esforço: S-L.**

---

## 3. Roadmap "tirar do código → botar na tela"

### Fase 0 — Segurança (faça já, antes de tudo)
- Rotacionar e remover do `.env` comitado: Supabase `service_role`/anon, OpenAI, Google Maps, Mari. Mover para Secrets/Vault; adicionar `.env` ao `.gitignore`, manter só `.env.example`.
- `VITE_BACKEND_URL` obrigatório no build; `project_id` via env no `config.toml`; `diag-arguto.py` parametrizado (`--org-id`).
- **Constrói:** nada de UI ainda — pipeline de Secrets. **Risco se adiar:** banco exposto.

### Fase 1 — Quick wins (alto impacto / baixo esforço) — gating sem dados
- **Tabelas:** colunas em `organizations` (`org_type`, `is_demo_org`, `default_landing_path`, `ai_greeting`, `ai_questions`); **`org_feature_flags`**; **`org_menu_visibility`**; `platform_settings` ativa.
- **Telas:** `Admin → Org → Features & Navegação` (toggles de menu/feature + landing); `Admin → Geral` (trialDays/defaultPlan/supportEmail).
- **Substitui:** `featureFlags.ts` allowlists, `ClientLayout` slugs, `App.tsx` redirect, `isArgutoOrg/isDemoOrg/PINN_PB_*` → leitura de DB (fallback default). Remove `window.__pinnActiveOrgSlug`.
- **Resolve temas:** A, parte de F (greetings), J (settings).

### Fase 2 — Planos, RBAC e branding white-label
- **Tabelas:** `plan_features`, `org_feature_entitlements`, `plan_limits`; `role` em `organization_users`; `organizations.settings.pdf_branding`/`color_palette`/`number_format`.
- **Telas:** `Admin → Planos` (usar `plans` existente via `usePlans()`); `Admin → Org → Usuários & Papéis`; `Admin → Org → Branding`.
- **Substitui:** maps `planNames`, `mock-data.ts` planLimits, "Plano Empresarial" fixo, "PINN" no PDF.
- **Resolve temas:** B, J, parte de F.

### Fase 3 — CRM mapeável (a chave do multi-tenant de dados)
- **Tabelas:** `org_crm_stage_mappings`, `org_field_mappings`, `org_funnel_stages`, `org_crm_loss_reasons`, `org_field_labels`; estender `crm_connections.config` (email/phone field_code, opportunity_field_id).
- **Telas:** `Setup CRM → Mapeamento de Etapas` e `→ Mapeamento de Campos` (descoberta via API + confirmação).
- **Substitui:** `CANONICAL_SERIES_ORDER`, `SERIES_COLOR_MAP`, `TECH_NAME_MAP`, field_codes do mapper, `Won/Lost` Ploomes, campos booleanos em ai-data-chat. `referenceMappings`/`data-profiler` viram fallback.
- **Resolve temas:** D, parte de F (cores/labels via stage mapping).

### Fase 4 — Dashboards e demo data dirigidos por dados
- **Tabelas:** `dashboard_templates`, `org_dashboard_instance_configs`, `widget_type_registry`, `organization_demo_data`, `column_label_translations`.
- **Telas:** `Admin → Templates de Dashboard`; `Admin → Org → Dados de Demo`; step de onboarding "mapear campos".
- **Substitui:** `afonsina*.ts` (deprecar), `arguto-demo.ts`/`arguto-extra-demo.ts` (migrar p/ DB), migrations de widget por cliente.
- **Resolve temas:** C, E, F.

### Fase 5 — Estrutural: scoring/IA por org + scheduling
- **Tabelas:** `org_scoring_models`, `org_alert_config`, `org_audit_config`, `org_kpi_config`, `org_churn_model`, `org_achievements`, `org_adapter_config`, `org_llm_config`, `dashboard_composition_templates`, `metric_definitions`, `org_webhook_config`, `org_email_defaults`; APScheduler lendo `sync_config`.
- **Telas:** `Admin → Org → Modelos & Scoring`; `Admin → IA/Recomendações`; `Admin → Org → Sincronização & Webhooks`.
- **Substitui:** consts em `service.py`/`metrics_service.py`/`predict-churn`, `SYSTEM_PROMPT`, `METRIC_SCORES`, pg_cron fixo.
- **Resolve temas:** G, H, K.

---

## 4. Dívida recente — lógica por-cliente direto no banco (não versionada)

Esta é a dívida **mais perigosa** porque é invisível ao repo: objetos foram criados direto no Postgres de produção (VPS) e/ou via scripts soltos (`scripts/ecologica-*.mjs`), sem migration. O schema do repo **não reproduz** o ambiente real.

**Objetos suspeitos (referenciados em código/migrations mas ausentes de `migrations/`):**
- **Ecológica:** `kommo_leads_ecologica`, `katalogo_ecologica`, `ecologica_rag_chunks`, views `vw_bai_eco_*`; dashboard `2153eb97-a66e-4781-a108-68def9a92c3d` (BF Company); funil "Hermes" (`hermes_entrada`, `disparo_feito`, `hermes_encaminhado`…) embutido em `dashboard_widgets.config`.
- **Afonsina:** `vw_afonsina_custos_funil_dia`, `vw_dashboard_kpis_30d_v3`, `vw_kommo_msg_in_daily_60d_v3`, `v3_calls_daily_v3` etc. — listadas em `test-supabase-connection/index.ts` (200-261, ~70 nomes) mas sem DDL versionado.
- **Quitou BR:** a tabela `kommo_leads` consumida por `ai-data-chat` e o objeto/rotina `qb_refresh` (refresh por funil PF/CNPJ) — lógica por-cliente criada fora das migrations, não genérica.

**Por que é grave:** não é reproduzível, reverível nem auditável; um dev novo não sobe o ambiente; mudanças não deixam rastro git; e a lógica é específica de cliente, não um molde reutilizável.

**Ação recomendada:**
1. **Audit:** `pg_dump --schema-only` da VPS para Ecológica/Afonsina/Quitou; diff contra `supabase/migrations/`.
2. **Versionar** o que for legítimo como migrations genéricas (parametrizadas por `org_id`), não com nomes de cliente embutidos.
3. **Generalizar:** substituir `kommo_leads_ecologica`/`vw_afonsina_*`/`qb_refresh` por padrão único (`crm_leads` + `org_id`) + as tabelas de config das fases 3-4; mover scripts `.mjs` ad-hoc para edge functions/migrations versionadas.
4. **Política:** "todo objeto de DB de cliente nasce em `migrations/`; descoberta de schema (genérica) substitui listas hardcoded de tabelas".

**Severidade: High · Esforço: L** (audit + reescrita de schema multi-tenant).

---

### Apêndice — contagem de achados por severidade

| Severidade | Qtd |
|---|---|
| High | 38 |
| Medium | 27 |
| Low | 14 |
| **Total** | **79** |

> Os 79 achados das 10 dimensões consolidam em **11 temas** (A–K). A maior alavanca de curto prazo é a **Fase 1 (gating por DB)** + **Fase 0 (segurança)**; a maior alavanca estrutural é a **Fase 3 (CRM mapeável)** que destrava o multi-tenant de dados de verdade.
