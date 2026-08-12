# Pinn BAI — Plano de Trabalho: remover hardcode → multi-tenant via tela

> **Objetivo:** tirar tudo que é hardcoded por cliente (org IDs, slugs, mapeamentos de campo/etapa do CRM, flags, planos, prompts, scoring) e mover para **configuração no banco + telas dentro do BAI**. Meta: cliente novo = linhas de config, NÃO commit + redeploy.
>
> **Auditoria completa:** `docs/pinn-bai-hardcode-audit.md` — 79 achados (38 high · 27 med · 14 low) em 11 temas (A–K).
> **Fluxo:** desenvolver e **validar LOCAL** primeiro; só deployar o que estiver aprovado.

---

## ✅ Progresso (sessão 2026-06) — branch `chore/dehardcode-audit-onboarding`

8 commits, todos validados em localhost:8081 (headless) contra o banco cloud:

- **F1 — gating por org (#42): COMPLETO.** Migration `20260614120000_f1_org_gating.sql` (colunas `org_type`/`is_demo_org`/`default_landing_path` + tabelas `org_feature_flags`/`org_menu_visibility` + RLS + seed). featureFlags.ts lê do banco c/ fallback. Tela `Admin → Org → Features & Navegação` (`OrgFeaturesCard`). `Admin → Geral` já existia.
- **F4 — apresentação de etapas canônica: COMPLETO.** RPC `crm_stage_entries_daily` (migration `20260616120000`) + `DashboardEngine` pivota DB-driven. Removidos `CANONICAL_SERIES_ORDER` + labels de etapa do `SERIES_LABELS`. Widget legado migrado. (Funil já era DB-driven via `funnel_distribution`.)
- **#41 — RLS:** migration `20260617120000_rls_drift_tables.sql` habilita RLS em 5 tabelas sem (kommo_leads/dashboard_templates/onboarding_*/linkedin_sdr_aliases).
- **F2 — branding + RBAC: COMPLETO (escopo revisado).** Plano = só acompanhamento (sem enforcement; liberação de feature é a F1). PDF white-label (tira "PINN" do `report-generator`). RBAC fino: `permissions.ts` + `usePermissions` + `RequirePermission`; aplicado em `dashboard:edit` (Dashboard) e `data:edit`/`org:manage` (Import/Integrações/Settings). Sidebar mostra plano real.
- **fix:** import duplicado de `OnboardingWizard` que quebrava o dev server.

**Falta:** #41 (FKs/índices das tabelas capturadas; views `vw_linkedin_sdr_*` por-pessoa — feature em sunset); #45 resto (afonsina/arguto demo→DB, legado); #46 F5 (scoring/IA por org); #40 segurança (rotação de chaves — ação do Pedro).

---

## ▶️ Como rodar local (validação)

```bash
cd ~/PINN-BAI
npm run dev        # frontend Vite + HMR → http://localhost:8080  (conecta no Supabase CLOUD)
# Backend (quando uma feature precisar das rotas /api):
cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000
```

- Frontend lê `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` do `.env` → banco cloud `bkgwzxrutzmmxmxzfhmw`.
- Login de teste (cliente): `ecologica@pinnpb.com` / `123456`. Admin: `admin@pinnpb.com`.
- **HMR liga**: mudança no código aparece na hora em localhost:8080. Validamos aqui → aprova → deploy.

---

## ⚠️ F0 — SEGURANÇA (URGENTE · ação do Pedro · paralelo) — tarefa #40

O `.env` (com Supabase **service_role**, anon, OpenAI, Google Maps) está no **histórico do git** e o repo tem remote GitHub (`pinn-product-builder/PINN-BAI`).

- [ ] **Rotacionar** no Supabase: `service_role` + `anon`. Rotacionar OpenAI key, Google Maps key, projeto Mari.
- [ ] **Scrub do histórico:** `git filter-repo --path .env --invert-paths` (ou BFG) + `git push --force`.
- [ ] Confirmar se o repo do GitHub é **público ou privado** (muda a urgência).
- [ ] Garantir `.env` só em Secrets/Vault (já está gitignorado). `VITE_BACKEND_URL` obrigatório (sem fallback `bai.srv879715...`). `project_id` do `config.toml` via env.

---

## 🗺️ Roadmap (ordem de ataque)

### 🧱 #41 — Baseline de schema reproduzível  ·  EM ANDAMENTO
Tornar repo == banco antes de construir. Hoje 159 objetos no banco, **27 fora das migrations**.
- [x] Inventário do drift (27 objetos: 12 views, 8 funcs, 7 tabelas).
- [x] Captura views+funcs → `supabase/migrations/20260610180000_baseline_capture_drift_views_funcs.sql`.
- [x] Captura tabelas (colunas+PK) → `supabase/migrations/20260610180100_baseline_capture_drift_tables.sql`.
- [ ] Revisar/adicionar FKs, índices e RLS das tabelas capturadas (não incluídos na reconstrução).
- [ ] **Achado novo:** `vw_linkedin_sdr_*_jaqueline` / `*_renan` = hardcode POR PESSOA (8 views) → generalizar por alias (F1/F5).
- [ ] Política: todo objeto de DB de cliente nasce em `migrations/`; descoberta de schema genérica substitui listas hardcoded.

### 🟢 #42 — F1: Gating por org via DB  (QUICK WIN · alto impacto)
Mata os UUID/slug hardcoded de `featureFlags.ts` / `ClientLayout.tsx` / `App.tsx`.
- [ ] Tabelas: `org_feature_flags`, `org_menu_visibility` + colunas em `organizations` (`org_type`, `is_demo_org`, `default_landing_path`, `ai_greeting`, `ai_questions`).
- [ ] Hooks `useOrgFeatures(orgId)` / `useOrgMenu(orgId)` no `OrganizationBrandingContext`.
- [ ] Trocar leitura: `featureFlags.ts` (ARGUTO_ORG_ID, RFM_CHURN_ALLOWED_ORG_IDS, DEMO_ORG_IDS, PINN_PB_*), `ClientLayout.tsx` (hideForSlugs/onlyForSlugs/mockFeature), `App.tsx` (redirect) → ler do DB c/ fallback. Remover `window.__pinnActiveOrgSlug`.
- [ ] **Tela:** `Admin → Org → Features & Navegação` (toggles) + `Admin → Geral` (trialDays/defaultPlan/supportEmail via `platform_settings`).

### 🟢 #43 — F2: Planos/entitlements + RBAC + branding white-label
- [ ] Usar tabela `plans` existente (`usePlans()`) + `plan_features` + `org_feature_entitlements` + `plan_limits` (max_users/leads/widgets) + enforcement na API (`check_org_lead_quota`).
- [ ] RBAC: `role` em `organization_users` (member/org_admin/platform_admin) + `hasPermission()`.
- [ ] Branding: `organizations.settings.pdf_branding` (tira "PINN" fixo do `report-generator`), `color_palette`, `number_format`.
- [ ] **Telas:** `Admin → Planos`, `→ Usuários & Papéis`, `→ Branding`.

### 🔑 #44 — F3: CRM mapeável por org  (A CHAVE do multi-tenant de dados)
Mata os nomes de etapa/campo do Kommo/Ploomes hardcoded.
- [ ] Tabelas: `org_crm_stage_mappings` (external_stage_id→display/cor/ordem/tipo), `org_field_mappings` (logical_field→source_field), `org_funnel_stages`, `org_crm_loss_reasons`; estender `crm_connections.config` (email/phone field_code, opportunity_field_id).
- [ ] Popular na **sync** (lê stages/fields reais da API) + confirmar na UI.
- [ ] Runtime lookup: `DashboardEngine` (CANONICAL_SERIES_ORDER, SERIES_COLOR_MAP, REFERENCE_MAPPINGS), `AreaChart/LineChartWidget`, `stageNames.ts`, `mapper.py` (EMAIL/PHONE, won/lost), `sync-ploomes`, `ai-data-chat`. `referenceMappings.ts`/`data-profiler.ts` viram fallback.
- [ ] **Telas:** `Setup CRM → Mapeamento de Etapas` + `→ Mapeamento de Campos`.

### 📊 #45 — F4: Dashboards + demo data dirigidos por dados
- [ ] Tabelas: `dashboard_templates` (org_id nullable=global), `org_dashboard_instance_configs`, `widget_type_registry`, `organization_demo_data`, `column_label_translations`.
- [ ] **Deprecar** `afonsinaExactMapping.ts`/`afonsinaWidgetConfig.ts` (migrar 35 mapeamentos) + migrar `arguto-demo.ts`/`arguto-extra-demo.ts` (~67KB) pro DB + remover branch `isDemoOrg` dos hooks.
- [ ] **Generalizar a dívida #41:** `vw_bai_eco_*` + `kommo_leads`/`qb_refresh` (Quitou BR) → padrão único por `org_id` + config das tabelas acima.
- [ ] **Telas:** `Admin → Templates de Dashboard`, `→ Org → Dados de Demo`.

### ⚙️ #46 — F5: Scoring / IA / scheduling por org  (estrutural)
- [ ] Tabelas (env = fallback global, DB = override por org): `org_scoring_models`/`org_health_config`, `org_alert_config`, `org_audit_config`, `org_kpi_config`, `org_churn_model`, `org_achievements`, `org_adapter_config`, `org_llm_config`, `dashboard_composition_templates` (prompt por org), `metric_definitions`, `org_webhook_config`, `org_email_defaults`.
- [ ] Services (`health/service.py`, `metrics_service.py`, `threshold_service.py`, `predict-churn`, `recommend-widgets`, `compose-dashboard`) carregam config por `org_id`. APScheduler lê `sync_config`.
- [ ] **Telas:** `Admin → Org → Modelos & Scoring`, `→ IA/Recomendações`, `→ Sync & Webhooks`.

### 🔧 Pendência paralela — #39 Ecológica: widgets/dados (já no ar; refinar se preciso).

---

## ✅ Fluxo de trabalho
1. Construo a mudança **local** (DB via migration + código).
2. Subo/valido em **localhost:8080** (HMR).
3. Pedro aprova na tela.
4. **Só então** deploy (banco via migration aplicada; frontend via build/imagem com cuidado — manter rollback).
5. Todo objeto de banco nasce em `migrations/` (sem mais drift).

## 📚 Referências
- Auditoria: `docs/pinn-bai-hardcode-audit.md`
- Migrations de baseline: `supabase/migrations/20260610180000_*`, `..180100_*`
- Memória do projeto: visão geral + dívida em `project_overview.md` (auto-memória do Claude)
