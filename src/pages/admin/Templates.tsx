import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LayoutTemplate,
  Plus,
  Edit2,
  Copy,
  Trash2,
  BarChart,
  PieChart,
  TrendingUp,
  Table,
  Lightbulb,
} from 'lucide-react';
import { planNames } from '@/lib/mock-data';

interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  plan: 1 | 2 | 3 | 4;
  widgets: {
    type: string;
    name: string;
  }[];
  createdAt: string;
  usageCount: number;
}

const mockTemplates: DashboardTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Dashboard Starter',
    description: 'Template básico com métricas essenciais e funil de vendas',
    plan: 1,
    widgets: [
      { type: 'metric', name: 'Total de Leads' },
      { type: 'metric', name: 'Conversões' },
      { type: 'funnel', name: 'Funil de Vendas' },
    ],
    createdAt: '2024-01-01',
    usageCount: 15,
  },
  {
    id: 'tpl-2',
    name: 'Dashboard Professional',
    description: 'Template com métricas avançadas, gráficos de linha e insights básicos',
    plan: 2,
    widgets: [
      { type: 'metric', name: 'Total de Leads' },
      { type: 'metric', name: 'Conversões' },
      { type: 'metric', name: 'Taxa de Conversão' },
      { type: 'chart', name: 'Evolução Mensal' },
      { type: 'funnel', name: 'Funil de Vendas' },
      { type: 'insight', name: 'Insights IA' },
    ],
    createdAt: '2024-01-01',
    usageCount: 23,
  },
  {
    id: 'tpl-3',
    name: 'Dashboard Business',
    description: 'Template completo com múltiplos gráficos, tabelas e insights avançados',
    plan: 3,
    widgets: [
      { type: 'metric', name: 'Total de Leads' },
      { type: 'metric', name: 'Conversões' },
      { type: 'metric', name: 'Taxa de Conversão' },
      { type: 'metric', name: 'Receita' },
      { type: 'chart', name: 'Evolução Mensal' },
      { type: 'chart', name: 'Leads por Origem' },
      { type: 'funnel', name: 'Funil de Vendas' },
      { type: 'table', name: 'Últimos Leads' },
      { type: 'insight', name: 'Insights IA' },
    ],
    createdAt: '2024-01-01',
    usageCount: 8,
  },
  {
    id: 'tpl-4',
    name: 'Dashboard Enterprise',
    description: 'Template premium com todos os widgets, relatórios customizados e IA avançada',
    plan: 4,
    widgets: [
      { type: 'metric', name: 'Total de Leads' },
      { type: 'metric', name: 'Conversões' },
      { type: 'metric', name: 'Taxa de Conversão' },
      { type: 'metric', name: 'Receita' },
      { type: 'metric', name: 'Ticket Médio' },
      { type: 'metric', name: 'CAC' },
      { type: 'chart', name: 'Evolução Mensal' },
      { type: 'chart', name: 'Leads por Origem' },
      { type: 'chart', name: 'Comparativo de Períodos' },
      { type: 'funnel', name: 'Funil de Vendas' },
      { type: 'funnel', name: 'Funil de Marketing' },
      { type: 'table', name: 'Últimos Leads' },
      { type: 'table', name: 'Performance por Vendedor' },
      { type: 'insight', name: 'Insights IA Avançados' },
    ],
    createdAt: '2024-01-01',
    usageCount: 3,
  },
];

const widgetIcons: Record<string, React.ReactNode> = {
  metric: <TrendingUp className="w-3 h-3" />,
  chart: <BarChart className="w-3 h-3" />,
  funnel: <PieChart className="w-3 h-3" />,
  table: <Table className="w-3 h-3" />,
  insight: <Lightbulb className="w-3 h-3" />,
};

const Templates = () => {
  const [templates] = useState<DashboardTemplate[]>(mockTemplates);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Templates de Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os templates disponíveis para cada plano
          </p>
        </div>
        <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Plus className="w-4 h-4 mr-2" />
          Novo Template
        </Button>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {templates.map((template) => (
          <Card key={template.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <LayoutTemplate className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{planNames[template.plan]}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {template.usageCount} org. usando
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">{template.description}</CardDescription>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {template.widgets.length} widgets incluídos:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {template.widgets.map((widget, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="text-xs font-normal flex items-center gap-1"
                    >
                      {widgetIcons[widget.type]}
                      {widget.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Templates;
