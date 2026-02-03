import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Database,
  ChevronDown,
  ChevronRight,
  Search,
  Columns3,
  Check,
  Eye,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DetectedTable, DetectedColumn } from '@/lib/types';

export interface SelectedTableConfig {
  tableName: string;
  selectedColumns: string[];
  isPrimary: boolean;
  rowCount: number;
  columnTypes: Record<string, string>;
  sampleData: Record<string, unknown>[];
}

interface TableSelectionProps {
  tables: DetectedTable[];
  selectedTables: SelectedTableConfig[];
  onSelectionChange: (selected: SelectedTableConfig[]) => void;
  minTables?: number;
  maxTables?: number;
}

const getTypeIcon = (type: DetectedColumn['type']) => {
  switch (type) {
    case 'number':
      return Hash;
    case 'date':
      return Calendar;
    case 'boolean':
      return ToggleLeft;
    case 'string':
    default:
      return Type;
  }
};

const getTypeBadgeColor = (type: DetectedColumn['type']) => {
  switch (type) {
    case 'number':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'date':
      return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    case 'boolean':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'string':
      return 'bg-green-500/10 text-green-600 border-green-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const TableSelection = ({
  tables,
  selectedTables,
  onSelectionChange,
  minTables = 1,
  maxTables = 10,
}: TableSelectionProps) => {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [previewTable, setPreviewTable] = useState<string | null>(null);

  const filteredTables = useMemo(() => {
    if (!searchQuery) return tables;
    const query = searchQuery.toLowerCase();
    return tables.filter(
      (table) =>
        table.name.toLowerCase().includes(query) ||
        table.columns.some((col) => col.name.toLowerCase().includes(query))
    );
  }, [tables, searchQuery]);

  const isTableSelected = (tableName: string) =>
    selectedTables.some((t) => t.tableName === tableName);

  const getSelectedTable = (tableName: string) =>
    selectedTables.find((t) => t.tableName === tableName);

  const toggleTableExpanded = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  const handleTableToggle = (table: DetectedTable, checked: boolean) => {
    if (checked) {
      // Select table with all columns by default
      const newSelection: SelectedTableConfig = {
        tableName: table.name,
        selectedColumns: table.columns.map((c) => c.name),
        isPrimary: selectedTables.length === 0, // First table is primary
        rowCount: table.rowCount,
        columnTypes: table.columns.reduce(
          (acc, col) => ({ ...acc, [col.name]: col.type }),
          {}
        ),
        sampleData: table.sampleData,
      };
      onSelectionChange([...selectedTables, newSelection]);
      // Auto-expand the table
      setExpandedTables((prev) => new Set([...prev, table.name]));
    } else {
      const newTables = selectedTables.filter((t) => t.tableName !== table.name);
      // If we removed the primary table, make the first remaining table primary
      if (newTables.length > 0 && !newTables.some((t) => t.isPrimary)) {
        newTables[0].isPrimary = true;
      }
      onSelectionChange(newTables);
    }
  };

  const handleColumnToggle = (tableName: string, columnName: string, checked: boolean) => {
    const table = selectedTables.find((t) => t.tableName === tableName);
    if (!table) return;

    let newColumns: string[];
    if (checked) {
      newColumns = [...table.selectedColumns, columnName];
    } else {
      newColumns = table.selectedColumns.filter((c) => c !== columnName);
    }

    // Ensure at least one column is selected
    if (newColumns.length === 0) return;

    const updatedTables = selectedTables.map((t) =>
      t.tableName === tableName ? { ...t, selectedColumns: newColumns } : t
    );
    onSelectionChange(updatedTables);
  };

  const handleSetPrimary = (tableName: string) => {
    const updatedTables = selectedTables.map((t) => ({
      ...t,
      isPrimary: t.tableName === tableName,
    }));
    onSelectionChange(updatedTables);
  };

  const handleSelectAllColumns = (tableName: string, table: DetectedTable) => {
    const selectedTable = getSelectedTable(tableName);
    if (!selectedTable) return;

    const allColumns = table.columns.map((c) => c.name);
    const updatedTables = selectedTables.map((t) =>
      t.tableName === tableName ? { ...t, selectedColumns: allColumns } : t
    );
    onSelectionChange(updatedTables);
  };

  const handleDeselectAllColumns = (tableName: string, table: DetectedTable) => {
    const selectedTable = getSelectedTable(tableName);
    if (!selectedTable) return;

    // Keep at least the first column
    const updatedTables = selectedTables.map((t) =>
      t.tableName === tableName ? { ...t, selectedColumns: [table.columns[0].name] } : t
    );
    onSelectionChange(updatedTables);
  };

  const previewTableData = previewTable
    ? tables.find((t) => t.name === previewTable)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Selecionar Tabelas e Colunas
          </h3>
          <p className="text-sm text-muted-foreground">
            Escolha quais tabelas e campos deseja importar
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Check className="w-3 h-3" />
          {selectedTables.length} de {tables.length} selecionadas
        </Badge>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar tabelas ou colunas..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tables List */}
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-3">
          {filteredTables.map((table) => {
            const isSelected = isTableSelected(table.name);
            const selectedTable = getSelectedTable(table.name);
            const isExpanded = expandedTables.has(table.name);

            return (
              <Card
                key={table.name}
                className={cn(
                  'transition-all',
                  isSelected && 'border-accent ring-2 ring-accent/20'
                )}
              >
                <Collapsible open={isExpanded}>
                  {/* Table Header */}
                  <div className="p-4">
                    <div className="flex items-center gap-4">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          handleTableToggle(table, checked === true)
                        }
                        id={`table-${table.name}`}
                        disabled={
                          !isSelected &&
                          selectedTables.length >= maxTables
                        }
                      />

                      <CollapsibleTrigger
                        onClick={() => toggleTableExpanded(table.name)}
                        className="flex-1"
                      >
                        <div className="flex items-center gap-3 cursor-pointer">
                          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                            <Database className="w-5 h-5 text-accent" />
                          </div>
                          <div className="text-left flex-1">
                            <div className="flex items-center gap-2">
                              <Label
                                htmlFor={`table-${table.name}`}
                                className="font-semibold text-foreground cursor-pointer"
                              >
                                {table.name}
                              </Label>
                              {selectedTable?.isPrimary && (
                                <Badge className="text-[10px] py-0 bg-accent text-accent-foreground">
                                  Principal
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {table.columns.length} colunas •{' '}
                              {table.rowCount.toLocaleString()} registros
                            </p>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </CollapsibleTrigger>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setPreviewTable(
                            previewTable === table.name ? null : table.name
                          )
                        }
                        className="gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        Preview
                      </Button>
                    </div>
                  </div>

                  {/* Columns Selection */}
                  <CollapsibleContent>
                    {isSelected && (
                      <div className="border-t border-border px-4 py-3 bg-muted/30">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Columns3 className="w-4 h-4" />
                            {selectedTable?.selectedColumns.length} de{' '}
                            {table.columns.length} colunas selecionadas
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleSelectAllColumns(table.name, table)
                              }
                              className="h-7 text-xs"
                            >
                              Selecionar todas
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleDeselectAllColumns(table.name, table)
                              }
                              className="h-7 text-xs"
                            >
                              Limpar
                            </Button>
                            {!selectedTable?.isPrimary &&
                              selectedTables.length > 1 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSetPrimary(table.name)}
                                  className="h-7 text-xs"
                                >
                                  Definir como principal
                                </Button>
                              )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {table.columns.map((column) => {
                            const TypeIcon = getTypeIcon(column.type);
                            const isColumnSelected =
                              selectedTable?.selectedColumns.includes(
                                column.name
                              ) ?? false;

                            return (
                              <div
                                key={column.name}
                                className={cn(
                                  'flex items-center gap-2 p-2 rounded-md border transition-colors cursor-pointer',
                                  isColumnSelected
                                    ? 'bg-accent/5 border-accent/30'
                                    : 'bg-background border-border hover:border-accent/30'
                                )}
                                onClick={() =>
                                  handleColumnToggle(
                                    table.name,
                                    column.name,
                                    !isColumnSelected
                                  )
                                }
                              >
                                <Checkbox
                                  checked={isColumnSelected}
                                  onCheckedChange={(checked) =>
                                    handleColumnToggle(
                                      table.name,
                                      column.name,
                                      checked === true
                                    )
                                  }
                                  className="pointer-events-none"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate text-foreground">
                                    {column.name}
                                  </p>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-[10px] py-0 px-1.5 shrink-0',
                                    getTypeBadgeColor(column.type)
                                  )}
                                >
                                  <TypeIcon className="w-2.5 h-2.5 mr-1" />
                                  {column.type}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Preview Modal */}
      {previewTableData && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-foreground">
              Preview: {previewTableData.name}
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewTable(null)}
            >
              Fechar
            </Button>
          </div>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  {previewTableData.columns.slice(0, 6).map((col) => (
                    <TableHead key={col.name} className="font-medium">
                      {col.name}
                    </TableHead>
                  ))}
                  {previewTableData.columns.length > 6 && (
                    <TableHead className="text-center">...</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewTableData.sampleData.slice(0, 3).map((row, idx) => (
                  <TableRow key={idx}>
                    {previewTableData.columns.slice(0, 6).map((col) => (
                      <TableCell key={col.name} className="text-sm">
                        {String(row[col.name] ?? '-')}
                      </TableCell>
                    ))}
                    {previewTableData.columns.length > 6 && (
                      <TableCell className="text-center text-muted-foreground">
                        ...
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Mostrando {Math.min(3, previewTableData.sampleData.length)} de{' '}
            {previewTableData.rowCount.toLocaleString()} registros
          </p>
        </Card>
      )}

      {/* Selection Summary */}
      {selectedTables.length > 0 && (
        <div className="p-4 bg-accent/5 rounded-lg border border-accent/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">
                Resumo da Seleção
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedTables.length}{' '}
                {selectedTables.length === 1 ? 'tabela' : 'tabelas'} •{' '}
                {selectedTables.reduce(
                  (acc, t) => acc + t.selectedColumns.length,
                  0
                )}{' '}
                colunas •{' '}
                {selectedTables
                  .reduce((acc, t) => acc + t.rowCount, 0)
                  .toLocaleString()}{' '}
                registros totais
              </p>
            </div>
            {selectedTables.length < minTables && (
              <Badge variant="destructive">
                Selecione pelo menos {minTables}{' '}
                {minTables === 1 ? 'tabela' : 'tabelas'}
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TableSelection;
