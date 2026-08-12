import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subDays,
  subMonths,
  parse,
  isValid,
  format,
} from 'date-fns';

export type QuickPeriod =
  | 'today'
  | 'week'
  | 'last_15d'
  | 'month'
  | 'prev_month'
  | 'quarter'
  | 'year'
  | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface Filters {
  period: QuickPeriod;
  dateRange: DateRange;
  sellerId: string | null;
  unitId: string | null;
}

export interface FilterContextValue {
  filters: Filters;
  setPeriod: (period: QuickPeriod) => void;
  setCustomDateRange: (range: DateRange) => void;
  setSellerId: (id: string | null) => void;
  setUnitId: (id: string | null) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  /** ISO strings prontos para queries no Supabase */
  dateRangeISO: { start: string; end: string };
}

const DEFAULT_PERIOD: QuickPeriod = 'month';

function computeDateRange(
  period: QuickPeriod,
  customStart?: Date,
  customEnd?: Date,
): DateRange {
  const now = new Date();
  switch (period) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'week':
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case 'last_15d':
      return { start: startOfDay(subDays(now, 14)), end: endOfDay(now) };
    case 'month':
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case 'prev_month': {
      const prev = subMonths(now, 1);
      return { start: startOfMonth(prev), end: endOfMonth(prev) };
    }
    case 'quarter':
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case 'year':
      return { start: startOfYear(now), end: endOfYear(now) };
    case 'custom':
      return {
        start: customStart ?? startOfDay(subDays(now, 29)),
        end: customEnd ?? endOfDay(now),
      };
  }
}

function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined;
  // Usa parse (não parseISO) para interpretar a data em horário local.
  // parseISO trata strings date-only como UTC midnight, causando off-by-one em UTC-3 (Brasil).
  const d = parse(value, 'yyyy-MM-dd', new Date());
  return isValid(d) ? d : undefined;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const period = (searchParams.get('period') as QuickPeriod | null) ?? DEFAULT_PERIOD;
  const sellerId = searchParams.get('seller');
  const unitId = searchParams.get('unit');

  const customStart = useMemo(
    () => parseDateParam(searchParams.get('start')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams.get('start')],
  );
  const customEnd = useMemo(
    () => parseDateParam(searchParams.get('end')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams.get('end')],
  );

  const dateRange = useMemo(
    () => computeDateRange(period, customStart, customEnd),
    [period, customStart, customEnd],
  );

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(updates)) {
            if (value === null) next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setPeriod = useCallback(
    (p: QuickPeriod) => {
      const updates: Record<string, string | null> = { period: p };
      if (p !== 'custom') {
        updates.start = null;
        updates.end = null;
      }
      updateParams(updates);
    },
    [updateParams],
  );

  const setCustomDateRange = useCallback(
    (range: DateRange) => {
      updateParams({
        period: 'custom',
        start: format(range.start, 'yyyy-MM-dd'),
        end: format(range.end, 'yyyy-MM-dd'),
      });
    },
    [updateParams],
  );

  const setSellerId = useCallback(
    (id: string | null) => updateParams({ seller: id }),
    [updateParams],
  );

  const setUnitId = useCallback(
    (id: string | null) => updateParams({ unit: id }),
    [updateParams],
  );

  const clearFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const hasActiveFilters =
    period !== DEFAULT_PERIOD || sellerId !== null;

  const dateRangeISO = useMemo(
    () => ({
      start: dateRange.start.toISOString(),
      end: dateRange.end.toISOString(),
    }),
    [dateRange],
  );

  const filters = useMemo<Filters>(
    () => ({ period, dateRange, sellerId, unitId }),
    [period, dateRange, sellerId, unitId],
  );

  const value = useMemo<FilterContextValue>(
    () => ({
      filters,
      setPeriod,
      setCustomDateRange,
      setSellerId,
      setUnitId,
      clearFilters,
      hasActiveFilters,
      dateRangeISO,
    }),
    [
      filters,
      setPeriod,
      setCustomDateRange,
      setSellerId,
      setUnitId,
      clearFilters,
      hasActiveFilters,
      dateRangeISO,
    ],
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFiltersContext(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFiltersContext must be used inside <FilterProvider>');
  return ctx;
}
