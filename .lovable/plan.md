
# Plano: Templates com Preview Visual + Seleção no Onboarding + Aplicação Automática

## Status: ✅ CONCLUÍDO

---

## Visão Geral

Este plano implementa três funcionalidades integradas para melhorar a experiência de provisionamento de organizações:

1. **Preview visual de templates** com miniatura mostrando layout dos widgets ✅
2. **Step de seleção de template** no wizard de onboarding ✅
3. **Aplicação automática do template** ao criar a organização (copiar widgets para o dashboard) ✅

---

## Parte 1: Componente de Preview Visual de Templates

### 1.1 Criar Componente `TemplatePreviewCard`

Criar um novo componente que renderiza uma miniatura visual do template mostrando o layout dos widgets em escala reduzida.

**Arquivo:** `src/components/admin/TemplatePreviewCard.tsx`

**Funcionalidades:**
- Miniatura em grid mostrando posição relativa dos widgets
- Cores diferentes para cada tipo de widget (métricas, gráficos, tabelas)
- Tooltip com nome do widget ao passar o mouse
- Badges mostrando quantidade de cada tipo
- Animação sutil ao hover

**Estrutura Visual:**
```text
+-------------------------------+
|  [Logo]  Template Starter     |
|  Plano: Básico                |
+-------------------------------+
|  [■][■][■][■]  <- métricas    |
|  [████████]    <- área chart  |
|  [███] [███]   <- bar/pie     |
|  [████] [████] <- insights    |
+-------------------------------+
|  5 widgets • 2 orgs usando    |
+-------------------------------+
```

### 1.2 Atualizar Página de Templates Admin

**Arquivo:** `src/pages/admin/Templates.tsx`

**Alterações:**
- Importar e usar `TemplatePreviewCard` em vez do card básico atual
- Adicionar hover state para mostrar preview expandido
- Manter botões de ação (editar, duplicar, deletar)

---

## Parte 2: Step de Seleção de Template no Wizard

### 2.1 Criar Novo Step `TemplateStep`

**Arquivo:** `src/components/onboarding/steps/TemplateStep.tsx`

**Funcionalidades:**
- Grid de templates disponíveis para o plano selecionado
- Usa `useTemplates(plan)` para filtrar por plano
- Cada card é clicável com estado de seleção visual
- Preview miniatura do layout de widgets
- Botão "Usar este template" ou seleção por clique
- Opção "Começar do zero" para não usar template

**Props:**
```typescript
interface TemplateStepProps {
  plan: 1 | 2 | 3 | 4;
  selectedTemplateId: string | null;
  onSelect: (templateId: string | null) => void;
}
```

### 2.2 Atualizar OnboardingWizard

**Arquivo:** `src/components/onboarding/OnboardingWizard.tsx`

**Alterações:**

1. **Adicionar novo step na lista STEPS:**
```typescript
const STEPS = [
  { id: 1, title: 'Organização', icon: Building2, description: 'Dados básicos' },
  { id: 2, title: 'Template', icon: LayoutTemplate, description: 'Base do dashboard' }, // NOVO
  { id: 3, title: 'Integração', icon: Database, description: 'Fonte de dados' },
  { id: 4, title: 'Mapeamento', icon: MapPin, description: 'Campos e métricas' },
  { id: 5, title: 'Preview', icon: LayoutDashboard, description: 'Visualização' },
  { id: 6, title: 'Confirmação', icon: CheckCircle2, description: 'Finalizar' },
];
```

2. **Adicionar estado para template selecionado:**
```typescript
interface OnboardingWizardState {
  // ... campos existentes
  selectedTemplateId: string | null;
  selectedTemplate: DashboardTemplate | null;
}
```

3. **Atualizar renderStep para incluir TemplateStep:**
```typescript
case 2:
  return (
    <TemplateStep
      plan={state.organization.plan}
      selectedTemplateId={state.selectedTemplateId}
      onSelect={updateTemplate}
    />
  );
```

4. **Pré-popular widgets baseado no template:**
Quando um template é selecionado, converter seus widgets para `DashboardWidgetConfig[]` e passar para PreviewStep como valores iniciais.

---

## Parte 3: Aplicação do Template ao Criar Organização

### 3.1 Atualizar NewOrganization

**Arquivo:** `src/pages/admin/NewOrganization.tsx`

**Alterações:**
- Remover a criação manual de widgets hardcoded (linhas 67-109)
- Manter apenas a criação do dashboard vazio
- Os widgets serão criados no passo final do wizard baseado no template

### 3.2 Atualizar ConfirmationStep / handleComplete

**Arquivo:** `src/components/onboarding/steps/ConfirmationStep.tsx` e `OnboardingWizard.tsx`

**Alterações em handleComplete:**

```typescript
const handleComplete = async () => {
  setIsSubmitting(true);

  try {
    // 1. Buscar dashboard da organização
    const { data: dashboard } = await supabase
      .from('dashboards')
      .select('id')
      .eq('org_id', state.organizationId)
      .eq('is_default', true)
      .single();

    // 2. Se há template selecionado, copiar widgets
    if (state.selectedTemplate && dashboard) {
      const templateWidgets = state.selectedTemplate.widgets;
      
      const widgetsToCreate = templateWidgets.map((tw, index) => ({
        dashboard_id: dashboard.id,
        title: tw.title,
        type: tw.type as WidgetType,
        position: index,
        size: tw.size,
        config: tw.config,
        description: tw.description || null,
      }));

      await supabase
        .from('dashboard_widgets')
        .insert(widgetsToCreate);

      // 3. Incrementar contador de uso do template
      await incrementTemplateUsage(state.selectedTemplateId);
    } 
    // Alternativa: se não há template, usar widgets selecionados manualmente
    else if (state.selectedWidgets.length > 0 && dashboard) {
      const widgetsToCreate = state.selectedWidgets.map((w, index) => ({
        dashboard_id: dashboard.id,
        title: w.title,
        type: w.type as WidgetType,
        position: index,
        config: w.config,
        description: w.description || null,
      }));

      await supabase
        .from('dashboard_widgets')
        .insert(widgetsToCreate);
    }

    // 4. Salvar integração se configurada
    if (state.integration) {
      await supabase
        .from('integrations')
        .insert({
          org_id: state.organizationId,
          type: state.integration.type,
          name: state.integration.name,
          config: state.integration.config,
          status: 'connected',
        });
    }

    // 5. Salvar mapeamentos
    if (state.mappings.length > 0) {
      const mappingsToCreate = state.mappings.map(m => ({
        org_id: state.organizationId,
        source_table: m.sourceTable,
        source_field: m.sourceField,
        target_metric: m.targetMetric,
        transformation: m.transformation,
      }));

      await supabase
        .from('data_mappings')
        .insert(mappingsToCreate);
    }

    setState(prev => ({ ...prev, isComplete: true }));
    
    toast({
      title: 'Organização provisionada com sucesso!',
      description: `${state.organization.name} está pronta para uso.`,
    });

    setTimeout(() => navigate('/admin/organizations'), 2000);
    
  } catch (error) {
    toast({
      title: 'Erro ao provisionar',
      description: error.message,
      variant: 'destructive',
    });
  } finally {
    setIsSubmitting(false);
  }
};
```

### 3.3 Adicionar Hook `useApplyTemplate`

**Arquivo:** `src/hooks/useTemplates.ts`

**Nova função:**
```typescript
export const useApplyTemplate = () => {
  return useMutation({
    mutationFn: async ({ 
      templateId, 
      dashboardId 
    }: { 
      templateId: string; 
      dashboardId: string 
    }) => {
      // Buscar template
      const { data: template, error: fetchError } = await supabase
        .from('dashboard_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (fetchError || !template) throw new Error('Template não encontrado');

      // Criar widgets baseados no template
      const widgets = (template.widgets as TemplateWidget[]).map((tw, index) => ({
        dashboard_id: dashboardId,
        title: tw.title,
        type: tw.type,
        position: index,
        size: tw.size,
        config: tw.config,
      }));

      const { error: insertError } = await supabase
        .from('dashboard_widgets')
        .insert(widgets);

      if (insertError) throw insertError;

      // Incrementar uso
      await supabase
        .from('dashboard_templates')
        .update({ usage_count: (template.usage_count || 0) + 1 })
        .eq('id', templateId);

      return template;
    },
  });
};
```

---

## Parte 4: Exibir Template na Confirmação

### 4.1 Atualizar ConfirmationStep

**Arquivo:** `src/components/onboarding/steps/ConfirmationStep.tsx`

**Alterações:**
- Adicionar seção mostrando o template selecionado
- Se nenhum template, mostrar widgets customizados
- Ícone e nome do template com preview miniatura

```typescript
{/* Template Info */}
{state.selectedTemplate && (
  <Card className="p-4">
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
        <LayoutTemplate className="w-5 h-5 text-indigo-500" />
      </div>
      <div className="flex-1">
        <h3 className="font-medium text-foreground">Template Base</h3>
        <p className="text-sm text-foreground">{state.selectedTemplate.name}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {state.selectedTemplate.widgets.length} widgets serão criados
        </p>
      </div>
    </div>
  </Card>
)}
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/admin/TemplatePreviewCard.tsx` | Criar | Componente de preview visual |
| `src/components/onboarding/steps/TemplateStep.tsx` | Criar | Step de seleção de template |
| `src/components/onboarding/OnboardingWizard.tsx` | Modificar | Adicionar step e estado |
| `src/pages/admin/Templates.tsx` | Modificar | Usar preview cards |
| `src/pages/admin/NewOrganization.tsx` | Modificar | Remover widgets hardcoded |
| `src/components/onboarding/steps/ConfirmationStep.tsx` | Modificar | Mostrar template selecionado |
| `src/hooks/useTemplates.ts` | Modificar | Adicionar useApplyTemplate |

---

## Seção Técnica

### Interface do TemplatePreviewCard

```typescript
interface TemplatePreviewCardProps {
  template: DashboardTemplate;
  isSelected?: boolean;
  onSelect?: () => void;
  showActions?: boolean;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}
```

### Cores por Tipo de Widget na Miniatura

```typescript
const widgetColors: Record<string, string> = {
  metric_card: 'bg-emerald-500',
  line_chart: 'bg-blue-500',
  area_chart: 'bg-cyan-500',
  bar_chart: 'bg-amber-500',
  pie_chart: 'bg-purple-500',
  funnel: 'bg-pink-500',
  table: 'bg-slate-500',
  insight_card: 'bg-indigo-500',
};
```

### Grid Layout da Miniatura

```typescript
// Simular grid de 12 colunas em miniatura
const sizeToGridSpan: Record<string, number> = {
  small: 3,
  medium: 4,
  large: 6,
  full: 12,
};
```

---

## Fluxo Completo do Usuário

```text
1. Admin cria organização → salva org + dashboard vazio
2. Wizard abre no Step 2 (Template)
3. Admin vê grid de templates com previews visuais
4. Admin clica em template → preview destaca seleção
5. Próximo → Step 3 (Integração) → conecta Supabase
6. Próximo → Step 4 (Mapeamento) → configura campos
7. Próximo → Step 5 (Preview) → widgets do template + ajustes
8. Próximo → Step 6 (Confirmação) → mostra resumo com template
9. Provisionar → copia widgets do template para dashboard real
10. Incrementa usage_count do template
11. Organização pronta com dashboard completo
```

---

## Resultado Esperado

- Templates com preview visual mostrando layout miniatura
- Seleção intuitiva de template durante onboarding
- Aplicação automática de widgets ao finalizar provisionamento
- Contador de uso atualizado em tempo real
- Experiência fluida e profissional de provisionamento
