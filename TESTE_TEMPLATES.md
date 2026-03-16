# Checklist de Teste - Templates de Dashboard

## ✅ Pré-requisitos
- [x] Migração aplicada no Supabase Cloud
- [ ] Fonte de dados conectada (Supabase, Google Sheets, CSV, etc.)
- [ ] Mapeamento de colunas feito pela IA

---

## 🧪 Teste 1: Criar Dashboard com Template

### Passos:
1. **Acesse o Onboarding**
   - Vá para a página de onboarding/criação de dashboard
   - Ou crie uma nova organização

2. **Conecte Fonte de Dados**
   - Selecione sua fonte (Supabase, Google Sheets, etc.)
   - Conecte e aguarde a análise das tabelas

3. **Mapeamento Automático**
   - A IA deve mapear automaticamente as colunas
   - Revise os mapeamentos sugeridos
   - Aceite ou ajuste conforme necessário

4. **Selecione um Template**
   - Escolha um template (Starter, Professional, Business, Enterprise)
   - Verifique se os widgets aparecem no preview

5. **Finalize**
   - Complete o onboarding
   - O dashboard deve ser criado automaticamente

### ✅ Resultado Esperado:
- Dashboard criado com widgets do template
- Métricas aparecendo com valores reais (não zeros)
- Formatos corretos (R$ para receita, % para taxas)
- Gráficos renderizando dados

---

## 🧪 Teste 2: Verificar Mapeamento Automático

### O que verificar:
1. **Métricas mapeadas corretamente:**
   - "Total de Leads" → deve usar campo de leads
   - "Receita Total" → deve usar campo monetário
   - "Taxa de Conversão" → deve usar campo de taxa/percentual

2. **Formatos corretos:**
   - Receita deve aparecer como R$ X.XXX
   - Taxas devem aparecer como X.X%
   - Contagens devem aparecer como números inteiros

3. **Dados reais:**
   - Valores devem vir da sua fonte de dados
   - Não devem ser zeros ou valores muito baixos
   - Gráficos devem mostrar dados reais

---

## 🧪 Teste 3: Testar Cada Template

### Dashboard Starter (Plan 1)
- [ ] 6 widgets criados
- [ ] Total de Leads funcionando
- [ ] Novos Leads funcionando
- [ ] Conversões funcionando
- [ ] Taxa de Conversão funcionando
- [ ] Gráfico de Evolução de Leads funcionando
- [ ] Funil de Vendas funcionando

### Dashboard Professional (Plan 2)
- [ ] 9 widgets criados
- [ ] Todas as métricas do Starter
- [ ] Receita Total funcionando
- [ ] Gráfico de Leads por Origem funcionando
- [ ] Insights IA funcionando

### Dashboard Business (Plan 3)
- [ ] 12 widgets criados
- [ ] Todas as métricas anteriores
- [ ] MRR funcionando
- [ ] Gráfico de Evolução de Receita funcionando
- [ ] Tabela de Últimos Leads funcionando

### Dashboard Enterprise (Plan 4)
- [ ] 13 widgets criados
- [ ] Todos os widgets anteriores
- [ ] Gráfico de Distribuição de Conversões funcionando
- [ ] Insights IA Avançados funcionando

---

## 🐛 Problemas Comuns e Soluções

### Problema: Valores aparecem como zero ou muito baixos
**Causa:** Campo não mapeado corretamente ou agregação errada
**Solução:**
1. Verifique o mapeamento no passo de mapeamento
2. Confirme que o campo correto está sendo usado
3. Verifique se a agregação está correta (sum, count, avg)

### Problema: Formato incorreto (ex: receita sem R$)
**Causa:** Formato não detectado automaticamente
**Solução:**
1. Verifique se o template tem `"format": "currency"` no config
2. Verifique se o campo está mapeado como currency na transformação

### Problema: Widgets não aparecem
**Causa:** Template não aplicado ou erro na criação
**Solução:**
1. Verifique os logs do console do navegador
2. Verifique se o template foi selecionado
3. Verifique se há erros no banco de dados

### Problema: Gráficos vazios
**Causa:** Dados não estão sendo buscados ou campo errado
**Solução:**
1. Verifique se a fonte de dados está conectada
2. Verifique se o campo `dataSource` está configurado no widget
3. Verifique se o campo `metric` está correto

---

## 📊 Verificação no Console

Abra o Console do Navegador (F12) e verifique:

1. **Logs de mapeamento:**
   ```
   [useTemplates] Creating widget: ...
   [useTemplates] Found mapping by title match: ...
   ```

2. **Logs de cálculo:**
   ```
   [DashboardEngine] Calculating metric: ...
   [DashboardEngine] Calculated metric value: ...
   ```

3. **Erros:**
   - Se houver erros, copie e me envie

---

## ✅ Critérios de Sucesso

O teste foi bem-sucedido se:
- ✅ Dashboard é criado automaticamente
- ✅ Widgets aparecem com dados reais
- ✅ Formatos estão corretos (R$, %, números)
- ✅ Gráficos renderizam dados
- ✅ Não há erros no console
- ✅ Valores fazem sentido (não são todos zeros)

---

## 🚀 Próximos Passos Após Teste

Se tudo funcionar:
1. ✅ Templates estão prontos para uso
2. ✅ Mapeamento automático funcionando
3. ✅ Dashboards sendo criados corretamente

Se houver problemas:
1. Me envie os logs do console
2. Me diga qual template testou
3. Me diga quais widgets não funcionaram
