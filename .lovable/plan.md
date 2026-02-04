
# Plano: Pinn Insights Hub - Evolução Enterprise Ready

## Visão Geral

Este plano detalha a implementação das 5 áreas de funcionalidades avançadas que transformarão o Pinn em uma plataforma de BI de nível Enterprise: Inteligência Preditiva, Automação, White-label, Gestão de Dados Profissional, e UX Premium.

---

## Fase 1: Inteligência Preditiva (IA Avançada)

### 1.1 Forecast de Métricas (30-60 dias)

**Objetivo:** Prever tendências de faturamento, leads e conversões usando análise de séries temporais.

**Implementação:**
- Criar Edge Function `predict-metrics` que utiliza regressão linear simples e médias móveis
- Calcular tendências baseadas nos últimos 90 dias de dados históricos
- Gerar projeções para 30 e 60 dias com intervalos de confiança
- Criar widget `ForecastWidget.tsx` com gráfico de linha que mostra histórico + projeção

**Componentes:**
- `supabase/functions/predict-metrics/index.ts` - Lógica de previsão
- `src/components/dashboard/widgets/ForecastWidget.tsx` - Visualização
- Adicionar tipo `forecast` no enum `widget_type`

### 1.2 Detecção de Anomalias (Watchdog IA)

**Objetivo:** Alertar automaticamente sobre variações anormais em métricas.

**Implementação:**
- Criar Edge Function `anomaly-detector` que roda via pg_cron a cada hora
- Calcular desvio padrão e z-scores das últimas 24h vs média histórica
- Gerar alertas quando z-score > 2 (anomalia significativa)
- Persistir alertas na nova tabela `ai_anomalies`
- Mostrar alertas no dashboard com explicação contextual

**Nova Tabela:**
```sql
CREATE TABLE ai_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  metric_name TEXT NOT NULL,
  detected_value NUMERIC,
  expected_value NUMERIC,
  deviation_percent NUMERIC,
  severity TEXT CHECK (severity IN ('warning', 'critical')),
  explanation TEXT,
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Fase 2: Automação e Notificações

### 2.1 Sistema de Alertas Inteligentes

**Objetivo:** Permitir configuração de alertas por email e webhook baseados em regras.

**Implementação:**
- Evoluir a página `DataTriggers.tsx` para persistir triggers no banco
- Criar tabela `alert_triggers` para armazenar configurações
- Criar Edge Function `execute-triggers` que avalia triggers a cada sync
- Integrar com serviço de email (Resend) e suporte a webhooks genéricos

**Nova Tabela:**
```sql
CREATE TABLE alert_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  metric TEXT NOT NULL,
  condition TEXT CHECK (condition IN ('gt', 'lt', 'eq', 'change_percent')),
  threshold NUMERIC NOT NULL,
  action TEXT CHECK (action IN ('email', 'webhook', 'slack')),
  destination TEXT NOT NULL,
  cooldown_minutes INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.2 Relatórios Semanais Automáticos

**Objetivo:** Enviar resumo executivo semanal por email com Top 3 Insights.

**Implementação:**
- Criar Edge Function `weekly-report` agendada via pg_cron (domingos 08:00)
- Utilizar Lovable AI para gerar narrativa executiva dos insights
- Gerar PDF usando `ReportGenerator` existente
- Enviar via serviço de email (Resend)

---

## Fase 3: White-label e Personalização

### 3.1 Branding Completo por Organização

**Objetivo:** Cada cliente pode ter logo, cores e subdomínio próprio.

**Implementação:**
- Expandir tabela `organizations` com novos campos de branding
- Criar Storage Bucket `org-assets` para logos
- Evoluir `ThemeContext.tsx` para aplicar tema completo
- Adicionar página de configuração de branding em Settings

**Alterações no Schema:**
```sql
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS secondary_color TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS font_family TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS custom_domain TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS favicon_url TEXT;
```

### 3.2 Editor de Dashboard Drag & Drop

**Objetivo:** Permitir reorganização visual dos widgets pelo usuário.

**Implementação:**
- Integrar biblioteca `react-grid-layout` (ou usar `react-resizable-panels` existente)
- Salvar layout customizado no campo `layout` da tabela `dashboards`
- Permitir resize de widgets com tamanhos predefinidos
- Adicionar botão "Modo Edição" que habilita drag handles

**Componentes:**
- `src/components/dashboard/DashboardGridEditor.tsx` - Grid editável
- Atualizar `DashboardEngine.tsx` para suportar modo edição

---

## Fase 4: Gestão de Dados Profissional

### 4.1 Multi-Source Join (Cruzamento de Dados)

**Objetivo:** Unir dados de diferentes integrações em visualizações únicas.

**Implementação:**
- Criar tabela `data_joins` para armazenar regras de join
- Edge Function `execute-join` que processa queries cross-integration
- Interface no wizard de mapeamento para definir relacionamentos
- Suporte inicial: Supabase + Google Sheets

**Nova Tabela:**
```sql
CREATE TABLE data_joins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  source_a_integration_id UUID REFERENCES integrations(id),
  source_a_table TEXT NOT NULL,
  source_a_key TEXT NOT NULL,
  source_b_integration_id UUID REFERENCES integrations(id),
  source_b_table TEXT NOT NULL,
  source_b_key TEXT NOT NULL,
  join_type TEXT DEFAULT 'left',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.2 Logs de Auditoria Reais

**Objetivo:** Registrar todas alterações importantes no sistema.

**Implementação:**
- Evoluir `activity_logs` para capturar eventos reais (não mock)
- Criar hook `useAuditLog` para registrar ações do usuário
- Implementar triggers no banco para capturar alterações em tabelas críticas
- Atualizar página `AuditLogs.tsx` para buscar dados reais

### 4.3 Exportação Avançada de Dados

**Objetivo:** Exportar widgets para Excel, CSV ou PDF de alta qualidade.

**Implementação:**
- Adicionar biblioteca `xlsx` para geração de Excel
- Evoluir `ReportGenerator` para suportar exportação de widgets individuais
- Adicionar menu de exportação em cada widget
- Suporte a exportação em lote (dashboard completo)

---

## Fase 5: Experiência do Cliente (UX Premium)

### 5.1 Drill-down em Gráficos

**Objetivo:** Clicar em segmentos de gráficos para ver dados detalhados.

**Implementação:**
- Adicionar evento `onClick` nos componentes Recharts
- Criar modal `DrillDownModal.tsx` que mostra registros filtrados
- Passar contexto do clique (ex: "Leads do Google Ads") para filtrar dados
- Reutilizar `TableWidget` para exibir resultados

**Componentes:**
- `src/components/dashboard/DrillDownModal.tsx` - Modal de detalhamento
- Atualizar `PieChartWidget.tsx`, `BarChartWidget.tsx` com handlers de clique

### 5.2 Chat IA Contextual (Evolução do AIChat)

**Objetivo:** Responder perguntas sobre os dados reais do cliente.

**Implementação:**
- Conectar `AIChat.tsx` ao Lovable AI Gateway
- Criar Edge Function `ai-data-chat` que:
  1. Recebe pergunta do usuário
  2. Busca dados relevantes do org_id no Supabase
  3. Envia contexto + pergunta para Lovable AI
  4. Retorna resposta com possíveis gráficos inline
- Adicionar histórico de conversas persistido

---

## Ordem de Implementação Recomendada

| Prioridade | Funcionalidade | Complexidade | Impacto |
|------------|----------------|--------------|---------|
| 1 | Chat IA Contextual | Média | Alto |
| 2 | Alertas Inteligentes (persistência) | Média | Alto |
| 3 | Drill-down em Gráficos | Baixa | Alto |
| 4 | Exportação Avançada | Baixa | Médio |
| 5 | Logs de Auditoria Reais | Baixa | Médio |
| 6 | Branding White-label | Média | Alto |
| 7 | Detecção de Anomalias | Alta | Alto |
| 8 | Forecast de Métricas | Alta | Médio |
| 9 | Drag & Drop Dashboard | Alta | Médio |
| 10 | Multi-Source Join | Muito Alta | Alto |
| 11 | Relatórios Automáticos | Média | Médio |

---

## Seção Técnica

### Novas Dependências Necessárias
```json
{
  "react-grid-layout": "^1.4.4",
  "xlsx": "^0.18.5",
  "resend": "^3.2.0"
}
```

### Novas Edge Functions
1. `predict-metrics` - Previsão de métricas
2. `anomaly-detector` - Detecção de anomalias (cron)
3. `execute-triggers` - Execução de alertas
4. `weekly-report` - Relatório semanal (cron)
5. `execute-join` - Cruzamento multi-source
6. `ai-data-chat` - Chat IA contextual

### Migrações de Banco de Dados
- Adicionar campos de branding em `organizations`
- Criar tabela `ai_anomalies`
- Criar tabela `alert_triggers`
- Criar tabela `data_joins`
- Criar Storage Bucket `org-assets`

### Secrets Necessários
- `RESEND_API_KEY` - Para envio de emails

---

## Próximos Passos

Após aprovação, começaremos pela **Fase 5.2 (Chat IA Contextual)** pois:
1. Já existe estrutura base em `AIChat.tsx`
2. Lovable AI Gateway está configurado
3. Alto impacto na experiência do usuário
4. Demonstra capacidade de IA avançada da plataforma
