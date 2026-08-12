
# Plano: Conectar Gráficos do Dashboard aos Dados Reais do Supabase Externo

## Problema Identificado

Atualmente, todos os widgets de gráficos (Area, Line, Bar, Pie, Funnel, Table) usam **dados mockados internos**:

```typescript
// AreaChartWidget.tsx - Exemplo do problema
const mockData = [
  { month: 'Jan', leads: 180, conversions: 22 },
  { month: 'Fev', leads: 220, conversions: 28 },
  // ... dados falsos
];
```

Apenas o `MetricCard` está conectado aos dados externos via `useExternalData`.

## Solução

Refatorar **todos os widgets de gráficos** para:
1. Receber dados reais via props (passados pelo `DashboardEngine`)
2. Processar e formatar os dados conforme a configuração do widget (mapeamentos da IA)
3. Manter fallback visual quando não há dados

---

## Arquitetura do Fluxo de Dados

```text
┌─────────────────────────────────────────────────────────────────┐
│                     DashboardEngine                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  useExternalData(orgId, { tableName: config.dataSource })│    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  processDataForWidget(rawData, config)                   │    │
│  │  - Agrupa por campo de data (groupBy)                    │    │
│  │  - Aplica agregações (sum, count, avg)                   │    │
│  │  - Formata labels e valores                              │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐       │
│  │AreaChart │ BarChart │LineChart │ PieChart │ Funnel   │       │
│  │  data=[] │  data=[] │  data=[] │  data=[] │  data=[] │       │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Alterações por Arquivo

### 1. `DashboardEngine.tsx` - Processar e passar dados reais

**Adicionar função de processamento:**
```typescript
interface ChartDataPoint {
  label: string;
  value: number;
  [key: string]: unknown;
}

const processChartData = (
  rawData: Record<string, unknown>[],
  config: WidgetConfig
): ChartDataPoint[] => {
  const { metric, groupBy, aggregation = 'count' } = config;
  
  if (!rawData || rawData.length === 0) return [];
  
  // Agrupar por campo (ex: mês, status, origem)
  const grouped = new Map<string, number[]>();
  
  rawData.forEach(row => {
    const key = String(row[groupBy || 'id'] || 'Outros');
    const value = typeof row[metric] === 'number' 
      ? row[metric] 
      : parseFloat(String(row[metric])) || 1;
    
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(value);
  });
  
  // Aplicar agregação
  return Array.from(grouped.entries()).map(([label, values]) => ({
    label,
    value: aggregation === 'sum' 
      ? values.reduce((a, b) => a + b, 0)
      : aggregation === 'avg'
      ? values.reduce((a, b) => a + b, 0) / values.length
      : values.length, // count
  }));
};
```

**Atualizar renderização dos widgets:**
```typescript
case 'area_chart':
  return (
    <WidgetWrapper>
      <AreaChartWidget
        title={widget.title}
        description={widget.description || ''}
        data={processChartData(externalData?.data || [], config)}
        xAxisKey={config.groupBy || 'label'}
        dataKeys={[config.metric || 'value']}
        isLoading={isLoading}
      />
    </WidgetWrapper>
  );
```

---

### 2. `AreaChartWidget.tsx` - Aceitar dados via props

**Interface atualizada:**
```typescript
interface AreaChartWidgetProps {
  title: string;
  description: string;
  data?: Array<{ label: string; [key: string]: unknown }>;
  xAxisKey?: string;
  dataKeys?: string[];
  isLoading?: boolean;
}
```

**Uso dos dados:**
```typescript
const AreaChartWidget = ({ 
  title, 
  description, 
  data = [],
  xAxisKey = 'label',
  dataKeys = ['value'],
  isLoading = false
}: AreaChartWidgetProps) => {
  // Se não há dados, mostrar placeholder
  const chartData = data.length > 0 ? data : placeholderData;
  const hasRealData = data.length > 0;
  
  return (
    <Card className={cn(!hasRealData && 'opacity-60')}>
      {/* Renderizar gráfico com chartData */}
    </Card>
  );
};
```

---

### 3. `BarChartWidget.tsx` - Mesma refatoração

```typescript
interface BarChartWidgetProps {
  title: string;
  description: string;
  data?: Array<{ label: string; value: number; color?: string }>;
  isLoading?: boolean;
}
```

---

### 4. `LineChartWidget.tsx` - Suportar múltiplas séries

```typescript
interface LineChartWidgetProps {
  title: string;
  description: string;
  data?: Array<{ label: string; [key: string]: unknown }>;
  dataKeys?: string[];
  xAxisKey?: string;
  isLoading?: boolean;
}
```

---

### 5. `PieChartWidget.tsx` - Dados de distribuição

```typescript
interface PieChartWidgetProps {
  title: string;
  description: string;
  data?: Array<{ name: string; value: number; color?: string }>;
  isDonut?: boolean;
  isLoading?: boolean;
}
```

---

### 6. `FunnelWidget.tsx` - Estágios dinâmicos

```typescript
interface FunnelWidgetProps {
  title: string;
  description: string;
  data?: Array<{ stage: string; value: number; color?: string }>;
  isLoading?: boolean;
}
```

---

### 7. `TableWidget.tsx` - Dados genéricos

```typescript
interface TableWidgetProps {
  title: string;
  description: string;
  data?: Record<string, unknown>[];
  columns?: Array<{ key: string; label: string; type?: string }>;
  pageSize?: number;
  isLoading?: boolean;
}
```

---

## Configuração de Widget Expandida

A config dos widgets precisa suportar:

```typescript
interface WidgetConfig {
  dataSource?: string;      // Nome da tabela (ex: "leads")
  metric?: string;          // Campo numérico (ex: "value")
  groupBy?: string;         // Campo de agrupamento (ex: "created_at", "status")
  aggregation?: 'sum' | 'count' | 'avg' | 'min' | 'max';
  columns?: string[];       // Para TableWidget
  funnelField?: string;     // Para FunnelWidget (campo de estágio)
  dateFormat?: string;      // Para gráficos de série temporal
}
```

---

## Estados Visuais

### Loading
```typescript
if (isLoading) {
  return (
    <Card className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">Carregando...</span>
      </div>
    </Card>
  );
}
```

### Sem dados
```typescript
if (!data || data.length === 0) {
  return (
    <Card className="h-full">
      {/* Header */}
      <div className="h-[200px] flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Sem dados disponíveis</p>
        </div>
      </div>
    </Card>
  );
}
```

---

## Fluxo Completo

```text
1. IA mapeia campos → config: { dataSource: "leads", metric: "value", groupBy: "status" }
2. Widget salvo no banco com essa config
3. DashboardEngine carrega widgets
4. Para cada widget:
   a. useExternalData busca dados do Supabase externo
   b. processChartData formata para o tipo de gráfico
   c. Widget renderiza com dados reais
5. Gráfico exibe informações verídicas do cliente
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/dashboard/DashboardEngine.tsx` | Adicionar processamento de dados; passar props para widgets |
| `src/components/dashboard/widgets/AreaChartWidget.tsx` | Aceitar `data`, `xAxisKey`, `dataKeys`, `isLoading` via props |
| `src/components/dashboard/widgets/BarChartWidget.tsx` | Aceitar `data` e `isLoading` via props |
| `src/components/dashboard/widgets/LineChartWidget.tsx` | Aceitar `data`, `dataKeys`, `isLoading` via props |
| `src/components/dashboard/widgets/PieChartWidget.tsx` | Aceitar `data` e `isLoading` via props |
| `src/components/dashboard/widgets/FunnelWidget.tsx` | Aceitar `data` e `isLoading` via props |
| `src/components/dashboard/widgets/TableWidget.tsx` | Aceitar `data`, `columns` e `isLoading` via props |

---

## Benefícios

- **Dados verídicos**: Gráficos mostram informações reais do Supabase do cliente
- **Mapeamento respeitado**: Configurações da IA são aplicadas automaticamente
- **Flexibilidade**: Cada widget pode ter fonte de dados diferente
- **UX consistente**: Estados de loading e vazio bem definidos
- **Escalável**: Fácil adicionar novos tipos de gráficos

