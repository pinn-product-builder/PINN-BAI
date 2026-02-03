import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Lead, LeadSource, LeadStatus } from '@/lib/types';
import type { Json } from '@/integrations/supabase/types';

interface LeadsFilters {
  source?: LeadSource;
  status?: LeadStatus;
  search?: string;
  startDate?: string;
  endDate?: string;
}

interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

// Fetch leads for an organization with filters and pagination
export const useLeads = (
  orgId: string | undefined,
  filters?: LeadsFilters,
  pagination?: PaginationOptions
) => {
  const page = pagination?.page || 1;
  const pageSize = pagination?.pageSize || 10;

  return useQuery({
    queryKey: ['leads', orgId, filters, page, pageSize],
    queryFn: async (): Promise<{ data: Lead[]; count: number }> => {
      if (!orgId) return { data: [], count: 0 };

      let query = supabase
        .from('leads')
        .select('*', { count: 'exact' })
        .eq('org_id', orgId);

      // Apply filters
      if (filters?.source) {
        query = query.eq('source', filters.source);
      }

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,company.ilike.%${filters.search}%`
        );
      }

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to).order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: data || [],
        count: count || 0,
      };
    },
    enabled: !!orgId,
  });
};

// Get lead counts by status
export const useLeadStats = (orgId: string | undefined, dateRange?: { start: string; end: string }) => {
  return useQuery({
    queryKey: ['lead-stats', orgId, dateRange],
    queryFn: async () => {
      if (!orgId) return null;

      let query = supabase
        .from('leads')
        .select('status, value')
        .eq('org_id', orgId);

      if (dateRange?.start) {
        query = query.gte('created_at', dateRange.start);
      }

      if (dateRange?.end) {
        query = query.lte('created_at', dateRange.end);
      }

      const { data, error } = await query;

      if (error) throw error;

      const leads = data || [];

      // Calculate stats
      const total = leads.length;
      const byStatus: Record<string, number> = {};
      let totalValue = 0;
      let convertedValue = 0;
      let convertedCount = 0;

      leads.forEach((lead) => {
        byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
        totalValue += Number(lead.value) || 0;

        if (lead.status === 'converted') {
          convertedCount++;
          convertedValue += Number(lead.value) || 0;
        }
      });

      return {
        total,
        byStatus,
        totalValue,
        convertedCount,
        convertedValue,
        conversionRate: total > 0 ? (convertedCount / total) * 100 : 0,
        averageTicket: convertedCount > 0 ? convertedValue / convertedCount : 0,
      };
    },
    enabled: !!orgId,
  });
};

// Get leads time series for charts
export const useLeadsTimeSeries = (
  orgId: string | undefined,
  dateRange?: { start: string; end: string }
) => {
  return useQuery({
    queryKey: ['leads-timeseries', orgId, dateRange],
    queryFn: async () => {
      if (!orgId) return [];

      let query = supabase
        .from('leads')
        .select('created_at, status, value')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true });

      if (dateRange?.start) {
        query = query.gte('created_at', dateRange.start);
      }

      if (dateRange?.end) {
        query = query.lte('created_at', dateRange.end);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Group by date
      const groupedByDate: Record<string, { leads: number; conversions: number; value: number }> = {};

      (data || []).forEach((lead) => {
        const date = new Date(lead.created_at).toISOString().split('T')[0];
        if (!groupedByDate[date]) {
          groupedByDate[date] = { leads: 0, conversions: 0, value: 0 };
        }
        groupedByDate[date].leads++;
        if (lead.status === 'converted') {
          groupedByDate[date].conversions++;
        }
        groupedByDate[date].value += Number(lead.value) || 0;
      });

      return Object.entries(groupedByDate).map(([date, stats]) => ({
        date,
        ...stats,
      }));
    },
    enabled: !!orgId,
  });
};

// Get leads distribution by source
export const useLeadsBySource = (orgId: string | undefined) => {
  return useQuery({
    queryKey: ['leads-by-source', orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('leads')
        .select('source')
        .eq('org_id', orgId);

      if (error) throw error;

      const distribution: Record<string, number> = {};
      (data || []).forEach((lead) => {
        distribution[lead.source] = (distribution[lead.source] || 0) + 1;
      });

      const total = data?.length || 0;

      return Object.entries(distribution).map(([name, value]) => ({
        name,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
      }));
    },
    enabled: !!orgId,
  });
};

// Create lead
export const useCreateLead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lead: {
      org_id: string;
      integration_id?: string | null;
      external_id?: string | null;
      name: string;
      email?: string | null;
      phone?: string | null;
      company?: string | null;
      source?: LeadSource;
      status?: LeadStatus;
      value?: number;
      metadata?: Json;
    }): Promise<Lead> => {
      const { data, error } = await supabase
        .from('leads')
        .insert({
          org_id: lead.org_id,
          integration_id: lead.integration_id,
          external_id: lead.external_id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          source: lead.source || 'other',
          status: lead.status || 'new',
          value: lead.value || 0,
          metadata: lead.metadata || {},
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads', data.org_id] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats', data.org_id] });
    },
  });
};

// Update lead
export const useUpdateLead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Lead> & { id: string }): Promise<Lead> => {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads', data.org_id] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats', data.org_id] });
    },
  });
};
