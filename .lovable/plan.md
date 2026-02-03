

# Motor de Recomendação de Widgets Inteligente

## Objetivo

Implementar um sistema de recomendação inteligente que analisa os mapeamentos de dados configurados e sugere automaticamente os widgets mais adequados para visualização, com scores de relevância, justificativas claras e interface interativa para aceitar/rejeitar/customizar.

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MOTOR DE RECOMENDAÇÃO DE WIDGETS                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐       │
│  │   MappingStep   │────▶│  recommend-     │────▶│   PreviewStep   │       │
│  │   (Mapeamentos) │     │  widgets (Edge) │     │  (Recomendações)│       │
│  │                 │     │                 │     │                 │       │
│  │  - source_field │     │  - Analisa tipos│     │  - Lista ranked │       │
│  │  - target_metric│     │  - Calcula score│     │  - Aceitar/     │       │
│  │  - transform    │     │  - Gera config  │     │    Rejeitar     │       │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘       │
│                                                                             │
│  REGRAS DE RECOMENDAÇÃO:                                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ Tipo de Dado        │ Widget Sugerido │ Score │ Justificativa        │ │
│  ├───────────────────────────────────────────────────────────────────────┤ │
│  │ Contador (COUNT)    │ MetricCard      │ 95    │ Exibição de totais   │ │
│  │ Valor monetário     │ MetricCard ($)  │ 92    │ Formato R$ + trend   │ │
│  │ Percentual          │ MetricCard (%)  │ 90    │ Taxa de conversão    │ │
│  │ Série temporal      │ AreaChart       │ 88    │ Evolução no tempo    │ │
│  │ Categórico          │ PieChart/Bar    │ 87    │ Distribuição         │ │
│  │ Funil               │ FunnelWidget    │ 89    │ Estágios de vendas   │ │
│  │ Lista de registros  │ TableWidget     │ 80    │ Detalhamento         │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Fase 1: Aprimorar Edge Function recommend-widgets

### 1.1 Análise Avançada de Dados

A Edge Function será aprimorada para:

| Análise | Detecção | Widget Recomendado |
|---------|----------|-------------------|
| Campo numérico + agregação SUM | Detecta valores monetários | MetricCard com formato currency |
| Campo numérico + agregação COUNT | Detecta contadores | MetricCard com formato number |
| Campo numérico + agregação AVG | Detecta médias | MetricCard com comparação |
| Campo de data (created_at, etc.) | Detecta série temporal | AreaChart ou LineChart |
| Campo categórico (source, status) | Detecta distribuição | PieChart ou BarChart |
| Múltiplos status sequenciais | Detecta funil | FunnelWidget |
| Campo de texto + email/nome | Detecta lista | TableWidget |
| Plano >= 3 | Funcionalidade IA | InsightCard |

### 1.2 Sistema de Scoring

Cada recomendação recebe um score (0-100) baseado em:
- **Relevância do tipo de dado** (40%)
- **Quantidade de dados disponíveis** (20%)
- **Compatibilidade com plano** (20%)
- **Boas práticas de UX** (20%)

---

## Fase 2: Hook useWidgetRecommendations

### 2.1 Interface do Hook

```typescript
interface UseWidgetRecommendationsParams {
  orgId?: string;
  mappings: DataMapping[];
  plan: number;
}

interface UseWidgetRecommendationsReturn {
  recommendations: WidgetRecommendation[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}
```

### 2.2 Lógica

- Chama a Edge Function `recommend-widgets` quando os mapeamentos mudam
- Filtra recomendações por plano do usuário
- Ordena por score (maior primeiro)
- Cache via React Query

---

## Fase 3: Interface de Recomendações no PreviewStep

### 3.1 Novo Layout

O PreviewStep terá uma seção de recomendações inteligentes:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  ✨ Recomendações Inteligentes                                             │
│  Baseado nos seus dados, sugerimos os seguintes widgets:                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │ ✓ ACEITO   MetricCard - Total de Leads              Score: 95         ││
│  │            Baseado em: COUNT(leads.id)                                 ││
│  │            "Exibe o número total de leads capturados"                  ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │ ✓ ACEITO   MetricCard - Taxa de Conversão           Score: 92         ││
│  │            Baseado em: conversions / total_leads                       ││
│  │            "Percentual de leads convertidos em clientes"               ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │ ? PENDENTE AreaChart - Evolução de Leads             Score: 88         ││
│  │            Baseado em: leads.created_at (temporal)                     ││
│  │            "Gráfico mostrando leads ao longo do tempo"                 ││
│  │            [ Aceitar ]  [ Rejeitar ]  [ Customizar ]                   ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Estados de Recomendação

| Estado | Cor | Ação |
|--------|-----|------|
| Pendente | Amarelo/âmbar | Aguardando decisão do usuário |
| Aceito | Verde | Widget será incluído no dashboard |
| Rejeitado | Vermelho/cinza | Widget não será incluído |
| Customizado | Azul | Usuário alterou configurações |

---

## Fase 4: Componente WidgetRecommendationCard

### 4.1 Props

```typescript
interface WidgetRecommendationCardProps {
  recommendation: WidgetRecommendation;
  status: 'pending' | 'accepted' | 'rejected' | 'customized';
  onAccept: () => void;
  onReject: () => void;
  onCustomize: () => void;
}
```

### 4.2 Features

- Badge com score (cor baseada no valor: 90+ verde, 70-89 azul, <70 amarelo)
- Ícone do tipo de widget
- Descrição da justificativa (basedOn)
- Tooltip com configurações sugeridas
- Botões de ação com feedback visual

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useWidgetRecommendations.ts` | Hook para buscar recomendações via Edge Function |
| `src/components/onboarding/WidgetRecommendationCard.tsx` | Card de recomendação individual |
| `src/components/onboarding/WidgetRecommendationList.tsx` | Lista de recomendações com estado |

---

## Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `supabase/functions/recommend-widgets/index.ts` | Aprimorar algoritmo de recomendação |
| `src/components/onboarding/steps/PreviewStep.tsx` | Integrar sistema de recomendações |
| `src/components/onboarding/OnboardingWizard.tsx` | Passar mapeamentos corretos |
| `src/lib/types.ts` | Adicionar novos tipos se necessário |

---

## Detalhes Técnicos

### Algoritmo de Recomendação Aprimorado

```text
1. ANALISAR MAPEAMENTOS
   - Para cada mapping, identificar:
     - target_metric (total_leads, revenue, etc.)
     - transform_type (currency, percentage, date)
     - aggregation (count, sum, avg)

2. GERAR REGRAS DE SCORE
   - Métricas principais (leads, revenue, conversion_rate): +95 score
   - Métricas secundárias (avg_ticket, growth_rate): +85 score
   - Dados temporais detectados: +88 score (AreaChart)
   - Dados categóricos detectados: +87 score (PieChart)
   - Combinação leads + conversions: +89 score (Funnel)

3. FILTRAR POR PLANO
   - Plano 1: MetricCard, AreaChart, BarChart, Table
   - Plano 2: + LineChart, PieChart, DonutChart, Funnel
   - Plano 3+: + RadarChart, InsightCard (IA)

4. ORDENAR E RETORNAR
   - Ordenar por score descendente
   - Limitar a top 10 recomendações
   - Incluir config sugerida para cada widget
```

### Transição do MappingStep para PreviewStep

Quando o usuário avança do step 3 para o step 4:
1. Os mapeamentos são enviados para a Edge Function
2. A função analisa e retorna recomendações rankeadas
3. O PreviewStep exibe as recomendações automaticamente
4. Usuário aceita/rejeita cada uma
5. Widgets aceitos são usados para gerar o dashboard

---

## Resultado Final

Após implementação:

- **Recomendações automáticas** baseadas nos dados mapeados
- **Scores de relevância** com justificativas claras
- **Interface interativa** para aceitar/rejeitar/customizar
- **Filtro por plano** respeitando limitações
- **Preview dinâmico** mostrando apenas widgets aceitos
- **Configurações otimizadas** para cada tipo de widget
- **UX de alta qualidade** com feedback visual e animações

