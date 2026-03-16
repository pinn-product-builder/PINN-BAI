# Diagnóstico de Problemas no Dashboard

## Como verificar se os dados estão sendo buscados corretamente

### 1. Abra o Console do Navegador (F12)

### 2. Procure por estes logs:

#### Logs de Busca de Dados:
- `[useExternalData] Response for table:` - Mostra se os dados foram retornados
- `[WidgetRenderer]` - Mostra qual tabela cada widget está usando
- `[DashboardEngine] Calculating metric:` - Mostra qual campo está sendo usado

#### Logs de Criação de Widgets:
- `[useTemplates] Creating widget:` - Mostra como os widgets foram criados
- `[useTemplates] Using Afonsina widget config` - Indica que está usando a configuração do Afonsina

### 3. Verifique a aba Network:

1. Filtre por `fetch-client-data`
2. Veja se as requisições estão retornando dados
3. Verifique o Response de cada requisição

### 4. Problemas Comuns:

#### Widgets mostrando valores incorretos (ex: 39 para Taxa de Conversão):
- **Causa**: Campo `metric` está incorreto ou não existe na tabela
- **Solução**: Verificar no console qual campo está sendo usado
- **Verificar**: `[DashboardEngine] Calculating metric:` mostra o campo usado

#### Gráficos vazios:
- **Causa**: Dados não estão sendo retornados ou campo `groupBy` está incorreto
- **Solução**: Verificar se a tabela tem dados e se o campo de agrupamento existe
- **Verificar**: `[processChartData]` mostra se há dados para processar

#### Tabela com dados placeholder:
- **Causa**: Tabela não tem dados ou campos não existem
- **Solução**: Verificar se a view/tabela existe e tem dados
- **Verificar**: `[useExternalData] Response` mostra quantos registros foram retornados

## Checklist de Verificação:

- [ ] Widgets foram criados com `dataSource` correto?
- [ ] Edge function `fetch-client-data` está retornando dados?
- [ ] Campos `metric` existem nas tabelas/views?
- [ ] Views existem no banco de dados do cliente?
- [ ] Integração Supabase está configurada corretamente?

## Como corrigir:

1. **Se os widgets não têm `dataSource`**:
   - O template não foi aplicado corretamente
   - Reaplicar o template "Visão Executiva - Afonsina"

2. **Se os dados não estão sendo retornados**:
   - Verificar se a integração Supabase está conectada
   - Verificar se as views existem no banco do cliente
   - Verificar logs da edge function no Supabase Dashboard

3. **Se os campos estão incorretos**:
   - O sistema deve usar automaticamente a configuração do Afonsina
   - Verificar logs `[useTemplates] Using Afonsina widget config`
   - Se não aparecer, o template não está sendo usado
