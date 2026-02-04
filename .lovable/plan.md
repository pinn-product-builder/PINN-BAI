
# Plano: Vincular Widgets ao DataSource do Supabase do Cliente

## Problema Identificado

Os widgets do dashboard não estão buscando dados do Supabase do cliente porque **falta a configuração `dataSource`** nos widgets. 

Atualmente:
- Templates têm widgets com `config: { metric: "total_leads" }` 
- Falta `dataSource: "nome_da_tabela_do_cliente"`
- O `DashboardEngine` só busca dados externos quando `config.dataSource` existe
- Por isso os widgets mostram "Configure Data Source"

O fluxo correto seria:
1. Cliente conecta Supabase → detectamos as tabelas
2. No passo de mapeamento → usuário indica qual tabela usar
3. Ao aplicar template → widgets recebem `dataSource` correto
4. Dashboard carrega → `useExternalData` busca da tabela do cliente

---

## Parte 1: Atualizar Wizard para Capturar Tabela Principal

### 1.1 Modificar OnboardingWizard State

Adicionar novo campo para armazenar a tabela principal selecionada:

```typescript
interface OnboardingWizardState {
  // ... campos existentes
  primaryTable: string | null; // Tabela principal do cliente
}
```

### 1.2 Atualizar MappingStep

O passo de mapeamento já permite selecionar tabelas. Vamos garantir que a tabela selecionada seja propagada para o estado do wizard.

**Alterações:**
- Adicionar callback `onPrimaryTableChange` para notificar a tabela principal
- A primeira tabela selecionada ou a marcada como "primária" será usada como `dataSource`

---

## Parte 2: Vincular DataSource ao Aplicar Template

### 2.1 Modificar `useApplyTemplate`

Atualizar o hook para receber o `dataSource` e injetar em todos os widgets:

```typescript
export const useApplyTemplate = () => {
  return useMutation({
    mutationFn: async ({ 
      templateId, 
      dashboardId,
      dataSource,     // NOVO: tabela do cliente
      metricMappings, // NOVO: mapeamento campo → métrica
    }: { 
      templateId: string; 
      dashboardId: string;
      dataSource?: string;
      metricMappings?: Record<string, { field: string; aggregation: string }>;
    }) => {
      // ... buscar template
      
      // Criar widgets com dataSource injetado
      const widgetsToCreate = templateWidgets.map((tw, index) => ({
        dashboard_id: dashboardId,
        title: tw.title,
        type: tw.type,
        position: index,
        size: tw.size,
        config: {
          ...tw.config,
          // Injetar dataSource se widget usa métricas
          dataSource: dataSource || null,
          // Injetar mapeamento de métrica se disponível
          metric: metricMappings?.[tw.config.metric]?.field || tw.config.metric,
          aggregation: metricMappings?.[tw.config.metric]?.aggregation || 'count',
        },
        description: tw.description,
      }));
      
      // ... inserir widgets
    },
  });
};
```

### 2.2 Atualizar handleComplete no Wizard

Passar o `dataSource` e mapeamentos ao aplicar template:

```typescript
// Em handleComplete:
if (state.selectedTemplateId && state.selectedTemplate) {
  // Pegar tabela principal das seleções
  const primaryTable = state.integration?.selectedTables?.find(t => t.isPrimary)?.tableName 
    || state.integration?.selectedTables?.[0]?.tableName;
  
  // Construir mapeamento de métricas
  const metricMappings = state.mappings.reduce((acc, m) => ({
    ...acc,
    [m.targetMetric]: {
      field: m.sourceField,
      aggregation: m.aggregation || 'count',
    },
  }), {});

  await applyTemplate.mutateAsync({
    templateId: state.selectedTemplateId,
    dashboardId: dashboard.id,
    dataSource: primaryTable,
    metricMappings,
  });
}
```

---

## Parte 3: Garantir Edge Function Funciona

### 3.1 Verificar fetch-client-data

A Edge Function já está correta - ela:
1. Recebe `orgId` e `tableName`
2. Busca credenciais da integração (`projectUrl`, `anonKey`)
3. Cria cliente para Supabase externo
4. Executa query na tabela do cliente

**Já implementado corretamente** - só precisamos garantir que os widgets tenham `config.dataSource`.

---

## Parte 4: Widgets Existentes (Migração)

Para organizações já criadas cujos widgets não têm `dataSource`, criar botão para configurar manualmente ou script de migração.

### 4.1 Adicionar Editor de Widget Config

No `DashboardEngine`, permitir que o admin configure o `dataSource` de um widget existente:

```typescript
// Botão de configuração no hover
<Button onClick={() => openWidgetConfigDialog(widget)}>
  <Settings className="w-4 h-4" />
</Button>

// Dialog para editar config
<WidgetConfigDialog 
  widget={widget}
  availableTables={integration?.tables}
  onSave={(newConfig) => updateWidgetConfig(widget.id, newConfig)}
/>
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useTemplates.ts` | Adicionar parâmetros `dataSource` e `metricMappings` ao `useApplyTemplate` |
| `src/components/onboarding/OnboardingWizard.tsx` | Passar `dataSource` e mapeamentos no `handleComplete` |
| `src/components/onboarding/steps/MappingStep.tsx` | Expor tabela primária selecionada |
| `src/components/dashboard/DashboardEngine.tsx` | (Opcional) Adicionar editor de widget config |

---

## Fluxo Atualizado

```text
1. Admin cria org → conecta Supabase do cliente
2. Sistema detecta tabelas (ex: "leads", "vendas")
3. Admin seleciona tabela "leads" como primária
4. Admin mapeia campos:
   - leads.id → total_leads (count)
   - leads.status = 'converted' → conversions (count)
   - leads.value → revenue (sum)
5. Ao finalizar → template é aplicado com:
   - config.dataSource = "leads"
   - config.metric = "id" (mapeado de total_leads)
   - config.aggregation = "count"
6. Dashboard carrega → useExternalData busca de "leads"
7. Widget exibe dados reais do Supabase do cliente
```

---

## Resultado Esperado

- Widgets do dashboard puxam dados do Supabase do cliente automaticamente
- Configuração `dataSource` é injetada durante o provisionamento
- Mapeamentos definem qual campo/agregação usar por métrica
- Edge Function `fetch-client-data` retorna dados em tempo real
