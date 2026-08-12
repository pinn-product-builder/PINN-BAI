# 🗺️ MAPA COMPLETO — tudo que precisa ser mexido (remover hardcode → multi-tenant)

> Cada fase lista: **🗄️ BANCO** (objetos a criar), **✏️ MODIFICAR** (arquivos + o que muda), **🆕 TELAS** (a construir).
> Detalhe do "por quê" em `docs/pinn-bai-hardcode-audit.md`. Plano/ordem em `TODO.md`.
> Legenda esforço: S(pequeno) M(médio) L(grande).

---

## 🧱 #41 — Baseline de schema  ·  EM ANDAMENTO
**🗄️ BANCO — versionar (drift, 27 objetos):**
- [x] views+funcs → `supabase/migrations/20260610180000_baseline_capture_drift_views_funcs.sql`
- [x] tabelas → `supabase/migrations/20260610180100_baseline_capture_drift_tables.sql`
- [ ] adicionar FKs/índices/RLS das tabelas capturadas (não vieram na reconstrução)
- [ ] generalizar depois (F3/F4): `vw_bai_eco_*`, `kommo_leads`, `qb_refresh_kommo_leads`
- [ ] generalizar (alias): `vw_linkedin_sdr_*_jaqueline` / `*_renan` (8 views por PESSOA)

---

## ⚠️ #40 — F0 SEGURANÇA (ação do Pedro)
**✏️ MODIFICAR:**
- `backend/.env` — tirar do histórico git + rotacionar service_role/anon/OpenAI/Maps
- `supabase/config.toml` — `project_id` via env
- `scripts/diag-arguto.py`, `scripts/deploy_vps_paramiko.py`, `scripts/seed-arguto*.mjs`, `scripts/ecologica-*.mjs` — refs/keys hardcoded → env/param
- `src/hooks/usePlatformUsers.ts`, `src/pages/admin/NewOrganization.tsx`, `src/components/onboarding/integrations/SupabaseIntegration.tsx`, `src/components/crm/CrmConnector.tsx` — URL/anon hardcoded → env
- `src/hooks/{useCustomerHealth,useGamification,useKpiGoals}.ts`, `src/pages/client/CrmAuditDashboard.tsx` — fallback `bai.srv879715...` → `VITE_BACKEND_URL` obrigatório
- `supabase/functions/{google-oauth-callback,test-supabase-connection}/index.ts` — refs/listas hardcoded

---

## 🟢 #42 — F1 GATING POR ORG (quick win)
**🗄️ BANCO:** `org_feature_flags`, `org_menu_visibility` · colunas em `organizations` (`org_type`, `is_demo_org`, `default_landing_path`, `ai_greeting`, `ai_questions`) · ativar `platform_settings`
**✏️ MODIFICAR:**
- `src/lib/featureFlags.ts` — **núcleo**: ARGUTO_ORG_ID, RFM_CHURN_ALLOWED_ORG_IDS, DEMO_ORG_IDS, PINN_PB_*, `window.__pinnActiveOrgSlug` → ler do DB (vira só fallback)  ·L
- `src/components/layouts/ClientLayout.tsx` — nav `onlyForSlugs/hideForSlugs/adminOnly/mockFeature` → `useOrgMenu`  ·M
- `src/App.tsx` — redirect `if(isArgutoOrg)` → `default_landing_path`  ·S
- `src/contexts/OrganizationBrandingContext.tsx` — expor `useOrgFeatures/useOrgMenu`  ·M
- `src/hooks/useIsPinnProductBuilderOrg.ts` — `%pinn%` name-match → flag DB  ·S
- consumidores de flag: `src/hooks/{useRfmChurnAnalysis,useIntegrations}.ts`, `src/pages/client/{Dashboard,Goals,Insights,CrmAuditDashboard}.tsx`, `src/components/ai/AIChat.tsx`  ·M
**🆕 TELAS:** `Admin → Org → Features & Navegação` (toggles) · `Admin → Geral` (trial/defaultPlan/supportEmail)

---

## 🟢 #43 — F2 PLANOS / RBAC / BRANDING
**🗄️ BANCO:** usar `plans` (existe) · `plan_features`, `plan_limits` (max_users/leads/widgets), `org_feature_entitlements` · `role` em `organization_users` · `organizations.settings.{pdf_branding,color_palette,number_format}`
**✏️ MODIFICAR:**
- `src/lib/mock-data.ts` — `planLimits`, `mockPlatformSettings` → tabelas  ·M
- `src/lib/plans.ts` — consolidar via `usePlans()`  ·S
- componentes c/ `planNames` duplicado: `.../ConfirmationStep.tsx`, `OrganizationsSettingsCard.tsx`, `GeneralSettingsCard.tsx`  ·M
- `src/components/layouts/ClientLayout.tsx` — "Plano Empresarial" fixo → plano da org  ·S
- `src/lib/report-generator.ts` — branding "PINN" fixo → `pdf_branding` (white-label)  ·M
- **backend**: enforcement de limite (RPC `check_org_lead_quota` + `POST /crm/sync`)  ·M
**🆕 TELAS:** `Admin → Planos` · `Admin → Org → Usuários & Papéis` · `Admin → Org → Branding`

---

## 🔑 #44 — F3 CRM MAPEÁVEL (a chave do multi-tenant)
**🗄️ BANCO:** `org_crm_stage_mappings` (external_stage_id→display/cor/ordem/tipo) · `org_field_mappings` (logical_field→source_field/target_metric/agg/format) · `org_funnel_stages` · `org_crm_loss_reasons` · estender `crm_connections.config` (email/phone field_code, opportunity_field_id) — populados na SYNC + confirmados na UI
**✏️ MODIFICAR (runtime lookup; consts viram fallback):**
- `src/components/dashboard/DashboardEngine.tsx` — CANONICAL_SERIES_ORDER, SERIES_COLOR_MAP, REFERENCE_MAPPINGS  ·L
- `src/components/dashboard/widgets/{AreaChartWidget,LineChartWidget}.tsx` — cores/labels por etapa  ·M
- `src/lib/stageNames.ts` — TECH_NAME_MAP  ·S  ·  `src/lib/referenceMappings.ts` — vira fallback  ·M  ·  `src/lib/crmAuditFromViews.ts`  ·M
- `backend/crm_auditor/modules/kommo/mapper.py` — EMAIL/PHONE field_code, won=1/lost=2  ·M
- `backend/adapters/kommo/adapter.py` — paginação/parse  ·S
- `supabase/functions/sync-kommo/index.ts` (parse subdomínio, mapeamento) · `sync-ploomes/index.ts` (Won/Lost, statusId 2/3) · `ai-data-chat/index.ts` (campos booleanos venda/reuniao)  ·M
- `backend/crm_auditor/modules/{ai/analysis_service,analytics/audit_dashboard_service}.py`  ·M
**🆕 TELAS:** `Setup CRM → Mapeamento de Etapas` · `Setup CRM → Mapeamento de Campos`

---

## 📊 #45 — F4 DASHBOARDS / DEMO DIRIGIDOS POR DADOS
**🗄️ BANCO:** `dashboard_templates` (org_id nullable=global) · `org_dashboard_instance_configs` · `widget_type_registry` · `organization_demo_data` · `column_label_translations`
**✏️ MODIFICAR / DEPRECAR:**
- `src/lib/afonsinaExactMapping.ts` + `afonsinaWidgetConfig.ts` — **deprecar** (35 mapeamentos → DB)  ·L
- `src/data/arguto-demo.ts` + `arguto-extra-demo.ts` (~67KB) — migrar pro DB  ·L
- hooks removerem branch `isDemoOrg`: `src/hooks/{useCustomerHealth,useKpiGoals,useUnitEconomics,useRfmChurnAnalysis,useDashboardLayout,useTemplates,useIntegrations}.ts`  ·M
- páginas demo: `src/pages/client/{Arguto,Dashboard,Goals,Insights,CrmAuditDashboard}.tsx`  ·M
- migrations de widget por cliente: `supabase/migrations/2026021714{3524,4127,5144}_*.sql` (+ Ecológica/BF) → template genérico  ·M
- generalizar dívida #41 (`vw_bai_eco_*`, `kommo_leads`/`qb_refresh`)  ·L
**🆕 TELAS:** `Admin → Templates de Dashboard` · `Admin → Org → Dados de Demo`

---

## ⚙️ #46 — F5 SCORING / IA / SCHEDULING POR ORG
**🗄️ BANCO (env=fallback, DB=override por org):** `org_health_config`, `org_alert_config`, `org_audit_config`, `org_kpi_config`, `org_churn_model`, `org_achievements`, `org_adapter_config`, `org_llm_config`, `dashboard_composition_templates`, `metric_definitions`, `org_webhook_config`, `org_email_defaults`
**✏️ MODIFICAR (carregar config por org_id):**
- `backend/core/health/service.py` — pesos 35/30/20/15, bandas  ·M
- `backend/core/kpi/{threshold_service,achievement_service}.py` — alertas 60/30/14d, achievements  ·M
- `backend/crm_auditor/core/config.py` — stuck_lead, engagement_pages  ·S
- `backend/crm_auditor/modules/analytics/metrics_service.py` — RFM, janela 30d  ·M
- `backend/crm_auditor/modules/{ai/prompts.py,ai/analysis_service.py}` — prompts fixos  ·M
- `backend/crm_auditor/modules/kommo/sync_service.py` + `router.py` — scheduling  ·M
- `supabase/functions/predict-churn/index.ts` — pesos 0.4/0.2, bandas 0.7/0.4  ·M
- `supabase/functions/compose-dashboard/index.ts` — SYSTEM_PROMPT ~180 linhas  ·L
- `supabase/functions/recommend-widgets/index.ts` — METRIC_SCORES/WEIGHTS  ·M
- `backend/main.py` — APScheduler ler `sync_config`  ·M
**🆕 TELAS:** `Admin → Org → Modelos & Scoring` · `Admin → IA/Recomendações` · `Admin → Org → Sync & Webhooks`

---

## 📇 ÍNDICE — arquivos tocados (por onde cada um entra)

**Frontend — lib/contexto/hooks**
- `src/lib/featureFlags.ts` → F1(núcleo)
- `src/lib/{plans,mock-data}.ts` → F2
- `src/lib/{referenceMappings,stageNames,crmAuditFromViews}.ts` → F3
- `src/lib/{afonsinaExactMapping,afonsinaWidgetConfig}.ts` → F4(deprecar)
- `src/lib/report-generator.ts` → F2(branding)
- `src/contexts/OrganizationBrandingContext.tsx` → F1(hub de config)
- `src/hooks/useIsPinnProductBuilderOrg.ts` → F1 · `usePlatformUsers.ts` → F0
- `src/hooks/{useCustomerHealth,useKpiGoals,useUnitEconomics,useRfmChurnAnalysis,useDashboardLayout,useTemplates,useIntegrations,useGamification}.ts` → F0/F1/F4

**Frontend — telas/componentes**
- `src/App.tsx` → F1 · `src/components/layouts/ClientLayout.tsx` → F1/F2
- `src/components/dashboard/DashboardEngine.tsx` → F3(núcleo) · `widgets/{AreaChartWidget,LineChartWidget}.tsx` → F3
- `src/components/ai/AIChat.tsx` → F1 · `src/components/crm/CrmConnector.tsx` → F0
- `src/components/onboarding/integrations/SupabaseIntegration.tsx` → F0
- `src/pages/admin/NewOrganization.tsx` → F0 · `src/pages/client/{Dashboard,Goals,Insights,Arguto,CrmAuditDashboard}.tsx` → F1/F4

**Backend (FastAPI)**
- `backend/.env` → F0 · `backend/main.py` → F5(scheduler)
- `backend/core/health/service.py`, `core/kpi/{threshold_service,achievement_service}.py` → F5
- `backend/crm_auditor/core/config.py`, `router.py`, `modules/kommo/{mapper,sync_service}.py`, `adapters/kommo/adapter.py` → F3/F5
- `backend/crm_auditor/modules/{ai/prompts,ai/analysis_service,analytics/metrics_service,analytics/audit_dashboard_service}.py` → F3/F5

**Edge functions (supabase/functions)**
- `sync-kommo`, `sync-ploomes`, `ai-data-chat` → F3
- `compose-dashboard`, `recommend-widgets`, `predict-churn` → F5
- `test-supabase-connection`, `google-oauth-callback` → F0

**Banco (migrations)**
- baseline drift: `20260610180000_*`, `20260610180100_*` (#41)
- widget por cliente: `2026021714{3524,4127,5144}_*` → F4
- **novas tabelas de config:** ~25 (F1–F5, ver cada fase)

**Config/infra**
- `supabase/config.toml` → F0 · `scripts/*` (diag/seed/ecologica) → F0

> **Resumo:** ~50 arquivos + ~25 tabelas novas + ~12 telas novas. Núcleos de maior impacto: `featureFlags.ts` (F1), `DashboardEngine.tsx` + `org_*_mappings` (F3), `compose-dashboard` (F5).
