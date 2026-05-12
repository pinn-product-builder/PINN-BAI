import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePreviousPeriod } from '@/hooks/usePreviousPeriod';

export interface IsoRange {
  start: string;
  end: string;
}

export interface UseKpiComparisonOptions<TRaw = number> {
  /** Base da chave para o React Query — inclua o orgId e qualquer parâmetro fixo. */
  queryKey: string[];
  /** Recebe o intervalo de datas ISO e retorna o valor bruto. */
  queryFn: (range: IsoRange) => Promise<TRaw>;
  /** Transforma TRaw em número para o cálculo de delta. Padrão: identity (assume TRaw = number). */
  select?: (raw: TRaw) => number;
  /** Desabilita a query (ex: enquanto orgId é undefined). Padrão: true. */
  enabled?: boolean;
}

export interface KpiComparisonResult {
  current: number | null;
  previous: number | null;
  /** Delta percentual: ((current - previous) / |previous|) * 100 */
  delta: number | null;
  isLoading: boolean;
  /** Label do período anterior. Ex: "vs. março 2026" */
  periodLabel: string;
}

export function useKpiComparison<TRaw = number>({
  queryKey,
  queryFn,
  select,
  enabled = true,
}: UseKpiComparisonOptions<TRaw>): KpiComparisonResult {
  const { current, previous, label } = usePreviousPeriod();

  const toNumber: (raw: TRaw) => number =
    select ?? ((v) => v as unknown as number);

  const { data, isLoading } = useQuery({
    // Chave inclui os dois intervalos para refetch automático ao mudar filtro
    queryKey: [
      ...queryKey,
      'comparison',
      current.start,
      current.end,
      previous.start,
      previous.end,
    ],
    queryFn: async () => {
      const [currentRaw, previousRaw] = await Promise.all([
        queryFn(current),
        queryFn(previous),
      ]);
      return {
        current: toNumber(currentRaw),
        previous: toNumber(previousRaw),
      };
    },
    staleTime: 5 * 60 * 1000,
    enabled,
  });

  const delta = useMemo(() => {
    if (data == null) return null;
    if (data.previous === 0) return null;
    return ((data.current - data.previous) / Math.abs(data.previous)) * 100;
  }, [data]);

  return {
    current: data?.current ?? null,
    previous: data?.previous ?? null,
    delta,
    isLoading,
    periodLabel: label,
  };
}
