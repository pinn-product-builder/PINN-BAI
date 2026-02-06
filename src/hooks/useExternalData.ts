import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FetchParams {
  tableName: string;
  columns?: string[];
  filters?: Record<string, unknown>;
  limit?: number;
  orderBy?: string;
  orderAsc?: boolean;
}

interface FetchResult<T = Record<string, unknown>> {
  success: boolean;
  data: T[];
  count: number;
  tableName: string;
  error?: string;
}

/**
 * Hook to fetch data from the client's external Supabase database
 * Uses the integration credentials stored in our database
 */
export const useExternalData = <T = Record<string, unknown>>(
  orgId: string | undefined,
  params: FetchParams | null,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: ['external-data', orgId, params?.tableName, params?.filters, params?.columns],
    queryFn: async (): Promise<FetchResult<T>> => {
      if (!orgId || !params) {
        throw new Error('orgId and params are required');
      }

      try {
        const { data, error } = await supabase.functions.invoke('fetch-client-data', {
          body: {
            orgId,
            ...params,
          },
        });

        if (error) {
          console.error('Edge Function error:', error);
          return {
            success: false,
            data: [],
            count: 0,
            tableName: params.tableName,
            error: error.message || 'Erro ao invocar Edge Function',
          };
        }

        // Check if response has error
        if (data && typeof data === 'object' && 'error' in data && data.error) {
          const errorMsg = typeof data.error === 'string' 
            ? data.error 
            : 'Erro desconhecido ao buscar dados';
          console.error('Data fetch error:', errorMsg);
          return {
            success: false,
            data: [],
            count: 0,
            tableName: params.tableName,
            error: errorMsg,
          };
        }

        // Check if response indicates failure
        if (data && typeof data === 'object' && 'success' in data && !data.success) {
          const errorMsg = data.error || 'Falha ao buscar dados';
          return {
            success: false,
            data: [],
            count: 0,
            tableName: params.tableName,
            error: typeof errorMsg === 'string' ? errorMsg : 'Erro desconhecido',
          };
        }

        const result = (data as FetchResult<T>) || {
          success: true,
          data: [],
          count: 0,
          tableName: params.tableName,
        };
        
        // Debug logging
        console.log('[useExternalData] Response for table:', params.tableName, {
          success: result.success,
          dataCount: result.data?.length || 0,
          firstRow: result.data?.[0] || null,
          availableFields: result.data?.[0] ? Object.keys(result.data[0]) : [],
          error: result.error,
        });
        
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error('useExternalData error:', err);
        return {
          success: false,
          data: [],
          count: 0,
          tableName: params?.tableName || 'unknown',
          error: errorMessage,
        };
      }
    },
    enabled: !!orgId && !!params?.tableName && (options?.enabled !== false),
    staleTime: 30000, // Data is fresh for 30 seconds
    refetchOnWindowFocus: false,
    retry: 1, // Retry once on failure
  });
};

/**
 * Hook to fetch multiple tables from the client's external Supabase
 */
export const useExternalMultiTableData = (
  orgId: string | undefined,
  tableConfigs: FetchParams[],
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: ['external-multi-data', orgId, tableConfigs.map(t => t.tableName)],
    queryFn: async (): Promise<Record<string, FetchResult>> => {
      if (!orgId || tableConfigs.length === 0) {
        return {};
      }

      const results: Record<string, FetchResult> = {};

      // Fetch all tables in parallel
      const promises = tableConfigs.map(async (config) => {
        const { data, error } = await supabase.functions.invoke('fetch-client-data', {
          body: {
            orgId,
            ...config,
          },
        });

        if (error) {
          results[config.tableName] = {
            success: false,
            data: [],
            count: 0,
            tableName: config.tableName,
            error: error.message,
          };
        } else if (data.error) {
          results[config.tableName] = {
            success: false,
            data: [],
            count: 0,
            tableName: config.tableName,
            error: data.error,
          };
        } else {
          results[config.tableName] = data;
        }
      });

      await Promise.all(promises);

      return results;
    },
    enabled: !!orgId && tableConfigs.length > 0 && (options?.enabled !== false),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Get aggregated metrics from external data
 */
export const useExternalMetrics = (
  orgId: string | undefined,
  tableName: string | undefined,
  metricConfigs: Array<{
    field: string;
    aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
    label: string;
  }>,
  options?: { enabled?: boolean }
) => {
  const { data: rawData, isLoading, error } = useExternalData(
    orgId,
    tableName ? { tableName, limit: 10000 } : null,
    options
  );

  const metrics = !rawData?.data ? [] : metricConfigs.map((config) => {
    const values = rawData.data
      .map((row) => {
        const val = row[config.field];
        return typeof val === 'number' ? val : parseFloat(String(val)) || 0;
      })
      .filter((v) => !isNaN(v));

    let result = 0;
    switch (config.aggregation) {
      case 'count':
        result = values.length;
        break;
      case 'sum':
        result = values.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        result = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        break;
      case 'min':
        result = values.length > 0 ? Math.min(...values) : 0;
        break;
      case 'max':
        result = values.length > 0 ? Math.max(...values) : 0;
        break;
    }

    return {
      label: config.label,
      field: config.field,
      aggregation: config.aggregation,
      value: result,
    };
  });

  return {
    metrics,
    rawData: rawData?.data || [],
    count: rawData?.count || 0,
    isLoading,
    error,
  };
};
