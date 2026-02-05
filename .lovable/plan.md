

# Plano: Aceitar/Rejeitar Sugestões Individuais + Histórico de Mapeamentos

## Resumo

Este plano implementa duas melhorias no fluxo de mapeamento do onboarding:
1. **Controle individual de sugestões IA** - Aceitar ou rejeitar cada sugestão antes de aplicar
2. **Histórico de mapeamentos** - Salvar métricas customizadas para reutilização futura

---

## Funcionalidade 1: Aceitar/Rejeitar Sugestões Individuais

### Comportamento Atual
- IA gera sugestões e exibe lista
- Usuário pode apenas "Aplicar Todos" ou "Personalizar" (fechar)

### Novo Comportamento
- Cada sugestão terá botões de aceitar (check) e rejeitar (X)
- Sugestões rejeitadas ficam visualmente marcadas mas não são removidas
- Botão "Aplicar Selecionados" aplica apenas as sugestões aceitas
- Contador mostra quantas foram aceitas/rejeitadas

```text
+----------------------------------------------------------+
| Sugestão IA                                              |
+----------------------------------------------------------+
| [✓] 95%  tabela.coluna → Receita Total   [✓] [✗]        |
| [✓] 88%  tabela.data → Data Criação      [✓] [✗]        |
| [✗] 72%  tabela.status → Funil           [✓] [✗]  ← rejeitada (opaca)
+----------------------------------------------------------+
| Aceitas: 2/3  | [Aplicar Selecionados] [Limpar Seleção] |
+----------------------------------------------------------+
```

---

## Funcionalidade 2: Histórico de Mapeamentos Customizados

### Nova Tabela no Banco de Dados

```sql
CREATE TABLE saved_custom_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  metric_name TEXT NOT NULL,        -- ex: "receita_mensal"
  display_label TEXT NOT NULL,      -- ex: "Receita Mensal"
  description TEXT,                 -- descrição opcional
  transformation TEXT,              -- tipo de transformação padrão
  usage_count INTEGER DEFAULT 1,    -- quantas vezes foi usada
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, metric_name)
);
```

### Fluxo de Uso
1. Quando usuário digita uma métrica customizada (não predefinida), ela é salva automaticamente
2. No dropdown de métricas, seção "Métricas Recentes" aparece acima das predefinidas
3. Métricas mais usadas aparecem primeiro
4. Administrador pode ver/gerenciar métricas salvas

---

## Detalhamento Técnico

### Arquivo: `MappingStep.tsx`

**Novos estados para controle individual:**
```typescript
// Estado para rastrear sugestões aceitas/rejeitadas
const [suggestionStates, setSuggestionStates] = useState<Record<number, 'accepted' | 'rejected' | 'pending'>>({});

// Contadores derivados
const acceptedCount = Object.values(suggestionStates).filter(s => s === 'accepted').length;
const rejectedCount = Object.values(suggestionStates).filter(s => s === 'rejected').length;
```

**Novas funções:**
```typescript
// Toggle individual suggestion
const toggleSuggestion = (index: number, state: 'accepted' | 'rejected') => {
  setSuggestionStates(prev => ({
    ...prev,
    [index]: prev[index] === state ? 'pending' : state
  }));
};

// Apply only accepted suggestions
const applyAcceptedSuggestions = () => {
  const acceptedMappings = aiSuggestions
    .filter((_, idx) => suggestionStates[idx] === 'accepted')
    .map((suggestion, idx) => ({...}));
  onUpdate([...mappings, ...acceptedMappings]);
};

// Reset all to pending
const resetSelections = () => setSuggestionStates({});
```

**Nova interface de sugestão:**
```typescript
<div className={cn(
  "flex items-center gap-3 p-3 rounded-lg border transition-all",
  suggestionStates[idx] === 'rejected' && "opacity-40 bg-muted/30",
  suggestionStates[idx] === 'accepted' && "border-green-500/50 bg-green-500/5"
)}>
  {/* Conteúdo existente */}
  
  {/* Novos botões de ação */}
  <div className="flex gap-1 shrink-0">
    <Button 
      size="icon" 
      variant={suggestionStates[idx] === 'accepted' ? 'default' : 'ghost'}
      onClick={() => toggleSuggestion(idx, 'accepted')}
    >
      <Check className="w-4 h-4" />
    </Button>
    <Button 
      size="icon" 
      variant={suggestionStates[idx] === 'rejected' ? 'destructive' : 'ghost'}
      onClick={() => toggleSuggestion(idx, 'rejected')}
    >
      <X className="w-4 h-4" />
    </Button>
  </div>
</div>
```

### Arquivo: Nova Migration SQL

```sql
-- Tabela para métricas customizadas salvas
CREATE TABLE public.saved_custom_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  display_label TEXT NOT NULL,
  description TEXT,
  transformation TEXT DEFAULT 'none',
  usage_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, metric_name)
);

-- RLS
ALTER TABLE public.saved_custom_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage all metrics"
  ON public.saved_custom_metrics FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Org users can view their metrics"
  ON public.saved_custom_metrics FOR SELECT
  USING (org_id = public.get_user_org_id(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_saved_custom_metrics_updated_at
  BEFORE UPDATE ON public.saved_custom_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

### Hook: `useSavedMetrics.ts`

```typescript
// Buscar métricas salvas da organização
const { data: savedMetrics } = useQuery({
  queryKey: ['saved-metrics', orgId],
  queryFn: async () => {
    const { data } = await supabase
      .from('saved_custom_metrics')
      .select('*')
      .order('usage_count', { ascending: false })
      .limit(10);
    return data || [];
  },
});

// Salvar/atualizar métrica customizada
const saveCustomMetric = async (metric: { 
  name: string; 
  label: string; 
  orgId: string 
}) => {
  await supabase
    .from('saved_custom_metrics')
    .upsert({
      org_id: metric.orgId,
      metric_name: metric.name,
      display_label: metric.label,
    }, { onConflict: 'org_id,metric_name' });
};
```

### Integração no MappingStep

```typescript
// No Popover de métricas destino
<PopoverContent>
  <Input ... />
  
  {/* Seção de métricas recentes/salvas */}
  {savedMetrics.length > 0 && (
    <div className="border-b pb-2 mb-2">
      <p className="text-xs text-muted-foreground px-2 mb-1">Recentes</p>
      {savedMetrics.slice(0, 5).map(m => (
        <button onClick={() => updateMapping(id, { targetMetric: m.metric_name })}>
          {m.display_label}
          <Badge>{m.usage_count}x</Badge>
        </button>
      ))}
    </div>
  )}
  
  {/* Métricas predefinidas existentes */}
  {TARGET_METRICS.map(...)}
</PopoverContent>
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/onboarding/steps/MappingStep.tsx` | Adicionar estados de seleção individual, botões aceitar/rejeitar, integrar métricas salvas |
| `src/hooks/useSavedMetrics.ts` | **Novo** - Hook para gerenciar métricas customizadas |
| `src/integrations/supabase/types.ts` | Será atualizado automaticamente após migration |
| `supabase/migrations/XXXX_add_saved_custom_metrics.sql` | **Novo** - Criar tabela |

---

## Fluxo de Usuário Final

```text
1. Usuário clica "Gerar Mapeamentos"
2. IA retorna 8 sugestões
3. Usuário vê painel com todas sugestões em estado "pendente"
4. Usuário clica ✓ em 5 sugestões que fazem sentido
5. Usuário clica ✗ em 2 sugestões irrelevantes
6. Usuário ignora 1 sugestão (fica pendente)
7. Contador mostra "5 aceitas / 2 rejeitadas / 1 pendente"
8. Usuário clica "Aplicar Selecionados"
9. 5 mapeamentos são criados
10. Usuário adiciona manualmente uma métrica customizada "taxa_churn"
11. Sistema salva "taxa_churn" no histórico
12. Em futuros onboardings, "taxa_churn" aparece na seção "Recentes"
```

---

## Considerações

- Métricas customizadas são salvas por organização para contexto relevante
- O campo `usage_count` permite ordenar por popularidade
- RLS garante que cada org veja apenas suas métricas
- Sugestões rejeitadas não são perdidas - usuário pode mudar de ideia antes de aplicar

