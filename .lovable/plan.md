# Plano: Templates Persistidos no Banco + Listagem Completa de Tabelas

## Status: ✅ IMPLEMENTADO

---

## Parte 1: Templates de Dashboard Persistidos ✅

### 1.1 Tabela `dashboard_templates` ✅
- Tabela criada com campos: id, name, description, plan, category, widgets (JSONB), preview_image_url, is_active, usage_count, created_by, created_at, updated_at
- RLS configurado: platform_admin para CRUD, authenticated para SELECT

### 1.2 Seed de Templates Padrão ✅
- Dashboard Starter (Plan 1): 3 widgets básicos
- Dashboard Professional (Plan 2): 6 widgets com gráficos
- Dashboard Business (Plan 3): 9 widgets completos
- Dashboard Enterprise (Plan 4): 14 widgets premium

### 1.3 Hook `useTemplates` ✅
**Arquivo:** `src/hooks/useTemplates.ts`
- useTemplates() - Lista templates ativos
- useAllTemplates() - Lista todos (para admin)
- useCreateTemplate() - Criar novo
- useUpdateTemplate() - Atualizar
- useDeleteTemplate() - Deletar
- useDuplicateTemplate() - Duplicar
- useIncrementTemplateUsage() - Incrementar contador

### 1.4 Página de Templates Atualizada ✅
**Arquivo:** `src/pages/admin/Templates.tsx`
- Busca templates reais do banco
- Skeleton loading state
- Botões de Editar, Duplicar, Deletar funcionais
- Modal de edição completo

### 1.5 Editor de Templates ✅
**Arquivo:** `src/components/admin/TemplateEditor.tsx`
- Modal para criar/editar templates
- Seleção de plano mínimo
- Adição de widgets com tipo, título e tamanho
- Remoção de widgets

---

## Parte 2: Listagem Completa de Tabelas ✅

### 2.1 Edge Function Atualizada ✅
**Arquivo:** `supabase/functions/test-supabase-connection/index.ts`
- Estratégia 1: RPC get_public_tables (se existir)
- Estratégia 2: RPC list_tables (alternativa)
- Estratégia 3: Pattern discovery com 300+ nomes comuns
- Retorna método de descoberta usado

### 2.2 UI TableSelection Melhorada ✅
**Arquivo:** `src/components/onboarding/TableSelection.tsx`
- Alerta informativo quando usando pattern_discovery
- Estado vazio com instruções
- Botão para copiar SQL da função helper
- Props adicionais: isLoading, discoveryMethod

### 2.3 RPC Helper Function (Sugestão ao usuário)
```sql
CREATE OR REPLACE FUNCTION get_public_tables()
RETURNS TABLE(table_name text)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT table_name::text 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE';
$$;
```

---

## Arquivos Criados/Modificados

| Arquivo | Status |
|---------|--------|
| `src/hooks/useTemplates.ts` | ✅ Criado |
| `src/components/admin/TemplateEditor.tsx` | ✅ Criado |
| `src/pages/admin/Templates.tsx` | ✅ Modificado |
| `supabase/functions/test-supabase-connection/index.ts` | ✅ Modificado |
| `src/components/onboarding/TableSelection.tsx` | ✅ Modificado |

---

## Próximos Passos Sugeridos

1. Integrar seleção de template no wizard de onboarding
2. Implementar aplicação de template ao criar dashboard
3. Adicionar preview visual dos templates
