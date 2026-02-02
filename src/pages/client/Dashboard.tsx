import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Calendar, Edit3, Save, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { mockOrganizations } from '@/lib/mock-data';

// High-quality dashboard widgets
import MetricCard from '@/components/dashboard/widgets/MetricCard';
import AreaChartWidget from '@/components/dashboard/widgets/AreaChartWidget';
import LineChartWidget from '@/components/dashboard/widgets/LineChartWidget';
import BarChartWidget from '@/components/dashboard/widgets/BarChartWidget';
import PieChartWidget from '@/components/dashboard/widgets/PieChartWidget';
import FunnelWidget from '@/components/dashboard/widgets/FunnelWidget';
import InsightCard from '@/components/dashboard/widgets/InsightCard';
import TableWidget from '@/components/dashboard/widgets/TableWidget';

const Dashboard = () => {
  const { orgId } = useParams();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [dateRange, setDateRange] = useState('30d');

  const currentOrg = mockOrganizations.find((org) => org.id === orgId);

  const handleSaveLayout = () => {
    toast({
      title: 'Layout salvo',
      description: 'As alterações no dashboard foram salvas com sucesso.',
    });
    setIsEditing(false);
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">{currentOrg?.name || 'Minha Organização'}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="1y">Último ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isEditing ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button
                onClick={handleSaveLayout}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                <Save className="w-4 h-4 mr-2" />
                Salvar Layout
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Edit3 className="w-4 h-4 mr-2" />
              Editar Dashboard
            </Button>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg flex items-center gap-2">
          <Edit3 className="w-4 h-4 text-accent" />
          <span className="text-sm text-accent">
            Modo de edição ativo. O drag & drop será habilitado quando o backend estiver integrado.
          </span>
        </div>
      )}

      {/* Metric Cards - 4 columns on desktop */}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${isEditing ? '[&>*]:ring-2 [&>*]:ring-dashed [&>*]:ring-accent/30' : ''}`}>
        <MetricCard
          title="Total de Leads"
          description="Número total de leads capturados no período selecionado. Inclui todos os canais de aquisição configurados (Google Ads, LinkedIn, Referral, Orgânico)."
          value={2450}
          previousValue={2100}
          format="number"
        />
        <MetricCard
          title="Conversões"
          description="Leads que se tornaram clientes pagantes no período. Calculado pela mudança de status para 'Cliente' após fechamento do deal."
          value={156}
          previousValue={128}
          format="number"
        />
        <MetricCard
          title="Taxa de Conversão"
          description="Percentual de leads convertidos em clientes. Fórmula: (Total de Clientes / Total de Leads) × 100. Meta ideal: acima de 10%."
          value={12.5}
          previousValue={12.0}
          format="percentage"
        />
        <MetricCard
          title="Receita MRR"
          description="Receita Recorrente Mensal (Monthly Recurring Revenue). Soma de todas as assinaturas ativas normalizadas para base mensal."
          value={458000}
          previousValue={371000}
          format="currency"
        />
      </div>

      {/* Main Charts Row - Area + Line */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${isEditing ? '[&>*]:ring-2 [&>*]:ring-dashed [&>*]:ring-accent/30' : ''}`}>
        <AreaChartWidget
          title="Evolução de Leads"
          description="Visualização da evolução de leads e conversões ao longo do tempo. O gráfico de área mostra a tendência de crescimento e permite identificar sazonalidades."
        />
        <LineChartWidget
          title="Performance Mensal"
          description="Comparativo entre leads gerados e receita obtida por mês. Permite identificar correlações entre volume de leads e resultado financeiro."
        />
      </div>

      {/* Secondary Charts Row - Bar + Pie + Funnel */}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${isEditing ? '[&>*]:ring-2 [&>*]:ring-dashed [&>*]:ring-accent/30' : ''}`}>
        <BarChartWidget
          title="Leads por Canal"
          description="Distribuição de leads por canal de aquisição. Permite identificar quais canais estão performando melhor e otimizar investimentos em marketing."
        />
        <PieChartWidget
          title="Status dos Leads"
          description="Distribuição dos leads por status no funil. Qualificados são leads prontos para abordagem comercial. Em Análise estão sendo verificados pela equipe."
          isDonut={true}
        />
        <FunnelWidget
          title="Funil de Vendas"
          description="Visualização completa do funil de vendas com taxas de conversão entre cada etapa. Permite identificar gargalos e oportunidades de melhoria no processo comercial."
        />
      </div>

      {/* Insights Section - Full width */}
      <div className={isEditing ? 'ring-2 ring-dashed ring-accent/30 rounded-lg' : ''}>
        <InsightCard
          title="Insights IA"
          description="Insights gerados automaticamente por inteligência artificial com base nos dados do seu dashboard. Recomendações são ações sugeridas, alertas indicam problemas detectados, e tendências mostram padrões identificados."
        />
      </div>

      {/* Recent Leads Table - Full width */}
      <div className={isEditing ? 'ring-2 ring-dashed ring-accent/30 rounded-lg' : ''}>
        <TableWidget
          title="Leads Recentes"
          description="Últimos leads capturados no período selecionado. Clique em um lead para ver detalhes completos e histórico de interações."
          pageSize={5}
          showPagination={true}
        />
      </div>
    </div>
  );
};

export default Dashboard;
