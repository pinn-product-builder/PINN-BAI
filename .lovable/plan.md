
# Plano: Templates Persistidos no Banco + Listagem Completa de Tabelas

## Visão Geral

Este plano aborda duas necessidades críticas:
1. **Templates de Dashboard**: Transformar de dados mock para persistência real no banco de dados
2. **Listagem de Tabelas**: Usar `information_schema` para listar TODAS as tabelas do banco conectado, não apenas uma lista pré-definida

---

## Parte 1: Templates de Dashboard Persistidos

### 1.1 Nova Tabela `dashboard_templates`

Criar tabela para armazenar templates reutilizáveis:

```sql
CREATE TABLE dashboard_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  plan INTEGER NOT NULL DEFAULT 1,
  category TEXT DEFAULT 'sales',
  widgets JSONB NOT NULL DEFAULT '[]',
  preview_image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Widgets JSONB Structure:**
```json
[
  {
    "type": "metric_card",
    "title": "Total de Leads",
    "size": "small",
    "config": { "metric": "total_leads", "showTrend": true }
  },
  {
    "type": "funnel",
    "title": "Funil de Vendas",
    "size": "large",
    "config": { "stages": ["new", "qualified", "proposal", "converted"] }
  }
]
```

### 1.2 Seed de Templates Padrão

Inserir os 4 templates base na migração:

- **Dashboard Starter** (Plan 1): 3 widgets básicos
- **Dashboard Professional** (Plan 2): 6 widgets com gráficos
- **Dashboard Business** (Plan 3): 9 widgets completos
- **Dashboard Enterprise** (Plan 4): 14 widgets premium

### 1.3 Hook `useTemplates`

Criar hook para CRUD de templates:

**Arquivo:** `src/hooks/useTemplates.ts`

```typescript
export const useTemplates = () => {
  return useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboard_templates')
        .select('*')
        .eq('is_active', true)
        .order('plan', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateTemplate = () => { ... };
export const useUpdateTemplate = () => { ... };
export const useDeleteTemplate = () => { ... };
export const useApplyTemplate = () => { ... };
```

### 1.4 Atualizar Página de Templates

Modificar `src/pages/admin/Templates.tsx` para:

- Buscar templates reais do banco via `useTemplates()`
- Implementar botões de Editar, Duplicar, Deletar
- Modal para criar novo template
- Contador de uso real (quantas orgs usam cada template)
- Preview visual do template

### 1.5 Integração com Onboarding

Adicionar step de seleção de template no wizard:

- Mostrar templates disponíveis para o plano selecionado
- Preview dos widgets incluídos
- Botão "Usar este template" que pré-popula o dashboard

---

## Parte 2: Listagem Completa de Tabelas via Information Schema

### 2.1 Atualizar Edge Function `test-supabase-connection`

**Problema atual:** Lista pré-definida de ~60 nomes comuns

**Solução:** Criar RPC function no banco externo OU tentar acessar via PostgREST

**Nova Estratégia:**

```typescript
// Tentar consultar information_schema diretamente
// Se falhar, tentar RPC customizado
// Se falhar, usar abordagem de descoberta inteligente

const tableListing = [
  // 1. Tentar RPC get_public_tables (se existir)
  // 2. Tentar query em pg_catalog via RPC
  // 3. Descoberta automática expandida
];
```

### 2.2 RPC Helper Function (Opcional)

Sugerir ao usuário criar esta função no banco externo:

```sql
CREATE OR REPLACE FUNCTION get_public_tables()
RETURNS TABLE(table_name text, column_count integer, row_count bigint)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.table_name::text,
    (SELECT count(*)::integer FROM information_schema.columns c 
     WHERE c.table_name = t.table_name AND c.table_schema = 'public'),
    (SELECT reltuples::bigint FROM pg_class 
     WHERE relname = t.table_name)
  FROM information_schema.tables t
  WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE';
END;
$$;
```

### 2.3 Descoberta Automática Melhorada

Se RPC não existir, usar descoberta inteligente:

1. **Testar tabelas conhecidas** (lista expandida para 150+)
2. **Descoberta por padrões comuns** (plural, singular, prefixos)
3. **Feedback ao usuário** sobre limitações

### 2.4 UI de Seleção de Tabelas Melhorada

Atualizar `TableSelection.tsx`:

- Indicador de carregamento durante descoberta
- Mensagem explicativa se poucas tabelas encontradas
- Botão "Adicionar tabela manualmente" para casos edge
- Filtros por tipo de dado detectado

---

## Arquivos a Modificar/Criar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `migration_XXXXXX.sql` | Criar | Tabela `dashboard_templates` + seed data |
| `src/hooks/useTemplates.ts` | Criar | Hook CRUD para templates |
| `src/pages/admin/Templates.tsx` | Modificar | Usar dados reais do banco |
| `supabase/functions/test-supabase-connection/index.ts` | Modificar | Listar TODAS tabelas |
| `src/components/onboarding/TableSelection.tsx` | Modificar | UI melhorada |
| `src/components/admin/TemplateEditor.tsx` | Criar | Modal de criação/edição |

---

## Políticas RLS para Templates

```sql
-- Platform admins podem fazer CRUD
CREATE POLICY "Platform admins can manage templates"
ON dashboard_templates FOR ALL
USING (is_platform_admin(auth.uid()));

-- Todos autenticados podem visualizar templates ativos
CREATE POLICY "Authenticated users can view active templates"
ON dashboard_templates FOR SELECT
USING (is_active = true AND auth.uid() IS NOT NULL);
```

---

## Seção Técnica

### Estrutura de Widgets no Template

```typescript
interface TemplateWidget {
  type: WidgetType;
  title: string;
  description?: string;
  size: 'small' | 'medium' | 'large' | 'full';
  position: number;
  config: {
    metric?: string;
    aggregation?: string;
    chartType?: string;
    showTrend?: boolean;
    [key: string]: unknown;
  };
}
```

### Fluxo de Aplicação de Template

```text
1. Usuário seleciona template no wizard
2. Sistema copia widgets do template
3. Widgets são mapeados para as tabelas selecionadas
4. Dashboard é criado com os widgets configurados
5. Contador de uso do template incrementa
```

### Descoberta de Tabelas via PostgREST

```typescript
// Abordagem 1: RPC customizado (melhor)
const { data } = await client.rpc('get_public_tables');

// Abordagem 2: Testar tabelas conhecidas (fallback)
const commonTables = [...150 nomes...];
const results = await Promise.allSettled(
  commonTables.map(t => client.from(t).select('*', { head: true }))
);
```

---

## Ordem de Implementação

1. **Criar tabela `dashboard_templates`** com seed data
2. **Criar hook `useTemplates`** com operações CRUD
3. **Atualizar `Templates.tsx`** para buscar dados reais
4. **Criar modal de edição** de templates
5. **Atualizar Edge Function** para descoberta completa de tabelas
6. **Melhorar UI de seleção** de tabelas

---

## Resultado Esperado

- Templates reais persistidos no banco de dados
- CRUD completo para gerenciamento de templates
- Descoberta de TODAS as tabelas acessíveis no banco externo
- Interface intuitiva para seleção de dados
- Templates pré-configurados prontos para uso imediato
