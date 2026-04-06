# Como Ver Logs do Sistema

## 📍 Onde Encontrar os Logs

### 1. **Console do Navegador (Frontend)**
- **Abrir**: Pressione `F12` ou `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
- **Aba Console**: Mostra todos os logs do JavaScript
  - `console.log()` - Informações gerais
  - `console.error()` - Erros (aparecem em vermelho)
  - `console.warn()` - Avisos (aparecem em amarelo)
- **Aba Network**: Mostra todas as requisições HTTP
  - Clique em uma requisição para ver:
    - **Headers**: Cabeçalhos enviados/recebidos
    - **Payload**: Dados enviados
    - **Response**: Resposta do servidor
    - **Preview**: Visualização formatada da resposta

### 2. **Logs do Supabase Dashboard (Edge Functions)**
1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. No menu lateral, vá em **Edge Functions**
4. Clique na função que você quer ver (ex: `create-org-admin`, `suggest-mappings`, `fetch-client-data`)
5. Clique na aba **Logs**
6. Você verá:
   - Logs em tempo real
   - Erros e stack traces
   - Timestamps de cada execução
   - Dados de entrada e saída

### 3. **Logs Locais (Se rodando Supabase localmente)**
Se você está rodando o Supabase localmente:
```bash
# Terminal onde você rodou: supabase start
# Os logs aparecem diretamente no terminal

# Ou para ver logs de uma função específica:
supabase functions serve create-org-admin --no-verify-jwt
```

### 4. **Logs do Dashboard Engine (Widgets)**
Os logs do cálculo de métricas aparecem no console do navegador com prefixo `[DashboardEngine]`:
- `[DashboardEngine] Calculating metric:` - Quando está calculando
- `[DashboardEngine] Found field:` - Quando encontra um campo
- `[DashboardEngine] No metric field specified` - Quando não há campo configurado
- `[DashboardEngine] Metric field not found` - Quando o campo não existe nos dados

## 🔍 Como Debugar o Erro 400

O erro 400 que você está vendo no `create-org-admin` pode ser causado por:

1. **Campos faltando**: Verifique se `email`, `password`, `fullName`, `orgId` estão sendo enviados
2. **Senha muito curta**: Deve ter pelo menos 6 caracteres
3. **Email já existe**: O email pode já estar associado a outra organização
4. **RPC não existe**: A função `is_platform_admin` pode não existir

### Para ver o erro completo:

1. **No Console do Navegador (F12)**:
   - Aba **Network**
   - Encontre a requisição para `create-org-admin`
   - Clique nela
   - Veja a aba **Response** para ver a mensagem de erro completa

2. **No Supabase Dashboard**:
   - Vá em Edge Functions → `create-org-admin` → Logs
   - Veja os logs mais recentes para encontrar o erro

## 📝 Logs Importantes para Debug

### Frontend (Console do Navegador):
- `[NewOrganization]` - Logs da criação de organização
- `[DashboardEngine]` - Logs do cálculo de métricas
- `[useExternalData]` - Logs de busca de dados
- `[suggest-mappings]` - Logs de mapeamento da IA

### Backend (Supabase Logs):
- `create-org-admin` - Criação de usuário admin
- `suggest-mappings` - Sugestões de mapeamento da IA
- `fetch-client-data` - Busca de dados das tabelas
- `recommend-widgets` - Recomendações de widgets

## 🛠️ Dicas de Debug

1. **Sempre abra o Console primeiro** quando algo não funcionar
2. **Filtre por "error"** no console para ver apenas erros
3. **Use `console.log()` temporariamente** no código para ver valores
4. **Verifique a aba Network** para ver se as requisições estão sendo feitas
5. **Veja o Response** nas requisições com erro para entender o problema

## 🔧 Comandos Úteis

```bash
# Ver logs do Supabase local
supabase functions logs create-org-admin

# Rodar função localmente para debug
supabase functions serve create-org-admin --no-verify-jwt --env-file .env.local

# Ver status do Supabase
supabase status
```
