import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface NarrativeInsight {
  text: string;
  highlight?: string;
  trend: 'up' | 'down' | 'stable';
}

/**
 * Hook to generate AI narrative summary based on dashboard widgets data
 */
export const useDashboardNarrative = (dashboardId: string | undefined, orgId: string | undefined) => {
  const { data: widgetsAndData, isLoading } = useQuery({
    queryKey: ['dashboard-narrative', dashboardId, orgId],
    queryFn: async () => {
      if (!dashboardId || !orgId) return null;

      // Fetch widgets
      const { data: widgets, error } = await supabase
        .from('dashboard_widgets')
        .select('*')
        .eq('dashboard_id', dashboardId)
        .eq('is_visible', true)
        .order('position', { ascending: true });

      if (error) throw error;
      if (!widgets || widgets.length === 0) return { widgets: [], metricData: [] };

      // Get metric widgets and fetch their data
      const metricWidgets = widgets.filter(w => w.type === 'metric_card').slice(0, 3);
      const metricData: Array<{ widget: typeof widgets[0]; data: any }> = [];

      for (const widget of metricWidgets) {
        const config = (widget.config || {}) as any;
        const tableName = config.dataSource || config.sourceTable;
        if (!tableName) continue;

        try {
          const { data } = await supabase.functions.invoke('fetch-client-data', {
            body: { orgId, tableName, limit: 100 },
          });
          metricData.push({ widget, data });
        } catch {
          // skip failed fetches
        }
      }

      return { widgets, metricData };
    },
    enabled: !!dashboardId && !!orgId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const generateNarrative = (): NarrativeInsight | null => {
    if (!widgetsAndData?.widgets || widgetsAndData.widgets.length === 0) {
      return {
        text: "Bem-vindo ao seu dashboard! Configure widgets para começar a ver insights automáticos.",
        trend: 'stable',
      };
    }

    const insights: string[] = [];
    let trend: 'up' | 'down' | 'stable' = 'stable';

    for (const { widget, data } of widgetsAndData.metricData) {
      if (!data?.success || !data.data || data.data.length === 0) continue;

      const config = (widget.config || {}) as any;
      const metricField = config.metric || 'value';
      const values = data.data
        .map((row: any) => {
          const val = row[metricField];
          return typeof val === 'number' ? val : parseFloat(String(val)) || 0;
        })
        .filter((v: number) => !isNaN(v));

      if (values.length > 0) {
        const total = values.reduce((a: number, b: number) => a + b, 0);
        const avg = total / values.length;

        if (widget.title.toLowerCase().includes('lead')) {
          insights.push(`${total} leads no período`);
          if (total > 50) trend = 'up';
        } else if (widget.title.toLowerCase().includes('receita') || widget.title.toLowerCase().includes('revenue')) {
          insights.push(`Receita total de R$ ${total.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`);
          if (total > 10000) trend = 'up';
        } else if (widget.title.toLowerCase().includes('conversão') || widget.title.toLowerCase().includes('conversion')) {
          insights.push(`Taxa de conversão de ${avg.toFixed(1)}%`);
          if (avg > 10) trend = 'up';
        }
      }
    }

    if (insights.length === 0) {
      return {
        text: "Seus dados estão sendo processados. Os insights aparecerão aqui em breve.",
        trend: 'stable',
      };
    }

    const highlight = insights[0] || '';
    const text = `Olá! ${insights.join('. ')}. ${insights.length > 1 ? 'Continue monitorando suas métricas para identificar oportunidades de crescimento.' : 'Mantenha o foco nas estratégias que estão gerando resultados.'}`;

    return { text, highlight, trend };
  };

  return {
    narrative: generateNarrative(),
    isLoading,
  };
};
