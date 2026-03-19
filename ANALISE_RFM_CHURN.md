# Análise de Integração - Matriz RFM e Predição de Churn

## Objetivo

Definir o plano técnico para integrar **Matriz RFM** (Recency, Frequency, Monetary) e **Predição de Churn** aos dashboards dos clientes no PINN-BAI, com entrega incremental e baixo risco de regressão.

---

## Método AIOS utilizado

Para esta análise, foi aplicado o fluxo **AIOS (Análise Integrada Orientada a Sistema)**:

1. **A - Arquitetura atual**
   - Mapeamento de páginas, hooks, widgets e Edge Functions.
2. **I - Integração**
   - Identificação dos pontos de extensão no frontend, banco e funções serverless.
3. **O - Operação**
   - Definição de fluxo de atualização, observabilidade e fallback.
4. **S - Segurança e Escala**
   - Validação de multi-tenant (org_id), performance e governança de dados.

---

## Estado atual da base

### Frontend e Dashboards
- Engine principal: `src/components/dashboard/DashboardEngine.tsx`
- Tipos de widgets atuais: `metric_card`, `area_chart`, `bar_chart`, `line_chart`, `pie_chart`, `funnel`, `table`, `insight_card`
- Tipos e métricas: `src/lib/types.ts`
- Páginas cliente relevantes:
  - `src/pages/client/Dashboard.tsx`
  - `src/pages/client/Insights.tsx`
  - `src/pages/client/CRM.tsx`

### Dados e integrações
- Busca principal de dados externos: `src/hooks/useExternalData.ts`
- Integração backend: `supabase/functions/fetch-client-data`
- Mapeamento semântico de colunas: `useDataMappings` + `suggest-mappings`

### Oportunidade imediata
- `churn_rate` já existe em `TargetMetric`, reduzindo esforço inicial para churn.
- A estrutura de widgets é extensível para incluir componentes analíticos novos.

---

## Escopo funcional da integração

## 1) Matriz RFM

### Entregas
- Segmentação de clientes por score R, F e M (1 a 5).
- Classificação por segmentos (ex.: Champions, At Risk, Hibernating).
- Visualização nos dashboards (heatmap/matriz ou tabela segmentada).

### Requisitos mínimos de dados
- `customer_id`
- `last_purchase_date` (ou campo equivalente)
- `order_count` (ou derivável)
- `total_spent` (ou derivável)

### Saídas esperadas
- `r_score`, `f_score`, `m_score`
- `rfm_score` agregado (ex.: "554")
- `rfm_segment`

## 2) Predição de Churn

### Entregas
- Score de risco por cliente (0 a 1).
- Probabilidade de churn em janela definida (ex.: 30 dias).
- Drivers de risco (quando disponíveis).

### Requisitos mínimos de dados
- Histórico de transações
- Sinais de engajamento/atividade
- Base temporal suficiente para treinamento/regra de risco

### Saídas esperadas
- `churn_probability`
- `churn_risk_band` (baixo/médio/alto)
- `churn_reasons` (opcional, lista curta de fatores)

---

## Arquitetura proposta

## Camada de dados (Supabase)

### Novas Edge Functions sugeridas
1. `calculate-rfm`
   - Entrada: `orgId`, `sourceTable`, mapeamento de campos.
   - Saída: dataset de clientes com scores RFM e segmento.

2. `predict-churn`
   - Entrada: `orgId`, `sourceTable`, parâmetros de janela.
   - Saída: probabilidade de churn por cliente.

### Persistência recomendada
- Criar materialização por organização para evitar recálculo em toda renderização.
- Estruturas candidatas:
  - `customer_rfm_scores`
  - `customer_churn_scores`
- Chaves:
  - `org_id`, `customer_id`, `calculated_at`

## Camada frontend

### Tipos e contratos
- Expandir `WidgetType` e `TargetMetric` em `src/lib/types.ts`:
  - `rfm_matrix`
  - `churn_prediction`
  - métricas adicionais: `recency`, `frequency`, `monetary`, `churn_probability`

### Novos widgets
1. `RFMMatrixWidget`
   - Local: `src/components/dashboard/widgets/RFMMatrixWidget.tsx`
   - Visual: matriz por grupos ou scatter categorizado.

2. `ChurnPredictionWidget`
   - Local: `src/components/dashboard/widgets/ChurnPredictionWidget.tsx`
   - Visual: distribuição de risco + tabela top clientes em risco.

### Engine de renderização
- Registrar novos tipos no switch de `DashboardEngine.tsx`.
- Reuso do pipeline de fetch existente para manter compatibilidade.

---

## Roadmap de implementação (sugerido)

### Fase 0 - Alinhamento de dados (rápida)
- Validar tabelas por cliente e nomes reais de colunas.
- Definir dicionário mínimo de mapeamento para RFM/churn.

### Fase 1 - MVP analítico
- Entregar cálculo RFM e score churn por regras heurísticas.
- Expor widgets básicos no dashboard.
- Entregar filtros por período e segmento.

### Fase 2 - Evolução de modelo
- Trocar heurística por modelo supervisionado (quando base permitir).
- Incluir explicabilidade simples (principais fatores por cliente).

### Fase 3 - Operação contínua
- Agendamento de recálculo (diário ou intra-day).
- Alertas em `Insights` e ação no `CRM`.

---

## Critérios de aceite (MVP)

1. Dashboard renderiza pelo menos 1 widget RFM e 1 de churn sem degradar widgets atuais.
2. Cálculo respeita isolamento por `org_id`.
3. Tempo de carregamento dos novos widgets <= 2s para volume padrão.
4. Usuário consegue identificar:
   - Segmento RFM dominante
   - Lista de clientes alto risco de churn
5. Logs e erros são observáveis em ambiente de diagnóstico.

---

## Riscos e mitigação

- **Qualidade de dados inconsistente entre clientes**
  - Mitigar com mapeamento assistido e validação pré-cálculo.

- **Ausência de histórico suficiente para churn preditivo**
  - Mitigar com fallback heurístico e indicador de confiança.

- **Custo de processamento em tempo real**
  - Mitigar com materialização e recálculo assíncrono.

- **Adoção baixa pelos times de negócio**
  - Mitigar com taxonomia de segmentos clara e ações recomendadas por faixa de risco.

---

## Próximo passo recomendado

Iniciar pela **Fase 0** com um checklist por cliente (tabela fonte, colunas disponíveis e periodicidade de atualização), depois implementar o MVP técnico em sequência:

1. contratos de dados (`types.ts`);
2. funções `calculate-rfm` e `predict-churn`;
3. widgets `RFMMatrixWidget` e `ChurnPredictionWidget`;
4. ligação em `DashboardEngine`.
