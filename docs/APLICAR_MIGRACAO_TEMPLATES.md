# Como Aplicar a Migração de Templates no Supabase Cloud

Esta migração atualiza os templates de dashboard para funcionarem automaticamente com o mapeamento inteligente.

## Opção 1: Via Supabase Dashboard (Mais Simples) ⭐ RECOMENDADO

1. **Acesse o Supabase Dashboard**
   - Vá para: https://supabase.com/dashboard
   - Faça login na sua conta
   - Selecione o projeto do Pinn Insights Hub

2. **Abra o SQL Editor**
   - No menu lateral, clique em **"SQL Editor"**
   - Clique em **"New query"**

3. **Cole o SQL da migração**
   - Abra o arquivo: `supabase/migrations/20250205000000_improve_dashboard_templates.sql`
   - Copie TODO o conteúdo
   - Cole no SQL Editor

4. **Execute a migração**
   - Clique no botão **"Run"** (ou pressione `Ctrl+Enter`)
   - Aguarde a execução
   - Você deve ver: "Success. No rows returned"

5. **Verifique se funcionou**
   - Vá em **"Table Editor"** → **"dashboard_templates"**
   - Verifique se os templates foram atualizados
   - Os widgets devem ter a estrutura melhorada

---

## Opção 2: Via Supabase CLI (Se tiver configurado)

Se você já tem o Supabase CLI configurado localmente:

```bash
# 1. Navegue até a pasta do projeto
cd pinn-insights-hub

# 2. Link com o projeto (se ainda não fez)
supabase link --project-ref SEU_PROJECT_REF

# 3. Aplique as migrações
supabase db push
```

**Nota:** Você precisa ter:
- Supabase CLI instalado: `npm install -g supabase`
- Autenticado: `supabase login`
- Project REF do seu projeto Supabase

---

## Opção 3: Via GitHub Actions (Automático)

Se você tem GitHub Actions configurado (como no projeto `microsaashub-pardis-sellerflow`):

1. **Configure os Secrets no GitHub** (se ainda não fez):
   - Vá em: Repositório → Settings → Secrets and variables → Actions
   - Adicione:
     - `SUPABASE_ACCESS_TOKEN`: Token de acesso do Supabase
     - `SUPABASE_PROJECT_REF`: ID do seu projeto Supabase

2. **Crie o workflow** (se não existe):
   - Crie: `.github/workflows/supabase-deploy.yml`
   - Use o exemplo do `microsaashub-pardis-sellerflow` como referência

3. **Push para main**:
   - As migrações serão aplicadas automaticamente no push

---

## Verificação Pós-Migração

Após aplicar a migração, verifique:

1. **Templates atualizados:**
   ```sql
   SELECT name, jsonb_array_length(widgets) as widget_count 
   FROM dashboard_templates;
   ```

2. **Estrutura dos widgets:**
   ```sql
   SELECT name, widgets->0->>'title' as first_widget_title
   FROM dashboard_templates
   WHERE name = 'Dashboard Starter';
   ```

3. **Formatos configurados:**
   ```sql
   SELECT 
     name,
     jsonb_array_elements(widgets)->>'title' as widget_title,
     jsonb_array_elements(widgets)->'config'->>'format' as format
   FROM dashboard_templates
   WHERE name = 'Dashboard Professional';
   ```

---

## Conteúdo da Migração

A migração atualiza 4 templates:
- ✅ **Dashboard Starter** (Plan 1)
- ✅ **Dashboard Professional** (Plan 2)
- ✅ **Dashboard Business** (Plan 3)
- ✅ **Dashboard Enterprise** (Plan 4)

**Melhorias aplicadas:**
- Estrutura de widgets mais clara
- Formatos corretos (currency, percentage, number)
- Métricas padronizadas para mapeamento automático
- Configurações mais completas

---

## Problemas Comuns

### Erro: "relation dashboard_templates does not exist"
- **Solução:** A tabela ainda não foi criada. Execute primeiro a migração que cria a tabela: `20260204200507_bbb3bcfa-2fd8-433e-aec8-aead34593a26.sql`

### Erro: "syntax error at or near..."
- **Solução:** Verifique se copiou o SQL completo. O arquivo deve ter 67 linhas.

### Templates não atualizaram
- **Solução:** Verifique se os nomes dos templates estão exatamente como no banco:
  - `Dashboard Starter`
  - `Dashboard Professional`
  - `Dashboard Business`
  - `Dashboard Enterprise`

---

## Próximos Passos

Após aplicar a migração:
1. ✅ Templates estarão atualizados
2. ✅ Mapeamento automático funcionará melhor
3. ✅ Dashboards serão criados automaticamente ao conectar fonte de dados

**Teste:** Crie um novo dashboard e veja se os templates funcionam automaticamente!
