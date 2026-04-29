import React, { createContext, useContext, useMemo, useState } from 'react';

export type PeriodPreset = '7d' | '30d' | '90d' | '180d' | '365d' | 'all';

export interface DashboardFilters {
  period: PeriodPreset;
  startDate: Date | null;
  endDate: Date | null;
}

interface DashboardFilterContextValue {
  filters: DashboardFilters;
  setPeriod: (period: PeriodPreset) => void;
}

const PERIOD_TO_DAYS: Record<PeriodPreset, number | null> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '180d': 180,
  '365d': 365,
  'all': null,
};

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
  '180d': 'Últimos 6 meses',
  '365d': 'Último ano',
  'all': 'Todo período',
};

const computeRange = (period: PeriodPreset): { startDate: Date | null; endDate: Date | null } => {
  const days = PERIOD_TO_DAYS[period];
  if (days === null) return { startDate: null, endDate: null };
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);
  return { startDate, endDate };
};

const DashboardFilterContext = createContext<DashboardFilterContextValue | undefined>(undefined);

export const DashboardFilterProvider: React.FC<{ children: React.ReactNode; defaultPeriod?: PeriodPreset }> = ({
  children,
  defaultPeriod = '30d',
}) => {
  const [period, setPeriodState] = useState<PeriodPreset>(defaultPeriod);

  const value = useMemo<DashboardFilterContextValue>(() => {
    const { startDate, endDate } = computeRange(period);
    return {
      filters: { period, startDate, endDate },
      setPeriod: (p) => setPeriodState(p),
    };
  }, [period]);

  return <DashboardFilterContext.Provider value={value}>{children}</DashboardFilterContext.Provider>;
};

export const useDashboardFilters = () => {
  const ctx = useContext(DashboardFilterContext);
  if (!ctx) {
    // Fallback seguro: sem filtro
    return {
      filters: { period: 'all' as PeriodPreset, startDate: null, endDate: null },
      setPeriod: () => {},
    };
  }
  return ctx;
};

/**
 * Detecta a primeira coluna de data em uma linha de dados.
 */
export const detectDateField = (row: Record<string, unknown>): string | null => {
  if (!row) return null;
  const keys = Object.keys(row);
  const candidates = ['created_at', 'data', 'date', 'day', 'dia', 'updated_at', 'timestamp', 'datetime'];
  for (const c of candidates) {
    const found = keys.find(k => k.toLowerCase() === c);
    if (found) return found;
  }
  // partial
  const partial = keys.find(k => {
    const l = k.toLowerCase();
    return l.endsWith('_at') || l.endsWith('_date') || l.includes('data') || l.includes('date');
  });
  return partial || null;
};

/**
 * Filtra um array de linhas por intervalo de datas usando a coluna de data detectada.
 * Se não houver coluna de data, retorna os dados originais.
 */
export const filterRowsByDateRange = <T extends Record<string, unknown>>(
  rows: T[],
  startDate: Date | null,
  endDate: Date | null,
): T[] => {
  if (!rows || rows.length === 0) return rows;
  if (!startDate && !endDate) return rows;
  const dateField = detectDateField(rows[0]);
  if (!dateField) return rows;
  const startMs = startDate ? startDate.getTime() : -Infinity;
  const endMs = endDate ? endDate.getTime() : Infinity;
  return rows.filter(row => {
    const raw = row[dateField];
    if (raw === null || raw === undefined || raw === '') return false;
    const t = new Date(String(raw)).getTime();
    if (isNaN(t)) return true; // mantém linhas sem data válida
    return t >= startMs && t <= endMs;
  });
};
