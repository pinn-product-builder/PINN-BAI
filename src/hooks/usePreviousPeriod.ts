import { useMemo } from 'react';
import {
  subDays,
  subWeeks,
  subMonths,
  subQuarters,
  subYears,
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
  differenceInDays,
  format,
  getQuarter,
  getYear,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFilters } from '@/hooks/useFilters';
import type { QuickPeriod, DateRange } from '@/contexts/FilterContext';

export interface PeriodComparison {
  current: { start: string; end: string };
  previous: { start: string; end: string };
  label: string;
}

function buildPrevious(
  period: QuickPeriod,
  currentRange: DateRange,
): { prevStart: Date; prevEnd: Date; label: string } {
  const { start, end } = currentRange;

  switch (period) {
    case 'today': {
      const yesterday = subDays(start, 1);
      return {
        prevStart: startOfDay(yesterday),
        prevEnd: endOfDay(yesterday),
        label: `vs. ${format(yesterday, "dd 'de' MMMM", { locale: ptBR })}`,
      };
    }

    case 'week': {
      const prevWeekStart = startOfWeek(subWeeks(start, 1), { weekStartsOn: 1 });
      const prevWeekEnd = endOfWeek(subWeeks(start, 1), { weekStartsOn: 1 });
      return {
        prevStart: prevWeekStart,
        prevEnd: prevWeekEnd,
        label: 'vs. semana anterior',
      };
    }

    case 'month': {
      const prevMonthDate = subMonths(start, 1);
      return {
        prevStart: startOfMonth(prevMonthDate),
        prevEnd: endOfMonth(prevMonthDate),
        label: `vs. ${format(prevMonthDate, 'MMMM yyyy', { locale: ptBR })}`,
      };
    }

    case 'quarter': {
      const prevQuarterDate = subQuarters(start, 1);
      const q = getQuarter(prevQuarterDate);
      const y = getYear(prevQuarterDate);
      return {
        prevStart: startOfQuarter(prevQuarterDate),
        prevEnd: endOfQuarter(prevQuarterDate),
        label: `vs. T${q} ${y}`,
      };
    }

    case 'year': {
      const prevYearDate = subYears(start, 1);
      const y = getYear(prevYearDate);
      return {
        prevStart: startOfYear(prevYearDate),
        prevEnd: endOfYear(prevYearDate),
        label: `vs. ${y}`,
      };
    }

    case 'custom': {
      // Mesmo intervalo de dias, imediatamente antes
      const days = differenceInDays(end, start) + 1;
      const prevEnd = subDays(start, 1);
      const prevStart = subDays(prevEnd, days - 1);
      const sameYear = getYear(prevStart) === getYear(prevEnd);
      const labelStart = format(prevStart, sameYear ? 'dd/MM' : 'dd/MM/yyyy');
      const labelEnd = format(prevEnd, 'dd/MM/yyyy');
      return {
        prevStart,
        prevEnd,
        label: `vs. ${labelStart} – ${labelEnd}`,
      };
    }
  }
}

export function usePreviousPeriod(): PeriodComparison {
  const { filters, dateRangeISO } = useFilters();

  return useMemo(() => {
    const { prevStart, prevEnd, label } = buildPrevious(
      filters.period,
      filters.dateRange,
    );

    return {
      current: dateRangeISO,
      previous: {
        start: prevStart.toISOString(),
        end: prevEnd.toISOString(),
      },
      label,
    };
  }, [filters.period, filters.dateRange, dateRangeISO]);
}
