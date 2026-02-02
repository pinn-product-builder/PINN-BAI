
# Plano: Fluxo Completo de Onboarding com Geração de Dashboard

## Resumo Executivo

Reformular o fluxo de criação de organização para um wizard multi-etapa completo que:
1. Coleta dados básicos da organização
2. Configura integrações de dados (Supabase, Google Sheets, CSV)
3. Mapeia colunas/tabelas do banco de dados
4. Gera preview ao vivo do dashboard
5. Confirma e provisiona tudo automaticamente

Os dashboards serão de alto nível visual, com gráficos ricos, explicações detalhadas de cada métrica e design profissional.

---

## Fluxo Visual do Wizard

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WIZARD DE ONBOARDING                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ○ Dados ──────○ Integração ──────○ Mapeamento ──────○ Preview ──────● Fim  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ETAPA 1: Dados Básicos                                                     │
│  - Nome da organização                                                      │
│  - Email/Nome do admin                                                      │
│  - Plano (Starter/Professional/Business/Enterprise)                         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ETAPA 2: Integração de Dados                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Supabase   │  │   Google    │  │   Upload    │  │   API       │         │
│  │   🗄️        │  │   Sheets    │  │    CSV      │  │  Externa    │         │
│  │             │  │    📊       │  │    📁       │  │    🔌       │         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                                             │
│  Configuração dinâmica baseada na fonte selecionada:                        │
│  - Supabase: URL do projeto + Anon Key                                      │
│  - Google Sheets: URL da planilha + credenciais                             │
│  - CSV: Upload de arquivo                                                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ETAPA 3: Mapeamento de Dados                                               │
│  - Listagem automática de tabelas/colunas disponíveis                       │
│  - Seleção de campos para métricas (leads, conversões, receita)             │
│  - Configuração de relacionamentos                                          │
│  - Preview de amostra dos dados                                             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ETAPA 4: Preview do Dashboard                                              │
│  - Visualização completa de como ficará o dashboard                         │
│  - Widgets com dados reais mapeados                                         │
│  - Possibilidade de ajustar layout antes de confirmar                       │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ETAPA 5: Confirmação                                                       │
│  - Resumo de tudo que será criado                                           │
│  - Botão "Provisionar Organização"                                          │
│  - Feedback de progresso                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Componentes do Dashboard de Alto Nível

Cada dashboard gerado terá widgets ricos com:

### Métricas com Contexto
Cada card de métrica incluirá:
- Valor principal grande e destacado
- Variação percentual com indicador visual (seta verde/vermelha)
- Comparação com período anterior
- Tooltip com explicação detalhada da métrica
- Sparkline mini mostrando tendência dos últimos 7 dias

### Gráficos Visuais Profissionais
Tipos de gráficos disponíveis:
- **Area Chart Gradiente**: Para evolução temporal com preenchimento suave
- **Bar Chart Comparativo**: Para comparar categorias/períodos
- **Line Chart Multi-série**: Para múltiplas métricas no tempo
- **Pie/Donut Chart**: Para distribuição percentual
- **Funnel Chart Animado**: Para funis de conversão
- **Radar Chart**: Para análises multidimensionais

Cada gráfico terá:
- Título descritivo
- Legenda clara
- Tooltips informativos
- Cores consistentes do design system
- Animações suaves de entrada
- Botão de info com explicação da métrica

### Painel de Insights IA
- Cards categorizados (Recomendação, Alerta, Tendência)
- Ícones visuais distintos
- Prioridade visual (alta = borda vermelha, média = amarela)
- Explicação detalhada do insight

---

## Arquitetura de Arquivos

### Novos Componentes

```text
src/components/onboarding/
├── OnboardingWizard.tsx          # Container principal do wizard
├── steps/
│   ├── OrganizationStep.tsx      # Etapa 1: dados básicos
│   ├── IntegrationStep.tsx       # Etapa 2: escolha e config de fonte
│   ├── MappingStep.tsx           # Etapa 3: mapeamento de campos
│   ├── PreviewStep.tsx           # Etapa 4: preview do dashboard
│   └── ConfirmationStep.tsx      # Etapa 5: confirmação final
├── integrations/
│   ├── SupabaseIntegration.tsx   # Formulário Supabase
│   ├── GoogleSheetsIntegration.tsx # Formulário Google Sheets
│   ├── CsvUploadIntegration.tsx  # Upload de CSV
│   └── ApiIntegration.tsx        # Config de API externa
└── preview/
    └── DashboardPreview.tsx      # Preview completo do dashboard
```

### Componentes de Dashboard Aprimorados

```text
src/components/dashboard/
├── widgets/
│   ├── MetricCard.tsx            # Card de métrica com sparkline
│   ├── AreaChartWidget.tsx       # Gráfico de área gradiente
│   ├── BarChartWidget.tsx        # Gráfico de barras comparativo
│   ├── LineChartWidget.tsx       # Gráfico de linha multi-série
│   ├── PieChartWidget.tsx        # Gráfico de pizza/donut
│   ├── FunnelWidget.tsx          # Funil de conversão animado
│   ├── RadarChartWidget.tsx      # Gráfico radar
│   ├── TableWidget.tsx           # Tabela de dados paginada
│   └── InsightCard.tsx           # Card de insight IA
├── MetricTooltip.tsx             # Tooltip explicativo para métricas
├── WidgetHeader.tsx              # Header padrão com título + info
└── ChartLegend.tsx               # Legenda customizada
```

---

## Detalhes Técnicos

### 1. Estruturas de Dados Atualizadas (mock-data.ts)

Novas interfaces para suportar múltiplas integrações:

```typescript
interface DataIntegration {
  id: string;
  type: 'supabase' | 'google_sheets' | 'csv' | 'api';
  name: string;
  config: SupabaseConfig | GoogleSheetsConfig | CsvConfig | ApiConfig;
  status: 'pending' | 'connected' | 'error';
  lastSync?: string;
}

interface GoogleSheetsConfig {
  spreadsheetUrl: string;
  sheetName: string;
  headerRow: number;
}

interface ApiConfig {
  baseUrl: string;
  authType: 'bearer' | 'api_key' | 'basic';
  authValue: string;
  endpoint: string;
}

interface DataMapping {
  sourceField: string;
  targetField: string;
  transformation?: 'none' | 'date' | 'number' | 'currency';
}

interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  description: string;        // Explicação da métrica
  position: { x: number; y: number; w: number; h: number };
  config: WidgetConfig;
  dataSource: string;         // Referência ao campo mapeado
}
```

### 2. Widgets com Explicações (exemplo MetricCard)

Cada widget terá propriedade `description` que aparece em:
- Ícone de info (?) no header do widget
- Hover tooltip
- Modal detalhado ao clicar

Exemplo de explicações:
- **Total de Leads**: "Número total de leads capturados no período selecionado. Inclui todos os canais de aquisição configurados."
- **Taxa de Conversão**: "Percentual de leads que se tornaram clientes. Calculado como (Clientes / Leads) x 100."
- **Receita MRR**: "Receita Recorrente Mensal. Soma de todas as assinaturas ativas normalizadas para base mensal."

### 3. Gráficos Aprimorados

Utilizar Recharts com customizações:
- Gradientes SVG para áreas
- Animações de entrada com `isAnimationActive`
- Tooltips customizados com formatação brasileira
- Cores do design system via CSS variables

### 4. Preview em Tempo Real

O componente `DashboardPreview` renderizará:
- Grid responsivo com os widgets selecionados
- Dados mock baseados no mapeamento feito
- Indicador visual de "Preview - dados simulados"
- Botões para ajustar antes de confirmar

---

## Fluxo de Dados Simplificado

```text
1. Admin cria organização
           ↓
2. Seleciona fonte de dados (Supabase/Sheets/CSV)
           ↓
3. Configura credenciais/upload
           ↓
4. Sistema detecta tabelas/colunas disponíveis
           ↓
5. Admin mapeia campos para métricas do dashboard
           ↓
6. Sistema gera preview com dados simulados
           ↓
7. Admin confirma layout
           ↓
8. Sistema provisiona: org + user + dashboard + conexão
           ↓
9. Cliente acessa dashboard pronto
```

---

## Entregáveis

1. **OnboardingWizard.tsx**: Container com navegação entre etapas e estado global
2. **5 Componentes de Etapa**: Cada etapa do wizard
3. **4 Componentes de Integração**: Um para cada tipo de fonte de dados
4. **8 Componentes de Widget**: Widgets visuais de alta qualidade
5. **DashboardPreview.tsx**: Preview completo renderizável
6. **Atualização mock-data.ts**: Novas interfaces e dados mock
7. **Atualização Dashboard.tsx**: Integrar novos widgets
8. **Atualização OrganizationsSettingsCard.tsx**: Link para wizard

---

## Estimativa de Complexidade

| Componente | Complexidade | Prioridade |
|------------|--------------|------------|
| OnboardingWizard | Alta | 1 |
| Etapas do Wizard (5) | Média | 1 |
| Widgets de Dashboard (8) | Alta | 2 |
| Preview Dashboard | Média | 2 |
| Integrações (4) | Média | 3 |

