import { useFiltersContext, type FilterContextValue } from '@/contexts/FilterContext';

/**
 * Hook principal para consumir os filtros globais do dashboard.
 *
 * Exemplo de uso num componente de gráfico:
 *
 *   const { dateRangeISO, filters } = useFilters();
 *   const { data } = useLeadStats(orgId, dateRangeISO);
 */
export function useFilters(): FilterContextValue {
  return useFiltersContext();
}
