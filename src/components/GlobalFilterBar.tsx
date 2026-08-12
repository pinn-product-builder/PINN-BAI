import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parse, isValid } from 'date-fns';
import { X, SlidersHorizontal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFilters } from '@/hooks/useFilters';
import { type QuickPeriod } from '@/contexts/FilterContext';
import { cn } from '@/lib/utils';

const PERIOD_OPTIONS: { value: QuickPeriod; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: '30 dias' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Ano' },
  { value: 'custom', label: 'Personalizado' },
];

interface SellerProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

export function GlobalFilterBar() {
  const { orgId } = useParams<{ orgId: string }>();
  const {
    filters,
    setPeriod,
    setCustomDateRange,
    setSellerId,
    clearFilters,
    hasActiveFilters,
  } = useFilters();

  const { data: sellers } = useQuery<SellerProfile[]>({
    queryKey: ['org-sellers', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('org_id', orgId);
      if (error) throw error;
      return (data ?? []) as SellerProfile[];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  // Usa e.target.value (string "yyyy-MM-dd") em vez de valueAsDate para evitar
  // UTC midnight → off-by-one em fusos como Brasília (UTC-3).
  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = parse(e.target.value, 'yyyy-MM-dd', new Date());
    if (!isValid(d)) return;
    const currentEnd = filters.dateRange.end;
    setCustomDateRange({ start: d, end: d > currentEnd ? d : currentEnd });
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = parse(e.target.value, 'yyyy-MM-dd', new Date());
    if (!isValid(d)) return;
    const currentStart = filters.dateRange.start;
    setCustomDateRange({ start: d < currentStart ? d : currentStart, end: d });
  };

  return (
    <div className="flex items-center gap-2 px-6 py-2.5 border-b border-border/40 bg-card/40 backdrop-blur-sm flex-wrap">
      {/* Ícone */}
      <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />

      {/* Botões de período rápido */}
      <div className="flex items-center gap-1">
        {PERIOD_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setPeriod(value)}
            className={cn(
              'h-7 px-2.5 rounded-md text-xs font-medium transition-colors',
              filters.period === value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Inputs de data personalizada */}
      {filters.period === 'custom' && (
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">De</span>
          <input
            type="date"
            value={format(filters.dateRange.start, 'yyyy-MM-dd')}
            max={format(filters.dateRange.end, 'yyyy-MM-dd')}
            onChange={handleStartChange}
            className="h-7 px-2 rounded-md border border-border/60 bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          <span className="text-[11px] text-muted-foreground">até</span>
          <input
            type="date"
            value={format(filters.dateRange.end, 'yyyy-MM-dd')}
            min={format(filters.dateRange.start, 'yyyy-MM-dd')}
            onChange={handleEndChange}
            className="h-7 px-2 rounded-md border border-border/60 bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
      )}

      <div className="w-px h-4 bg-border/40 mx-0.5 shrink-0" />

      {/* Seletor de vendedor */}
      {sellers && sellers.length > 0 && (
        <Select
          value={filters.sellerId ?? 'all'}
          onValueChange={(v) => setSellerId(v === 'all' ? null : v)}
        >
          <SelectTrigger className="h-7 w-auto min-w-[130px] max-w-[180px] text-xs border-border/60 bg-background focus:ring-primary/40">
            <SelectValue placeholder="Todos os vendedores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              Todos os vendedores
            </SelectItem>
            {sellers.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                {s.full_name ?? s.email ?? s.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Badge + limpar */}
      {hasActiveFilters && (
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <span className="inline-flex items-center h-5 px-1.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">
            Filtros ativos
          </span>
          <button
            type="button"
            onClick={clearFilters}
            title="Limpar filtros"
            className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Período ativo (visível apenas quando sem filtros extras) */}
      {!hasActiveFilters && (
        <span className="ml-auto text-[11px] text-muted-foreground/50 shrink-0">
          {format(filters.dateRange.start, 'dd/MM/yyyy')} –{' '}
          {format(filters.dateRange.end, 'dd/MM/yyyy')}
        </span>
      )}
    </div>
  );
}
