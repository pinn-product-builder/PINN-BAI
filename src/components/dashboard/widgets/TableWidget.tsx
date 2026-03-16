import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Info, ChevronLeft, ChevronRight, Loader2, Database, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Column {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'currency' | 'date' | 'badge';
}

interface TableWidgetProps {
  title: string;
  description: string;
  data?: Record<string, unknown>[];
  columns?: Column[];
  pageSize?: number;
  isLoading?: boolean;
}

const formatValue = (value: unknown, type?: string): React.ReactNode => {
  if (value === null || value === undefined) return <span className="text-muted-foreground/40">-</span>;

  switch (type) {
    case 'currency':
      return (
        <span className="tabular-nums font-medium">
          {new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            maximumFractionDigits: 0,
          }).format(Number(value))}
        </span>
      );
    case 'number':
      return <span className="tabular-nums">{Number(value).toLocaleString('pt-BR')}</span>;
    case 'date':
      try {
        return (
          <span className="text-muted-foreground">
            {formatDistanceToNow(new Date(String(value)), { addSuffix: true, locale: ptBR })}
          </span>
        );
      } catch {
        return String(value);
      }
    case 'badge':
      return (
        <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0.5">
          {String(value)}
        </Badge>
      );
    default:
      return String(value);
  }
};

const TableWidget = ({
  title,
  description,
  data = [],
  columns: providedColumns,
  pageSize = 5,
  isLoading = false,
}: TableWidgetProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  const hasRealData = data.length > 0;

  const columns = useMemo(() => {
    if (providedColumns && providedColumns.length > 0) return providedColumns;
    if (data.length > 0) {
      // Filter out internal/system columns
      const skipColumns = /^(id|uuid|pk|org_id|dashboard_id|integration_id|widget_id|created_by|updated_by)$/i;
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}/i;
      
      const allKeys = Object.keys(data[0]);
      const goodKeys = allKeys.filter(key => {
        if (skipColumns.test(key)) return false;
        // Skip columns where all sample values look like UUIDs
        const sample = data[0][key];
        if (typeof sample === 'string' && uuidPattern.test(sample)) return false;
        return true;
      });

      // Prioritize user-friendly columns: name, email, status, date, value fields
      const priority = (key: string): number => {
        const k = key.toLowerCase();
        if (k.includes('name') || k.includes('nome')) return 0;
        if (k.includes('email')) return 1;
        if (k.includes('phone') || k.includes('telefone')) return 2;
        if (k.includes('status')) return 3;
        if (k.includes('source') || k.includes('origem') || k.includes('anuncio')) return 4;
        if (k.includes('stage') || k.includes('etapa')) return 5;
        if (k.includes('created') || k.includes('date') || k.includes('data')) return 6;
        if (k.includes('value') || k.includes('valor')) return 7;
        return 10;
      };

      const sortedKeys = [...goodKeys].sort((a, b) => priority(a) - priority(b)).slice(0, 7);

      // Pretty label map for common columns
      const labelMap: Record<string, string> = {
        name: 'Nome', full_name: 'Nome Completo', first_name: 'Nome',
        email: 'E-mail', phone: 'Telefone', telefone: 'Telefone',
        status: 'Status', lead_source: 'Origem', source: 'Origem', anuncio: 'Anúncio',
        stage_name: 'Etapa', stage: 'Etapa', created_at: 'Criado em',
        updated_at: 'Atualizado', data: 'Data', date: 'Data',
        value: 'Valor', revenue: 'Receita', amount: 'Valor',
      };

      return sortedKeys.map((key) => {
        const sampleValue = data[0][key];
        let type: Column['type'] = 'text';
        if (typeof sampleValue === 'number') type = 'number';
        else if (key.includes('date') || key.includes('created_at') || key.includes('updated_at') || key === 'data') type = 'date';
        else if (key.includes('status') || key.includes('source') || key.includes('stage') || key.includes('anuncio')) type = 'badge';
        else if (key.includes('value') || key.includes('price') || key.includes('revenue') || key.includes('valor')) type = 'currency';
        
        const label = labelMap[key.toLowerCase()] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return { key, label, type };
      });
    }
    return [];
  }, [providedColumns, data]);

  const totalPages = Math.ceil(data.length / pageSize);
  const paginatedData = data.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  if (isLoading) {
    return (
      <Card className="rounded-xl h-full flex items-center justify-center min-h-[350px] bg-card/80 backdrop-blur-sm border-border/50">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Carregando dados...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('rounded-xl bg-card/80 backdrop-blur-sm border-border/50', !hasRealData && 'opacity-60')}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">{description}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            {hasRealData && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.length} registro{data.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          {hasRealData && (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 border border-border/50 text-muted-foreground">
                <Search className="w-3 h-3" />
                <span className="text-[10px]">Buscar...</span>
              </div>
            </div>
          )}
          {!hasRealData && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Sem dados</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasRealData ? (
          <div className="h-[250px] flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Sem dados disponíveis</p>
              <p className="text-xs mt-1 text-muted-foreground/60">Configure a fonte de dados</p>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 border-border/50 hover:bg-muted/30">
                    {columns.map((column) => (
                      <TableHead key={column.key} className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider h-9">
                        {column.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((row, rowIndex) => (
                    <TableRow
                      key={rowIndex}
                      className="border-border/30 hover:bg-muted/20 transition-colors"
                    >
                      {columns.map((column) => (
                        <TableCell key={column.key} className="text-xs py-2.5">
                          {formatValue(row[column.key], column.type)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  Página {currentPage + 1} de {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md"
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage === totalPages - 1}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TableWidget;
