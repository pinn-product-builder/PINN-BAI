import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Descoberta GENÉRICA de schema de uma fonte de dados — agnóstica de origem.
 *
 * Amostra N linhas de QUALQUER fonte (view/tabela interna ou integração externa)
 * via fetch-client-data e infere, por coluna: tipo (numérico/categórico/data/
 * booleano/texto) e cardinalidade. É a base do construtor multi-fonte: vale igual
 * pra Kommo, Omie, Ploomes, Supabase, Sheets, CSV, API. Sem hardcode de fonte.
 */
export type FieldKind = 'numeric' | 'categorical' | 'date' | 'boolean' | 'text';

export interface SourceField {
  name: string;
  kind: FieldKind;
  distinctValues: number;
  filledRatio: number; // 0-1 — quão preenchido (pra rankear o que vale plotar)
  hasSignal: boolean;  // numérico com algum valor ≠ 0, ou não-numérico preenchido
}

export interface SourceSchema {
  source: string;
  rowCount: number;       // nº de linhas na amostra (1 = fonte pré-agregada/KPI)
  fields: SourceField[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/;

function isDateLike(v: unknown): boolean {
  if (v instanceof Date) return true;
  if (typeof v !== 'string') return false;
  return DATE_RE.test(v.trim());
}

function inferKind(values: unknown[]): FieldKind {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== '');
  if (nonNull.length === 0) return 'text';
  const isBool = (v: unknown) => typeof v === 'boolean' || v === 'true' || v === 'false';
  if (nonNull.every(isBool)) return 'boolean';
  const isNum = (v: unknown) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)));
  if (nonNull.every(isNum)) return 'numeric';
  if (nonNull.every(isDateLike)) return 'date';
  const distinct = new Set(nonNull.map((v) => String(v))).size;
  return distinct <= 25 ? 'categorical' : 'text';
}

/** Bom pra gráfico de distribuição (pizza/barra). */
export function isChartableCategory(f: SourceField): boolean {
  return f.kind === 'categorical' && f.distinctValues >= 2 && f.distinctValues <= 25;
}

export function useSourceFields(orgId: string | undefined, source: string | undefined) {
  return useQuery<SourceSchema>({
    queryKey: ['source-schema', orgId ?? '', source ?? ''],
    enabled: !!orgId && !!source,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<SourceSchema> => {
      if (!orgId || !source) return { source: source ?? '', rowCount: 0, fields: [] };
      const { data, error } = await supabase.functions.invoke('fetch-client-data', {
        body: { orgId, tableName: source, limit: 200 },
      });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (((data as any)?.data ?? []) as Record<string, unknown>[]);
      if (rows.length === 0) return { source, rowCount: 0, fields: [] };

      const cols = Object.keys(rows[0]).filter((c) => c !== 'org_id' && c !== 'tenant_id' && c !== 'id');
      const fields: SourceField[] = cols.map((name) => {
        const values = rows.map((r) => r[name]);
        const filled = values.filter((v) => v !== null && v !== undefined && v !== '').length;
        const kind = inferKind(values);
        const hasSignal = kind === 'numeric'
          ? values.some((v) => v != null && Number(v) !== 0)   // algum valor ≠ 0
          : filled > 0;
        return {
          name,
          kind,
          distinctValues: new Set(values.filter((v) => v != null).map((v) => String(v))).size,
          filledRatio: rows.length ? filled / rows.length : 0,
          hasSignal,
        };
      });
      return { source, rowCount: rows.length, fields };
    },
  });
}
