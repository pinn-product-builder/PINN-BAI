
# Plano: Dashboard do Cliente com Widgets de Alta Qualidade

## Resumo

Refatorar a página `src/pages/client/Dashboard.tsx` para utilizar os novos componentes de widgets de alta qualidade já criados, substituindo a implementação inline atual por componentes reutilizáveis, profissionais e ricos em informações visuais.

## O Que Será Feito

### Layout do Novo Dashboard

O novo dashboard terá:
- **Header**: Título, nome da organização, seletor de período e botão de edição
- **4 Metric Cards**: Cards de métricas com sparklines e tooltips explicativos
- **2 Charts Principais**: AreaChart (Evolução) + LineChart (Multi-métricas)
- **2 Charts Secundários**: BarChart (Por Canal) + PieChart (Distribuição)
- **Funil de Vendas**: Widget dedicado com taxas de conversão
- **Insights IA**: Painel com recomendações categorizadas por prioridade

### Componentes Utilizados

| Widget | Arquivo | Descrição |
|--------|---------|-----------|
| MetricCard | `widgets/MetricCard.tsx` | 4 métricas com sparklines e trends |
| AreaChartWidget | `widgets/AreaChartWidget.tsx` | Gráfico de área com gradiente |
| LineChartWidget | `widgets/LineChartWidget.tsx` | Multi-série com 2 eixos Y |
| BarChartWidget | `widgets/BarChartWidget.tsx` | Barras horizontais por canal |
| PieChartWidget | `widgets/PieChartWidget.tsx` | Distribuição com donut opcional |
| FunnelWidget | `widgets/FunnelWidget.tsx` | Funil animado com conversões |
| InsightCard | `widgets/InsightCard.tsx` | Insights IA categorizados |

---

## Estrutura Visual

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  Dashboard                                              [Período] [Editar]   │
│  TechCorp Solutions                                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │ Total Leads  │ │ Conversões   │ │ Taxa Conv.   │ │ Receita MRR  │         │
│  │    2.450     │ │     156      │ │    12.5%     │ │  R$ 458k     │         │
│  │ ▲ +16.7%     │ │ ▲ +22.0%     │ │ ▲ +4.2%      │ │ ▲ +23.4%     │         │
│  │  ~~~~~~~~    │ │  ~~~~~~~~    │ │  ~~~~~~~~    │ │  ~~~~~~~~    │         │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘         │
│                                                                              │
│  ┌─────────────────────────────────────┐ ┌─────────────────────────────────┐ │
│  │  Evolução de Leads (Area Chart)     │ │  Métricas Combinadas (Line)     │ │
│  │                                     │ │                                 │ │
│  │      ████████████                   │ │      /\    /\                   │ │
│  │    ██            ██                 │ │     /  \  /  \                  │ │
│  │  ██                ██               │ │    /    \/    \                 │ │
│  │                                     │ │                                 │ │
│  └─────────────────────────────────────┘ └─────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐  │
│  │  Leads por Canal     │ │  Status dos Leads    │ │  Funil de Vendas     │  │
│  │  (Bar Horizontal)    │ │  (Donut Chart)       │ │                      │  │
│  │                      │ │        ___           │ │  Visitantes ████████ │  │
│  │  Google Ads ████████ │ │       /   \          │ │  Leads      ██████   │  │
│  │  LinkedIn   █████    │ │      | 2.1k|         │ │  Opport.    ████     │  │
│  │  Referral   ███      │ │       \___/          │ │  Propostas  ██       │  │
│  └──────────────────────┘ └──────────────────────┘ └──────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │  ✨ Insights IA                                                          ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐ ││
│  │  │ 💡 [Alta] Taxa de conversão aumentou 15%...                         │ ││
│  │  └─────────────────────────────────────────────────────────────────────┘ ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐ ││
│  │  │ ⚠️ [Média] Queda de 8% nos leads B2B...                             │ ││
│  │  └─────────────────────────────────────────────────────────────────────┘ ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Detalhes Técnicos

### Arquivo Modificado

**`src/pages/client/Dashboard.tsx`**

Mudanças principais:
1. Importar os novos componentes de widgets
2. Remover implementações inline de charts
3. Substituir por componentes reutilizáveis
4. Adicionar descrições explicativas para cada métrica
5. Melhorar o grid layout para acomodar mais widgets

### Métricas com Explicações

Cada métrica terá um tooltip detalhado:

| Métrica | Descrição |
|---------|-----------|
| Total de Leads | Número total de leads capturados no período. Inclui todos os canais de aquisição. |
| Conversões | Leads que se tornaram clientes pagantes. Calculado pela mudança de status para "Cliente". |
| Taxa de Conversão | Percentual de leads convertidos. Fórmula: (Clientes / Total Leads) x 100. |
| Receita MRR | Receita Recorrente Mensal. Soma de todas as assinaturas ativas normalizadas. |

### Grid Responsivo

O layout utilizará CSS Grid com breakpoints:
- Mobile: 1 coluna
- Tablet: 2 colunas
- Desktop: 4 colunas para métricas, 2-3 para charts

---

## Benefícios

1. **Código Limpo**: Componentes reutilizáveis em vez de código duplicado
2. **Consistência Visual**: Todos os widgets seguem o mesmo design system
3. **Tooltips Informativos**: Cada métrica tem explicação detalhada
4. **Sparklines**: Mini gráficos de tendência em cada card
5. **Gradientes e Animações**: Visual de alta qualidade com Recharts
6. **Acessibilidade**: Cores com contraste adequado e textos descritivos

---

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/pages/client/Dashboard.tsx` | Reescrever com novos widgets |
