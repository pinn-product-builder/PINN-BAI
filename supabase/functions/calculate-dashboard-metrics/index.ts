import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  orgId: string;
  dateRange?: {
    start: string;
    end: string;
  };
  widgetConfigs?: Record<string, unknown>;
}

interface TimeSeriesPoint {
  date: string;
  leads: number;
  conversions: number;
  value: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orgId, dateRange }: RequestBody = await req.json();

    if (!orgId) {
      return new Response(
        JSON.stringify({ success: false, error: 'orgId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role for full access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate date range
    const endDate = dateRange?.end || new Date().toISOString();
    const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Previous period for comparison
    const periodLength = new Date(endDate).getTime() - new Date(startDate).getTime();
    const previousStartDate = new Date(new Date(startDate).getTime() - periodLength).toISOString();
    const previousEndDate = startDate;

    // Fetch current period leads
    const { data: currentLeads, error: currentError } = await supabase
      .from('leads')
      .select('*')
      .eq('org_id', orgId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (currentError) throw currentError;

    // Fetch previous period leads for comparison
    const { data: previousLeads, error: previousError } = await supabase
      .from('leads')
      .select('*')
      .eq('org_id', orgId)
      .gte('created_at', previousStartDate)
      .lte('created_at', previousEndDate);

    if (previousError) throw previousError;

    // Calculate current period metrics
    const leads = currentLeads || [];
    const prevLeads = previousLeads || [];

    const totalLeads = leads.length;
    const newLeads = leads.filter(l => l.status === 'new').length;
    const conversions = leads.filter(l => l.status === 'converted').length;
    const revenue = leads.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
    const conversionRate = totalLeads > 0 ? (conversions / totalLeads) * 100 : 0;
    const avgTicket = conversions > 0 ? revenue / conversions : 0;

    // Calculate previous period metrics
    const prevTotalLeads = prevLeads.length;
    const prevConversions = prevLeads.filter(l => l.status === 'converted').length;
    const prevRevenue = prevLeads.reduce((sum, l) => sum + (Number(l.value) || 0), 0);

    // Calculate time series data
    const timeSeriesMap: Record<string, TimeSeriesPoint> = {};

    for (const lead of leads) {
      const date = new Date(lead.created_at).toISOString().split('T')[0];
      if (!timeSeriesMap[date]) {
        timeSeriesMap[date] = { date, leads: 0, conversions: 0, value: 0 };
      }
      timeSeriesMap[date].leads++;
      if (lead.status === 'converted') {
        timeSeriesMap[date].conversions++;
      }
      timeSeriesMap[date].value += Number(lead.value) || 0;
    }

    const timeSeriesData = Object.values(timeSeriesMap).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate source distribution
    const sourceMap: Record<string, number> = {};
    for (const lead of leads) {
      sourceMap[lead.source] = (sourceMap[lead.source] || 0) + 1;
    }

    const sourceDistribution = Object.entries(sourceMap).map(([name, value]) => ({
      name,
      value,
      percentage: totalLeads > 0 ? (value / totalLeads) * 100 : 0,
    }));

    // Calculate status distribution
    const statusMap: Record<string, number> = {};
    for (const lead of leads) {
      statusMap[lead.status] = (statusMap[lead.status] || 0) + 1;
    }

    const statusDistribution = Object.entries(statusMap).map(([name, value]) => ({
      name,
      value,
      percentage: totalLeads > 0 ? (value / totalLeads) * 100 : 0,
    }));

    // Calculate funnel data
    const funnelStages = [
      { name: 'Novos', status: 'new' },
      { name: 'Qualificados', status: 'qualified' },
      { name: 'Em Análise', status: 'in_analysis' },
      { name: 'Proposta', status: 'proposal' },
      { name: 'Convertidos', status: 'converted' },
    ];

    let remainingLeads = totalLeads;
    const funnelData = funnelStages.map(stage => {
      const count = statusMap[stage.status] || 0;
      const percentage = totalLeads > 0 ? (remainingLeads / totalLeads) * 100 : 0;
      remainingLeads -= count;
      return {
        name: stage.name,
        value: count,
        percentage,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        metrics: {
          totalLeads,
          newLeads,
          conversions,
          conversionRate,
          revenue,
          avgTicket,
          previousPeriod: {
            totalLeads: prevTotalLeads,
            conversions: prevConversions,
            revenue: prevRevenue,
          },
          timeSeriesData,
          sourceDistribution,
          statusDistribution,
          funnelData,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error calculating metrics:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao calcular métricas',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
