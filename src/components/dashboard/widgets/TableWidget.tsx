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
import { Info, ChevronLeft, ChevronRight, Loader2, Database } from 'lucide-react';
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
  if (value === null || value === undefined) return '-';
  
  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
      }).format(Number(value));
    case 'number':
      return Number(value).toLocaleString('pt-BR');
    case 'date':
      try {
        return formatDistanceToNow(new Date(String(value)), { 
          addSuffix: true, 
          locale: ptBR 
        });
      } catch {
        return String(value);
      }
    case 'badge':
      return (
        <Badge variant="secondary" className="font-normal">
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
  isLoading = false
}: TableWidgetProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  
  const hasRealData = data.length > 0;
  
  // Auto-generate columns from data if not provided
  const columns = useMemo(() => {
    if (providedColumns && providedColumns.length > 0) {
      return providedColumns;
    }
    if (data.length > 0) {
      return Object.keys(data[0]).slice(0, 6).map(key => {
        // Detect column type based on first value
        const sampleValue = data[0][key];
        let type: Column['type'] = 'text';
        
        if (typeof sampleValue === 'number') {
          type = 'number';
        } else if (key.includes('date') || key.includes('created_at') || key.includes('updated_at')) {
          type = 'date';
        } else if (key.includes('status') || key.includes('source')) {
          type = 'badge';
        } else if (key.includes('value') || key.includes('price') || key.includes('revenue')) {
          type = 'currency';
        }
        
        return {
          key,
          label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
          type,
        };
      });
    }
    return [];
  }, [providedColumns, data]);

  const totalPages = Math.ceil(data.length / pageSize);
  const paginatedData = data.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  if (isLoading) {
    return (
      <Card className="h-full flex items-center justify-center min-h-[350px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Carregando dados...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn(!hasRealData && 'opacity-60')}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-base">{title}</CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">{description}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          {hasRealData && (
            <span className="text-xs text-muted-foreground">
              {data.length} registro{data.length !== 1 ? 's' : ''}
            </span>
          )}
          {!hasRealData && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              Sem dados
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasRealData ? (
          <div className="h-[250px] flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Sem dados disponíveis</p>
              <p className="text-xs mt-1">Configure a fonte de dados</p>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    {columns.map((column) => (
                      <TableHead key={column.key} className="font-medium">
                        {column.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((row, rowIndex) => (
                    <TableRow 
                      key={rowIndex}
                      className="animate-fade-up"
                      style={{ animationDelay: `${rowIndex * 50}ms` }}
                    >
                      {columns.map((column) => (
                        <TableCell key={column.key}>
                          {formatValue(row[column.key], column.type)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-muted-foreground">
                  Página {currentPage + 1} de {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage === totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
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
