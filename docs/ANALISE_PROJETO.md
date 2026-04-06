# Análise Completa - Pinn Insights Hub

## 📋 Visão Geral

O **Pinn Insights Hub** é uma plataforma SaaS de Business Intelligence (BI) e Analytics multi-tenant, desenvolvida para fornecer dashboards personalizáveis, gestão de leads (CRM), e insights baseados em IA para organizações.

**Tipo de Projeto:** Plataforma B2B SaaS Multi-tenant  
**Stack Principal:** React 18 + TypeScript + Vite + Supabase  
**Arquitetura:** Frontend SPA + Backend-as-a-Service (Supabase)

---

## 🏗️ Arquitetura do Sistema

### Frontend
- **Framework:** React 18.3.1 com TypeScript
- **Build Tool:** Vite 5.4.19
- **Roteamento:** React Router DOM v6.30.1
- **State Management:** 
  - TanStack React Query v5.83.0 (server state)
  - Context API (AuthContext, ThemeContext)
- **UI Framework:** 
  - TailwindCSS 3.4.17
  - shadcn/ui (componentes baseados em Radix UI)
  - 49 componentes UI customizados

### Backend (Supabase)
- **Banco de Dados:** PostgreSQL (via Supabase)
- **Autenticação:** Supabase Auth
- **Edge Functions:** 10 funções serverless (TypeScript/Deno)
- **Realtime:** Supabase Realtime subscriptions
- **Storage:** Supabase Storage (para arquivos)

### Integrações Suportadas
1. **Supabase** - Conexão direta com outro projeto Supabase
2. **Google Sheets** - Sincronização de planilhas
3. **CSV** - Upload e importação de arquivos
4. **API Externa** - Conexão com APIs REST (GET/POST)

---

## 📁 Estrutura de Diretórios

```
pinn-insights-hub/
├── src/
│   ├── pages/
│   │   ├── admin/          # Páginas administrativas (platform_admin)
│   │   │   ├── GlobalHQ.tsx           # Dashboard consolidado
│   │   │   ├── Organizations.tsx      # Lista de organizações
│   │   │   ├── OrganizationDetail.tsx # Detalhes da organização
│   │   │   ├── NewOrganization.tsx    # Criação de organização
│   │   │   ├── Templates.tsx          # Templates de dashboard
│   │   │   ├── CustomMetrics.tsx      # Métricas customizadas
│   │   │   ├── Users.tsx              # Gestão de usuários
│   │   │   ├── Activity.tsx           # Logs de atividade
│   │   │   └── Settings.tsx           # Configurações da plataforma
│   │   ├── client/         # Páginas do cliente (multi-tenant)
│   │   │   ├── Dashboard.tsx          # Dashboard principal
│   │   │   ├── CRM.tsx                # Kanban de leads
│   │   │   ├── Import.tsx             # Importação de dados
│   │   │   ├── Datasets.tsx           # Gestão de datasets
│   │   │   ├── Insights.tsx           # Insights gerados por IA
│   │   │   ├── Users.tsx              # Usuários da organização
│   │   │   └── Settings.tsx           # Configurações da org
│   │   ├── Login.tsx
│   │   └── NotFound.tsx
│   ├── components/
│   │   ├── admin/          # Componentes administrativos
│   │   ├── ai/             # Componentes de IA (chat, insights)
│   │   ├── auth/           # ProtectedRoute, RoleGuard
│   │   ├── connectors/     # Diálogos de conexão
│   │   ├── dashboard/      # Engine de dashboard + widgets
│   │   │   ├── DashboardEngine.tsx    # Motor principal
│   │   │   └── widgets/               # 8 tipos de widgets
│   │   │       ├── MetricCard.tsx
│   │   │       ├── AreaChartWidget.tsx
│   │   │       ├── BarChartWidget.tsx
│   │   │       ├── LineChartWidget.tsx
│   │   │       ├── PieChartWidget.tsx
│   │   │       ├── FunnelWidget.tsx
│   │   │       ├── TableWidget.tsx
│   │   │       └── InsightCard.tsx
│   │   ├── layouts/        # AdminLayout, ClientLayout
│   │   ├── onboarding/     # Wizard de onboarding (15 componentes)
│   │   ├── settings/       # MetricBuilder
│   │   └── ui/             # 49 componentes shadcn/ui
│   ├── contexts/
│   │   ├── AuthContext.tsx    # Autenticação e roles
│   │   └── ThemeContext.tsx   # Tema dark/light
│   ├── hooks/              # 13 custom hooks
│   │   ├── useIntegrations.ts
│   │   ├── useDashboard.ts
│   │   ├── useLeads.ts
│   │   ├── useOrganizations.ts
│   │   ├── useExternalData.ts
│   │   ├── useDataMappings.ts
│   │   ├── useTemplates.ts
│   │   ├── useWidgetRecommendations.ts
│   │   └── ...
│   ├── lib/
│   │   ├── types.ts            # Tipos TypeScript principais
│   │   ├── data-modeler.ts     # Modelagem de dados
│   │   ├── data-profiler.ts    # Análise de dados
│   │   ├── report-generator.ts # Geração de PDFs
│   │   ├── mock-data.ts        # Dados mockados
│   │   └── utils.ts            # Utilitários
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts       # Cliente Supabase
│   │       └── types.ts        # Tipos gerados do DB
│   └── main.tsx
├── supabase/
│   ├── migrations/         # 5 migrações SQL
│   │   ├── 20260203142931_*.sql  # Schema base (ENUMs, tabelas core)
│   │   ├── 20260203142945_*.sql  # Tabelas de dashboard
│   │   ├── 20260204163438_*.sql  # Tabelas de leads
│   │   ├── 20260204200507_*.sql  # RLS policies
│   │   └── 20260205134810_*.sql  # Índices e otimizações
│   └── functions/          # 10 Edge Functions
│       ├── ai-data-chat/
│       ├── calculate-dashboard-metrics/
│       ├── create-org-admin/
│       ├── fetch-client-data/
│       ├── fetch-google-sheets/
│       ├── recommend-widgets/
│       ├── suggest-mappings/
│       ├── suggest-tables/
│       ├── sync-external-api/
│       └── test-supabase-connection/
└── public/
    └── pinn-logo.svg
```

---

## 🗄️ Schema do Banco de Dados

### Tabelas Principais

#### 1. **organizations** (Multi-tenancy)
- `id` (UUID, PK)
- `name`, `slug` (único)
- `plan` (1-4)
- `status` (active/suspended/trial)
- `logo_url`, `primary_color`, `secondary_color`
- `custom_domain` (white-label)
- `admin_name`, `admin_email`
- `settings` (JSONB)

#### 2. **profiles** (Usuários)
- `id` (UUID, PK)
- `user_id` (FK → auth.users)
- `org_id` (FK → organizations, nullable)
- `full_name`, `avatar_url`, `email`

#### 3. **user_roles** (RBAC)
- `id` (UUID, PK)
- `user_id` (FK → auth.users)
- `role` (platform_admin | client_admin | analyst | viewer)

#### 4. **integrations** (Conexões de Dados)
- `id` (UUID, PK)
- `org_id` (FK → organizations)
- `name`, `type` (supabase/google_sheets/csv/api)
- `status` (pending/connected/error/syncing)
- `config` (JSONB - configuração específica por tipo)
- `last_sync_at`, `sync_error`

#### 5. **selected_tables** (Tabelas Selecionadas)
- `id` (UUID, PK)
- `integration_id` (FK → integrations)
- `table_name`
- `selected_columns` (TEXT[])
- `column_types` (JSONB)
- `is_primary` (boolean)
- `row_count`, `sample_data` (JSONB)

#### 6. **data_mappings** (Mapeamento de Dados)
- `id` (UUID, PK)
- `org_id` (FK → organizations)
- `integration_id` (FK → integrations)
- `source_table`, `source_column`
- `target_metric` (ex: total_leads, revenue, etc.)
- `transform_type`, `transform_config` (JSONB)

#### 7. **dashboards** (Dashboards)
- `id` (UUID, PK)
- `org_id` (FK → organizations)
- `name`, `description`
- `is_default` (boolean)
- `layout` (JSONB - grid layout)
- `filters` (JSONB)

#### 8. **dashboard_widgets** (Widgets)
- `id` (UUID, PK)
- `dashboard_id` (FK → dashboards)
- `type` (metric_card | area_chart | bar_chart | line_chart | pie_chart | funnel | table | insight_card)
- `title`, `description`
- `config` (JSONB - configuração do widget)
- `position` (ordem)
- `size`, `is_visible`

#### 9. **leads** (CRM)
- `id` (UUID, PK)
- `org_id` (FK → organizations)
- `integration_id` (FK → integrations, nullable)
- `external_id` (ID no sistema externo)
- `name`, `email`, `phone`, `company`
- `source` (google_ads | linkedin | referral | organic | email | other)
- `status` (new | qualified | in_analysis | proposal | converted | lost)
- `value` (número - valor do lead)
- `metadata` (JSONB)
- `converted_at`

#### 10. **activity_logs** (Auditoria)
- `id` (UUID, PK)
- `org_id`, `user_id` (nullable)
- `action` (string)
- `entity_type`, `entity_id` (nullable)
- `details` (JSONB)
- `ip_address`

#### 11. **saved_metrics** (Métricas Customizadas)
- `id` (UUID, PK)
- `org_id` (FK → organizations)
- `name`, `description`
- `formula` (JSONB - fórmula de cálculo)
- `target_metric` (enum)

#### 12. **templates** (Templates de Dashboard)
- `id` (UUID, PK)
- `name`, `description`
- `category`
- `widgets` (JSONB - array de widgets pré-configurados)
- `is_public` (boolean)

### ENUMs
- `app_role`: platform_admin, client_admin, analyst, viewer
- `org_status`: active, suspended, trial
- `integration_type`: supabase, google_sheets, csv, api
- `integration_status`: pending, connected, error, syncing
- `lead_source`: google_ads, linkedin, referral, organic, email, other
- `lead_status`: new, qualified, in_analysis, proposal, converted, lost
- `widget_type`: metric_card, area_chart, bar_chart, line_chart, pie_chart, funnel, table, insight_card

### Row Level Security (RLS)
- Políticas de segurança por organização
- Usuários só acessam dados da sua `org_id`
- `platform_admin` tem acesso global

---

## 🎨 Design System

### Paleta de Cores (Pinn Branding)
- **Background:** `#050505` (Deep Space)
- **Primary:** `#FF6900` (Luminous Orange)
- **Accent:** `#FCB900` (Solar Amber)
- **Sidebar:** `#050505` (Deep Space)
- **Success:** Verde para métricas positivas
- **Warning:** Amber para alertas
- **Destructive:** Vermelho para erros

### Tipografia
- **Sans:** Manrope (corpo)
- **Heading:** Poppins (títulos)

### Componentes UI
- 49 componentes baseados em Radix UI
- Temas dark/light suportados
- Animações customizadas (fade-in, fade-up, slide-in-right, float)

---

## 🔐 Sistema de Autenticação e Autorização

### Roles (RBAC)
1. **platform_admin** - Acesso total à plataforma
   - Gerencia organizações
   - Cria templates
   - Visualiza atividade global
   - Acessa `/admin/*`

2. **client_admin** - Administrador da organização
   - Gerencia usuários da org
   - Configura integrações
   - Cria dashboards
   - Acessa `/client/:orgId/*`

3. **analyst** - Analista de dados
   - Visualiza dashboards
   - Cria widgets
   - Acessa insights
   - Acessa `/client/:orgId/*`

4. **viewer** - Visualizador
   - Apenas visualização
   - Acessa `/client/:orgId/*`

### Fluxo de Autenticação
1. Login via Supabase Auth (`/login`)
2. `AuthContext` busca perfil e roles
3. `ProtectedRoute` valida role antes de renderizar
4. RLS no banco garante isolamento de dados

---

## 📊 Funcionalidades Principais

### 1. Dashboard Engine
- **Motor de renderização dinâmica** de widgets
- Suporta 8 tipos de widgets:
  - Metric Card (KPIs)
  - Area Chart (séries temporais)
  - Bar Chart (comparações)
  - Line Chart (tendências)
  - Pie Chart (distribuições)
  - Funnel (funil de conversão)
  - Table (dados tabulares)
  - Insight Card (insights de IA)

- **Processamento de dados:**
  - Busca dados de integrações externas
  - Agregação (sum, count, avg, min, max)
  - Agrupamento por campos
  - Formatação de datas

### 2. Integrações de Dados
- **Supabase:** Conexão direta com outro projeto
- **Google Sheets:** Sincronização periódica
- **CSV:** Upload e importação
- **API Externa:** GET/POST com autenticação

### 3. CRM Kanban
- Gestão de leads em formato Kanban
- 5 estágios: Novos → Qualificados → Em Análise → Proposta → Convertidos
- Filtros e busca
- Insights de IA sobre conversão

### 4. Onboarding Wizard
- Wizard em 6 etapas:
  1. Seleção de integração
  2. Configuração de conexão
  3. Seleção de tabelas
  4. Mapeamento de dados
  5. Recomendação de widgets (IA)
  6. Preview do dashboard

### 5. IA e Insights
- **Recomendação de widgets** baseada em dados
- **Chat com dados** (Edge Function `ai-data-chat`)
- **Insights narrativos** no dashboard
- **Voice briefing** (TTS para resumo executivo)

### 6. Relatórios
- Geração de PDF com `jsPDF` e `html2canvas`
- Branding personalizado por organização
- Snapshot de IA incluído

### 7. Templates
- Templates pré-configurados de dashboard
- Categorização
- Templates públicos e privados

### 8. Métricas Customizadas
- Builder de fórmulas
- Agregações complexas
- Reutilização em múltiplos widgets

---

## 🔧 Edge Functions (Supabase)

### 1. `ai-data-chat`
- Chat com dados usando IA
- Análise de queries em linguagem natural

### 2. `calculate-dashboard-metrics`
- Cálculo de métricas agregadas
- Otimização de performance

### 3. `create-org-admin`
- Criação de organização e admin
- Setup inicial automático

### 4. `fetch-client-data`
- Busca dados de integrações externas
- Normalização de dados

### 5. `fetch-google-sheets`
- Sincronização com Google Sheets
- Parsing de dados

### 6. `recommend-widgets`
- IA recomenda widgets baseado em dados
- Análise de padrões

### 7. `suggest-mappings`
- Sugestão de mapeamentos de dados
- Detecção automática de tipos

### 8. `suggest-tables`
- Sugestão de tabelas relevantes
- Análise de schema

### 9. `sync-external-api`
- Sincronização com APIs externas
- Polling e webhooks

### 10. `test-supabase-connection`
- Teste de conexão com Supabase
- Validação de credenciais

---

## 🚀 Scripts e Comandos

```bash
# Desenvolvimento
npm run dev          # Inicia servidor Vite (porta 8080)

# Build
npm run build        # Build de produção
npm run build:dev    # Build de desenvolvimento

# Testes
npm run test         # Executa testes
npm run test:watch   # Testes em modo watch

# Lint
npm run lint         # ESLint

# Preview
npm run preview      # Preview do build
```

---

## 📦 Dependências Principais

### Produção
- **React 18.3.1** + React DOM
- **@supabase/supabase-js 2.94.0**
- **@tanstack/react-query 5.83.0**
- **react-router-dom 6.30.1**
- **react-hook-form 7.61.1** + zod 3.25.76
- **recharts 2.15.4** (gráficos)
- **jsPDF 4.1.0** + html2canvas 1.4.1
- **@radix-ui/*** (componentes acessíveis)
- **lucide-react 0.462.0** (ícones)
- **date-fns 3.6.0**
- **sonner 1.7.4** (toasts)

### Desenvolvimento
- **Vite 5.4.19**
- **TypeScript 5.8.3**
- **TailwindCSS 3.4.17**
- **ESLint 9.32.0**
- **Vitest 3.2.4**

---

## 🔄 Fluxos Principais

### 1. Fluxo de Onboarding
1. Admin cria organização
2. Usuário faz login
3. Wizard de onboarding:
   - Seleciona tipo de integração
   - Configura conexão
   - Seleciona tabelas
   - Mapeia dados para métricas
   - IA recomenda widgets
   - Preview e confirmação
4. Dashboard padrão é criado

### 2. Fluxo de Criação de Widget
1. Usuário clica em "Novo Widget"
2. Seleciona tipo de widget
3. Escolhe fonte de dados (tabela)
4. Configura métrica e agregação
5. Widget é salvo no dashboard
6. Dados são buscados e renderizados

### 3. Fluxo de Sincronização
1. Integração é configurada
2. Edge Function é chamada (manual ou cron)
3. Dados são buscados da fonte externa
4. Dados são normalizados e salvos
5. Widgets são atualizados automaticamente (Realtime)

### 4. Fluxo de CRM
1. Leads são importados via integração
2. Leads aparecem no Kanban
3. Usuário move leads entre estágios
4. IA analisa padrões de conversão
5. Insights são exibidos

---

## 🎯 Pontos Fortes

1. **Arquitetura Multi-tenant** bem estruturada
2. **RBAC robusto** com 4 níveis de permissão
3. **Design System consistente** (Pinn branding)
4. **Integrações flexíveis** (4 tipos suportados)
5. **IA integrada** (recomendações, insights, chat)
6. **Performance otimizada** (React Query, RLS, índices)
7. **Extensibilidade** (templates, métricas customizadas)
8. **UX moderna** (dark mode, animações, responsivo)

---

## ⚠️ Pontos de Atenção

1. **Configuração do Supabase:**
   - URL e chave hardcoded em `client.ts`
   - Deveria usar variáveis de ambiente

2. **Segurança:**
   - RLS policies precisam ser revisadas
   - Validação de inputs nas Edge Functions

3. **Performance:**
   - Limite de dados em widgets (1000 registros)
   - Cache de queries pode ser otimizado

4. **Testes:**
   - Poucos testes unitários
   - Falta testes E2E

5. **Documentação:**
   - README básico
   - Falta documentação de API das Edge Functions

---

## 📝 Próximos Passos Sugeridos

1. **Variáveis de Ambiente:**
   - Mover configurações do Supabase para `.env`
   - Adicionar `.env.example`

2. **Testes:**
   - Aumentar cobertura de testes
   - Adicionar testes E2E com Playwright

3. **Documentação:**
   - Documentar Edge Functions
   - Criar guia de desenvolvimento
   - Documentar schema do banco

4. **Features:**
   - Exportação de dados (CSV, Excel)
   - Agendamento de relatórios
   - Notificações push
   - Mobile app (React Native)

5. **Otimizações:**
   - Lazy loading de widgets
   - Virtualização de tabelas grandes
   - Cache de métricas calculadas

---

## 🔗 Links e Referências

- **Supabase Project:** `https://bkgwzxrutzmmxmxzfhmw.supabase.co`
- **Repositório:** `https://github.com/pinn-product-builder/pinn-insights-hub`
- **Design System:** Baseado em Linear, Metabase, modern BI tools

---

**Análise realizada em:** 2025-01-27  
**Versão do Projeto:** 0.0.0 (desenvolvimento)
