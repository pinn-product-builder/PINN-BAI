
# Plano: Widget de Tabela de Leads Recentes

## Resumo

Criar um novo componente `TableWidget.tsx` para exibir leads recentes no dashboard, seguindo o padrão visual de alta qualidade dos demais widgets, com recursos como paginação, ordenação visual, badges de status e ações rápidas.

---

## Visual do Widget

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Leads Recentes                                                    (i)      │
│  Últimos leads capturados no período selecionado                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Nome              Email                  Origem      Status      Data      │
│  ─────────────────────────────────────────────────────────────────────────  │
│  ○ João Silva      joao@email.com        Google Ads  ●Qualificado  Há 2h   │
│  ○ Maria Santos    maria@empresa.com     LinkedIn    ●Novo         Há 5h   │
│  ○ Pedro Costa     pedro@startup.io      Referral    ●Em Análise   Há 1d   │
│  ○ Ana Rodrigues   ana@corp.com.br       Organic     ●Qualificado  Há 1d   │
│  ○ Carlos Lima     carlos@tech.com       Email       ●Convertido   Há 2d   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Mostrando 1-5 de 47 leads                              [<] 1 2 3 ... [>]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## O Que Será Criado

### 1. Novo Componente: `TableWidget.tsx`

Características do widget:
- **Header com tooltip**: Título + ícone de info com descrição detalhada
- **Tabela responsiva**: Usa os componentes `Table` já existentes
- **Avatares**: Iniciais do nome com cores únicas
- **Badges de status**: Coloridos por status (Novo, Qualificado, Em Análise, Convertido)
- **Origem do lead**: Com ícones representativos
- **Data relativa**: "Há 2h", "Há 1d" usando date-fns
- **Paginação**: Componente de paginação funcional
- **Limite de linhas**: 5 leads por página (configurável)

### 2. Mock Data de Leads

Adicionar ao `mock-data.ts`:
```typescript
interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  source: 'google_ads' | 'linkedin' | 'referral' | 'organic' | 'email';
  status: 'new' | 'qualified' | 'in_analysis' | 'proposal' | 'converted' | 'lost';
  value?: number;
  createdAt: string;
  orgId: string;
}
```

### 3. Integração no Dashboard

Adicionar o widget na página `Dashboard.tsx` abaixo dos Insights IA.

---

## Detalhes Técnicos

### Arquivos Criados/Modificados

| Arquivo | Ação |
|---------|------|
| `src/components/dashboard/widgets/TableWidget.tsx` | Criar |
| `src/lib/mock-data.ts` | Adicionar interface Lead e mockLeads |
| `src/pages/client/Dashboard.tsx` | Importar e usar TableWidget |

### Props do Componente

```typescript
interface TableWidgetProps {
  title: string;
  description: string;
  pageSize?: number;
  showPagination?: boolean;
}
```

### Status e Cores

| Status | Cor | Label PT-BR |
|--------|-----|-------------|
| new | Azul | Novo |
| qualified | Verde | Qualificado |
| in_analysis | Amarelo | Em Análise |
| proposal | Roxo | Proposta |
| converted | Esmeralda | Convertido |
| lost | Vermelho | Perdido |

### Origens e Ícones

| Origem | Ícone Lucide |
|--------|--------------|
| google_ads | Chrome |
| linkedin | Linkedin |
| referral | Users |
| organic | Globe |
| email | Mail |

---

## Responsividade

- **Desktop**: Todas as colunas visíveis
- **Tablet**: Ocultar coluna Telefone
- **Mobile**: Mostrar apenas Nome, Status e Data (layout compacto)

---

## Benefícios

1. **Visão Rápida**: Admin vê leads recentes sem sair do dashboard
2. **Contexto Visual**: Badges e avatares facilitam identificação
3. **Paginação**: Navegar por todos os leads sem scroll infinito
4. **Consistência**: Segue o design system dos demais widgets
5. **Acessibilidade**: Textos descritivos e contraste adequado
