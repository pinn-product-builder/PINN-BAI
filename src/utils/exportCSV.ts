import { format, parseISO, isValid } from 'date-fns';
import type { ColumnDef } from '@/hooks/useDrillDown';

const SEP = ';';
const BOM = '\uFEFF'; // UTF-8 BOM — Excel BR abre corretamente sem precisar importar

const fmtCurrencyNum = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function cellToString(value: unknown, fmt?: ColumnDef['format']): string {
  if (value === null || value === undefined) return '';

  if (fmt === 'date') {
    const d =
      typeof value === 'string'
        ? parseISO(value)
        : value instanceof Date
          ? value
          : new Date(value as number);
    return isValid(d) ? format(d, 'dd/MM/yyyy') : String(value);
  }

  if (fmt === 'currency') {
    const n = Number(value);
    // No CSV, moeda vai como número formatado BR (sem R$) para o Excel calcular
    return isNaN(n) ? String(value) : fmtCurrencyNum.format(n).replace('.', '').replace(',', '.');
  }

  if (fmt === 'number') {
    const n = Number(value);
    return isNaN(n) ? String(value) : String(n);
  }

  return String(value);
}

function escapeCsvCell(raw: string): string {
  // RFC 4180: envolve em aspas se contém SEP, aspas ou quebra de linha
  if (raw.includes(SEP) || raw.includes('"') || raw.includes('\n') || raw.includes('\r')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function exportCSV(
  data: Record<string, unknown>[],
  columns: ColumnDef[],
  filename: string,
): void {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(SEP);

  const rows = data.map((row) =>
    columns
      .map((col) => escapeCsvCell(cellToString(row[col.key], col.format)))
      .join(SEP),
  );

  const csv = BOM + [header, ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
