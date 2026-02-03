
# Plano: Sistema PINN BAI 100% Funcional com Integrações Reais

## Resumo Executivo

Transformar o sistema de protótipo com dados mock para uma plataforma de produção completa, incluindo:
- Banco de dados real no Supabase com schema multi-tenant
- Autenticação funcional com controle de papéis seguros
- Integrações reais (Supabase externo, Google Sheets, CSV, API)
- Seleção inteligente de tabelas e colunas
- Motor de recomendação de widgets baseado no tipo de dados
- Dashboards dinâmicos de alta qualidade UX

---

## Fase 1: Estrutura do Banco de Dados

### 1.1 Tabelas a Criar

| Tabela | Descricao |
|--------|-----------|
| `profiles` | Perfis de usuarios (nome, avatar, org_id) |
| `user_roles` | Papeis dos usuarios (tabela separada por seguranca) |
| `organizations` | Organizacoes/clientes da plataforma |
| `integrations` | Conexoes de fontes de dados |
| `selected_tables` | Tabelas selecionadas de cada integracao |
| `data_mappings` | Mapeamentos de campos para metricas |
| `dashboards` | Configuracoes de dashboards |
| `dashboard_widgets` | Widgets de cada dashboard |
| `leads` | Dados de leads sincronizados |
| `activity_logs` | Logs de atividade do sistema |

### 1.2 Enum Types

```text
app_role: 'platform_admin' | 'client_admin' | 'analyst' | 'viewer'
org_status: 'active' | 'suspended' | 'trial'
org_plan: 1 | 2 | 3 | 4
integration_type: 'supabase' | 'google_sheets' | 'csv' | 'api'
integration_status: 'pending' | 'connected' | 'error' | 'syncing'
lead_source: 'google_ads' | 'linkedin' | 'referral' | 'organic' | 'email' | 'other'
lead_status: 'new' | 'qualified' | 'in_analysis' | 'proposal' | 'converted' | 'lost'
widget_type: 'metric_card' | 'area_chart' | 'bar_chart' | 'line_chart' | 'pie_chart' | 'funnel' | 'table' | 'insight_card'
```

### 1.3 Seguranca (RLS)

- Usuarios so veem dados da propria organizacao
- Platform admins veem todas organizacoes
- Funcao `has_role()` separada para evitar recursao
- Tabela `user_roles` isolada conforme boas praticas

---

## Fase 2: Autenticacao e Autorizacao

### 2.1 Componentes a Criar

| Arquivo | Funcao |
|---------|--------|
| `src/contexts/AuthContext.tsx` | Context global de autenticacao |
| `src/hooks/useAuth.ts` | Hook para login/logout/sessao |
| `src/components/auth/ProtectedRoute.tsx` | Protecao de rotas por papel |
| `src/components/auth/RoleGuard.tsx` | Protecao por papel especifico |

### 2.2 Fluxo de Login

1. Usuario insere email/senha
2. Supabase Auth valida credenciais
3. Sistema busca perfil e papel via `user_roles`
4. Redireciona para area correta (admin ou cliente)
5. Context armazena sessao e dados do usuario

### 2.3 Trigger de Criacao de Perfil

Ao criar usuario via Supabase Auth, trigger automaticamente:
- Cria registro em `profiles`
- Permite associar papel posteriormente

---

## Fase 3: Sistema de Selecao de Tabelas e Campos

### 3.1 Fluxo de Selecao de Tabelas

O sistema permitira que o admin selecione quais tabelas usar:

```text
1. Conectar fonte de dados (Supabase/Sheets/API)
2. Sistema lista todas as tabelas disponiveis
3. Admin marca quais tabelas deseja usar
4. Para cada tabela, exibe preview de dados
5. Admin seleciona quais colunas importar
6. Sistema detecta tipos de dados automaticamente
```

### 3.2 Interface de Selecao

```text
+-------------------------------------------------------+
|  Tabelas Disponiveis                                   |
+-------------------------------------------------------+
|  [x] leads (2.450 registros)                          |
|      Colunas: id, name, email, source, status, value   |
|                                                        |
|  [x] conversions (320 registros)                       |
|      Colunas: id, lead_id, revenue, converted_at       |
|                                                        |
|  [ ] users (45 registros)                              |
|      Colunas: id, email, name, role, created_at        |
|                                                        |
|  [ ] monthly_metrics (12 registros)                    |
|      Colunas: month, total_leads, revenue              |
+-------------------------------------------------------+
```

### 3.3 Banco de Dados: selected_tables

```sql
create table public.selected_tables (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid references integrations(id) on delete cascade,
  table_name text not null,
  selected_columns text[] not null,
  is_primary boolean default false,
  row_count integer,
  created_at timestamptz default now()
);
```

---

## Fase 4: Motor de Recomendacao de Widgets

### 4.1 Analise Inteligente de Dados

O sistema analisara automaticamente os dados mapeados para sugerir os melhores widgets:

| Tipo de Dado | Widget Recomendado | Justificativa |
|--------------|-------------------|---------------|
| Contador (COUNT) | MetricCard | Exibicao de totais |
| Valor monetario | MetricCard (currency) | Formato R$ com tendencia |
| Percentual | MetricCard (%) | Taxa de conversao |
| Serie temporal | AreaChart / LineChart | Evolucao ao longo do tempo |
| Categorias (source, status) | PieChart / BarChart | Distribuicao |
| Dados de funil | FunnelWidget | Estagios de conversao |
| Lista de registros | TableWidget | Detalhamento |
| Metricas + texto | InsightCard | Analises IA |

### 4.2 Algoritmo de Recomendacao

```text
1. Analisar mapeamentos configurados
2. Detectar tipos de metricas (contador, valor, percentual, temporal)
3. Identificar relacoes entre campos (ex: source -> distribuicao)
4. Gerar lista de widgets recomendados com score
5. Apresentar ao admin em ordem de relevancia
6. Admin pode aceitar/rejeitar/customizar
```

### 4.3 Interface de Recomendacoes

```text
+---------------------------------------------------------------+
|  Widgets Recomendados                                          |
+---------------------------------------------------------------+
|  [Aceito] MetricCard - Total de Leads                         |
|           Baseado no mapeamento: COUNT(leads.id)               |
|                                                                |
|  [Aceito] MetricCard - Taxa de Conversao                       |
|           Baseado no mapeamento: conversions / leads * 100     |
|                                                                |
|  [Aceito] AreaChart - Evolucao de Leads                       |
|           Baseado no mapeamento: leads.created_at (serie)      |
|                                                                |
|  [Aceito] PieChart - Distribuicao por Origem                   |
|           Baseado no mapeamento: leads.source (categorico)     |
|                                                                |
|  [?] BarChart - Leads por Status                               |
|       Baseado no mapeamento: leads.status (categorico)         |
+---------------------------------------------------------------+
```

---

## Fase 5: Edge Functions para Integracoes

### 5.1 test-supabase-connection

Testa conexao com Supabase externo e lista tabelas/colunas disponiveis.

**Entrada:** `{ projectUrl, anonKey }`
**Saida:** `{ success, tables: [{ name, columns, rowCount }] }`

### 5.2 sync-supabase-data

Sincroniza dados do Supabase externo para tabela local, aplicando mapeamentos.

**Entrada:** `{ integrationId, selectedTables, mappings }`
**Saida:** `{ success, syncedRecords, errors }`

### 5.3 fetch-google-sheets

Busca dados de planilha publica via API do Google.

**Entrada:** `{ spreadsheetUrl, sheetName }`
**Saida:** `{ success, columns, rows, sampleData }`

### 5.4 sync-external-api

Sincroniza dados de API REST externa.

**Entrada:** `{ integrationId, endpoint, authConfig }`
**Saida:** `{ success, records }`

### 5.5 calculate-dashboard-metrics

Calcula metricas do dashboard em tempo real baseado nos dados sincronizados.

**Entrada:** `{ orgId, dateRange, widgetConfigs }`
**Saida:** `{ metrics: { [widgetId]: { value, previousValue, data } } }`

### 5.6 recommend-widgets

Analisa dados e recomenda widgets ideais.

**Entrada:** `{ orgId, mappings }`
**Saida:** `{ recommendations: [{ type, title, score, config }] }`

---

## Fase 6: Hooks e Queries (React Query)

| Hook | Responsabilidade |
|------|-----------------|
| `useAuth` | Autenticacao e sessao |
| `useOrganizations` | CRUD de organizacoes |
| `useOrganization(id)` | Uma organizacao especifica |
| `useIntegrations(orgId)` | Integracoes da organizacao |
| `useIntegrationTables(integrationId)` | Tabelas de uma integracao |
| `useLeads(orgId, filters)` | Leads com filtros e paginacao |
| `useDashboard(orgId)` | Configuracao do dashboard |
| `useDashboardMetrics(orgId, dateRange)` | Metricas calculadas em tempo real |
| `useWidgetRecommendations(mappings)` | Recomendacoes de widgets |
| `useActivityLogs(orgId)` | Logs de atividade |

---

## Fase 7: Refatoracao de Paginas

### 7.1 Login.tsx

- Usar `supabase.auth.signInWithPassword()`
- Buscar perfil e papel apos login
- Redirecionar baseado no papel (admin vs cliente)

### 7.2 AdminLayout.tsx / ClientLayout.tsx

- Usar `useAuth()` para dados do usuario
- Exibir nome/avatar real do perfil
- Logout real com `supabase.auth.signOut()`
- Buscar organizacao do contexto

### 7.3 Organizations.tsx

- Buscar do banco via `useOrganizations()`
- Stats calculadas em tempo real via agregacao
- CRUD funcional com mutations

### 7.4 OnboardingWizard.tsx

Refatoracao completa do wizard:

**Step 1 - Organizacao:** Salvar em `organizations`
**Step 2 - Integracao:** 
- Testar conexao via Edge Function
- Listar tabelas disponiveis
- Permitir selecao de tabelas/colunas
- Salvar em `integrations` e `selected_tables`

**Step 3 - Mapeamento:**
- Carregar tabelas/colunas selecionadas
- Mapear para metricas do sistema
- Salvar em `data_mappings`

**Step 4 - Preview:**
- Chamar `recommend-widgets` Edge Function
- Exibir recomendacoes inteligentes
- Permitir aceitar/rejeitar/customizar
- Salvar em `dashboard_widgets`

**Step 5 - Confirmacao:**
- Criar dashboard em `dashboards`
- Disparar sincronizacao inicial
- Redirecionar para dashboard

### 7.5 Dashboard.tsx

- Buscar config via `useDashboard()`
- Buscar metricas via `useDashboardMetrics()`
- Renderizar widgets dinamicamente baseado na config
- Filtro de periodo funcional (altera query)

### 7.6 TableWidget.tsx

- Receber `orgId` e `filters` via props
- Buscar leads via `useLeads()`
- Paginacao real do banco

---

## Fase 8: Arquivos a Criar

### Backend (Supabase)

```text
supabase/
+-- functions/
    +-- test-supabase-connection/
    |   +-- index.ts
    +-- sync-supabase-data/
    |   +-- index.ts
    +-- fetch-google-sheets/
    |   +-- index.ts
    +-- sync-external-api/
    |   +-- index.ts
    +-- calculate-dashboard-metrics/
    |   +-- index.ts
    +-- recommend-widgets/
        +-- index.ts
```

### Frontend

```text
src/
+-- contexts/
|   +-- AuthContext.tsx
+-- hooks/
|   +-- useAuth.ts
|   +-- useOrganizations.ts
|   +-- useOrganization.ts
|   +-- useIntegrations.ts
|   +-- useIntegrationTables.ts
|   +-- useLeads.ts
|   +-- useDashboard.ts
|   +-- useDashboardMetrics.ts
|   +-- useWidgetRecommendations.ts
|   +-- useActivityLogs.ts
+-- components/
|   +-- auth/
|   |   +-- ProtectedRoute.tsx
|   |   +-- RoleGuard.tsx
|   +-- onboarding/
|       +-- steps/
|           +-- TableSelectionStep.tsx (novo)
+-- types/
|   +-- database.ts
+-- lib/
    +-- types.ts (manter apenas interfaces)
```

---

## Fase 9: Arquivos a Modificar

| Arquivo | Mudancas |
|---------|----------|
| `src/App.tsx` | Adicionar AuthProvider e ProtectedRoute |
| `src/pages/Login.tsx` | Login real com Supabase Auth |
| `src/pages/admin/Organizations.tsx` | Buscar dados do banco |
| `src/pages/client/Dashboard.tsx` | Metricas dinamicas |
| `src/components/layouts/AdminLayout.tsx` | Usar useAuth |
| `src/components/layouts/ClientLayout.tsx` | Usar useAuth e dados reais |
| `src/components/onboarding/OnboardingWizard.tsx` | Fluxo completo com banco |
| `src/components/onboarding/steps/IntegrationStep.tsx` | Selecao de tabelas |
| `src/components/onboarding/steps/MappingStep.tsx` | Dados reais |
| `src/components/onboarding/steps/PreviewStep.tsx` | Recomendacoes IA |
| `src/components/dashboard/widgets/*.tsx` | Receber dados via props |
| `src/lib/mock-data.ts` | Manter apenas types, remover mocks |

---

## Ordem de Implementacao

### Etapa 1: Fundacao (Banco de Dados)
1. Criar migracao SQL com todas as tabelas
2. Criar enums e tipos
3. Configurar RLS policies
4. Criar funcao `has_role()`
5. Criar trigger para perfil automatico

### Etapa 2: Autenticacao
6. Criar AuthContext.tsx
7. Criar useAuth.ts
8. Criar ProtectedRoute.tsx
9. Refatorar Login.tsx
10. Refatorar App.tsx com protecao

### Etapa 3: Dados Basicos
11. Criar hooks de dados
12. Refatorar Organizations.tsx
13. Refatorar layouts
14. Criar arquivo de types limpo

### Etapa 4: Edge Functions
15. Criar test-supabase-connection
16. Criar fetch-google-sheets
17. Criar sync-supabase-data
18. Criar sync-external-api
19. Criar calculate-dashboard-metrics
20. Criar recommend-widgets

### Etapa 5: Integracoes Frontend
21. Adicionar selecao de tabelas no IntegrationStep
22. Refatorar MappingStep com dados reais
23. Refatorar PreviewStep com recomendacoes
24. Refatorar OnboardingWizard completo
25. Implementar sincronizacao real

### Etapa 6: Dashboard Dinamico
26. Criar useDashboardMetrics
27. Refatorar Dashboard.tsx
28. Conectar widgets a dados reais
29. Implementar TableWidget com dados reais

### Etapa 7: Limpeza Final
30. Remover todos os mocks de mock-data.ts
31. Manter apenas interfaces e types
32. Testar fluxo completo end-to-end

---

## Resultado Final

Apos implementacao:

- **Login funcional** com email/senha via Supabase Auth
- **Controle de papeis seguro** (platform_admin, client_admin, analyst, viewer)
- **Organizacoes persistentes** com CRUD completo
- **4 tipos de integracao funcionais**:
  - Supabase externo (via URL + Anon Key)
  - Google Sheets (via URL publica)
  - Upload CSV (via Supabase Storage)
  - API externa (REST com autenticacao)
- **Selecao de tabelas e colunas** com interface intuitiva
- **Recomendacao inteligente de widgets** baseada nos dados
- **Dashboards dinamicos de alta qualidade** com metricas reais
- **Tabela de leads** com dados reais e paginacao
- **Logs de atividade** persistentes
- **Zero mock data** - sistema 100% funcional

---

## Detalhes Tecnicos Importantes

### Seguranca de Papeis

Conforme instrucoes, papeis sao armazenados em tabela separada `user_roles` com funcao `has_role()` para evitar recursao e ataques de escalacao de privilegios.

### Isolamento Multi-tenant

Todas as tabelas com dados de cliente tem `org_id` e RLS policies garantem que:
- Usuarios so veem dados da propria organizacao
- Platform admins podem ver todas as organizacoes

### Edge Functions CORS

Todas as edge functions terao headers CORS configurados conforme padrao:

```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type...',
}
```

### Dashboard de Alta Qualidade UX

Os dashboards manterao o padrao visual ja estabelecido:
- Tooltips explicativos em cada metrica
- Sparklines com gradientes
- Animacoes suaves
- Cores semanticas para status
- Design responsivo
- Acessibilidade (contraste, labels)
