import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface NarrativeInsight {
  text: string;
  highlight?: string;
  trend: 'up' | 'down' | 'stable';
}

/**
 * Hook to generate narrative summary based on dashboard widgets data
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
      if (!widgets || widgets.length === 0) return { widgets: [], externalData: null };

      // Find the main data source from widgets
      const dataSources = new Set<string>();
      widgets.forEach(w => {
        const config = (w.config || {}) as any;
        const table = config.dataSource || config.sourceTable;
        if (table) dataSources.add(table);
      });

      // Fetch data from first source
      const primaryTable = Array.from(dataSources)[0];
      let externalData: any[] = [];
      
      if (primaryTable) {
        try {
          const { data } = await supabase.functions.invoke('fetch-client-data', {
            body: { orgId, tableName: primaryTable, limit: 100 },
          });
          if (data?.success && data.data) {
            externalData = data.data;
          }
        } catch {
          // skip
        }
      }

      return { widgets, externalData, primaryTable };
    },
    enabled: !!dashboardId && !!orgId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const generateNarrative = (): NarrativeInsight | null => {
    if (!widgetsAndData?.widgets || widgetsAndData.widgets.length === 0) {
      return {
        text: "Bem-vindo ao seu dashboard! Configure widgets para começar a ver insights automáticos.",
        trend: 'stable',
      };
    }

    const data = widgetsAndData.externalData || [];
    const totalRecords = data.length;
    
    if (totalRecords === 0) {
      return {
        text: "Seus dados estão sendo processados. Os insights aparecerão aqui em breve.",
        trend: 'stable',
      };
    }

    const insights: string[] = [];
    let trend: 'up' | 'down' | 'stable' = 'stable';

    // Analyze the data dynamically based on available fields
    const fields = totalRecords > 0 ? Object.keys(data[0]) : [];
    
    // Count records
    insights.push(`${totalRecords} registros encontrados`);

    // Check for reunion/meeting fields
    const reuniaoField = fields.find(f => f.toLowerCase().includes('reuniao') && !f.includes('_at'));
    if (reuniaoField) {
      const withMeeting = data.filter((r: any) => r[reuniaoField] === true).length;
      if (withMeeting > 0) {
        const rate = ((withMeeting / totalRecords) * 100).toFixed(0);
        insights.push(`${withMeeting} com reunião (${rate}%)`);
        if (parseInt(rate) > 20) trend = 'up';
      }
    }

    // Check for destination/interest fields
    const destinoField = fields.find(f => f.toLowerCase().includes('destino') || f.toLowerCase().includes('interesse'));
    if (destinoField) {
      const withDestino = data.filter((r: any) => r[destinoField] && String(r[destinoField]).trim() !== '').length;
      if (withDestino > 0) {
        insights.push(`${withDestino} com destino definido`);
      }
    }

    // Check for date fields to determine recency
    const dateField = fields.find(f => f.toLowerCase().includes('data_criacao') || f.toLowerCase().includes('created_at'));
    if (dateField) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentCount = data.filter((r: any) => {
        try { return new Date(r[dateField]) >= sevenDaysAgo; } catch { return false; }
      }).length;
      if (recentCount > 0) {
        insights.push(`${recentCount} novos nos últimos 7 dias`);
        if (recentCount > totalRecords * 0.3) trend = 'up';
      }
    }

    const highlight = insights[0] || '';
    const text = `Resumo: ${insights.join(' · ')}. ${trend === 'up' ? 'Tendência positiva detectada!' : 'Continue monitorando suas métricas.'}`;

    return { text, highlight, trend };
  };

  return {
    narrative: generateNarrative(),
    isLoading,
  };
};
