import { useState, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  AlertCircle,
  Info,
  Copy,
  Sparkles,
  Loader2,
  CheckSquare,
  Square,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { DetectedTable, DetectedColumn } from '@/lib/types';

export interface SelectedTableConfig {
  tableName: string;
  selectedColumns: string[];
  isPrimary: boolean;
  rowCount: number;
  columnTypes: Record<string, string>;
  sampleData: Record<string, unknown>[];
}

interface TableSuggestion {
  tableName: string;
  score: number;
  reason: string;
  suggestedColumns: string[];
}

interface TableSelectionProps {
  tables: DetectedTable[];
  selectedTables: SelectedTableConfig[];
  onSelectionChange: (selected: SelectedTableConfig[]) => void;
  minTables?: number;
  maxTables?: number;
  isLoading?: boolean;
  discoveryMethod?: string;
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
  maxTables = 10000,
  isLoading = false,
  discoveryMethod,
}: TableSelectionProps) => {
  const { toast } = useToast();
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [previewTable, setPreviewTable] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<TableSuggestion[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [tableFilter, setTableFilter] = useState<'all' | 'suggested' | 'no_system'>('all');

  // System table patterns to filter out
  const isSystemTable = (name: string) => {
    const systemPatterns = /^(pg_|_|sql_|information_schema|auth\.|storage\.|supabase_|realtime\.|extensions\.|graphql_|vault\.|pgsodium)/i;
    const systemNames = ['schema_migrations', 'migrations', 'flyway_schema_history', 'ar_internal_metadata'];
    return systemPatterns.test(name) || systemNames.includes(name.toLowerCase());
  };

  const rpcHelperSql = `CREATE OR REPLACE FUNCTION get_public_tables()
RETURNS TABLE(table_name text)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT table_name::text 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE';
$$;`;

  const handleCopyRpcHelper = async () => {
    try {
      await navigator.clipboard.writeText(rpcHelperSql);
      toast({
        title: 'SQL copiado!',
        description: 'Execute este SQL no seu banco Supabase para habilitar a descoberta completa de tabelas.',
      });
    } catch {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar o SQL.',
        variant: 'destructive',
      });
    }
  };

  // AI Suggestions
  const fetchAISuggestions = useCallback(async () => {
    if (tables.length === 0) return;
    
    setIsLoadingAI(true);
    try {
      const tablesData = tables.map(t => ({
        name: t.name,
        rowCount: t.rowCount,
        columns: t.columns.map(c => ({ name: c.name, type: c.type })),
      }));

      const { data, error } = await supabase.functions.invoke('suggest-tables', {
        body: { tables: tablesData },
      });

      if (error) throw error;

      if (data?.suggestions) {
        setAiSuggestions(data.suggestions);
        setShowSuggestions(true);
        toast({
          title: 'Sugestões geradas!',
          description: `IA analisou ${tables.length} tabelas e sugeriu ${data.suggestions.length} para o dashboard.`,
        });
      }
    } catch (error) {
      console.error('AI suggestions error:', error);
      toast({
        title: 'Erro ao gerar sugestões',
        description: 'Não foi possível analisar as tabelas com IA.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAI(false);
    }
  }, [tables, toast]);

  const applySuggestions = useCallback(() => {
    if (aiSuggestions.length === 0) return;

    const newSelections: SelectedTableConfig[] = [];
    
    for (const suggestion of aiSuggestions) {
      const table = tables.find(t => t.name === suggestion.tableName);
      if (!table) continue;

      // Use suggested columns if available, otherwise all columns
      const columnsToSelect = suggestion.suggestedColumns?.length > 0
        ? table.columns.filter(c => suggestion.suggestedColumns.includes(c.name)).map(c => c.name)
        : table.columns.map(c => c.name);

      // Ensure at least some columns are selected
      const finalColumns = columnsToSelect.length > 0 ? columnsToSelect : table.columns.map(c => c.name);

      newSelections.push({
        tableName: table.name,
        selectedColumns: finalColumns,
        isPrimary: newSelections.length === 0,
        rowCount: table.rowCount,
        columnTypes: table.columns.reduce(
          (acc, col) => ({ ...acc, [col.name]: col.type }),
          {}
        ),
        sampleData: table.sampleData,
      });
    }

    if (newSelections.length > 0) {
      onSelectionChange(newSelections);
      // Expand the first few tables
      setExpandedTables(new Set(newSelections.slice(0, 3).map(t => t.tableName)));
      toast({
        title: 'Sugestões aplicadas!',
        description: `${newSelections.length} tabelas selecionadas automaticamente.`,
      });
    }
    setShowSuggestions(false);
  }, [aiSuggestions, tables, onSelectionChange, toast]);

  // Select/Deselect All
  const allTablesSelected = useMemo(() => 
    tables.length > 0 && tables.every(t => selectedTables.some(st => st.tableName === t.name)),
    [tables, selectedTables]
  );

  const handleSelectAll = useCallback(() => {
    if (allTablesSelected) {
      // Deselect all
      onSelectionChange([]);
    } else {
      // Select all
      const newSelections: SelectedTableConfig[] = tables.map((table, idx) => ({
        tableName: table.name,
        selectedColumns: table.columns.map(c => c.name),
        isPrimary: idx === 0,
        rowCount: table.rowCount,
        columnTypes: table.columns.reduce(
          (acc, col) => ({ ...acc, [col.name]: col.type }),
          {}
        ),
        sampleData: table.sampleData,
      }));
      onSelectionChange(newSelections);
    }
  }, [allTablesSelected, tables, onSelectionChange]);

  const filteredTables = useMemo(() => {
    let result = tables;
    
    // Apply filter mode
    if (tableFilter === 'suggested' && aiSuggestions.length > 0) {
      const suggestedNames = new Set(aiSuggestions.map(s => s.tableName));
      result = result.filter(t => suggestedNames.has(t.name));
    } else if (tableFilter === 'no_system') {
      result = result.filter(t => !isSystemTable(t.name));
    }
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (table) =>
          table.name.toLowerCase().includes(query) ||
          table.columns.some((col) => col.name.toLowerCase().includes(query))
      );
    }
    
    return result;
  }, [tables, searchQuery, tableFilter, aiSuggestions]);

  const isTableSelected = (tableName: string) =>
    selectedTables.some((t) => t.tableName === tableName);

  const getSelectedTable = (tableName: string) =>
    selectedTables.find((t) => t.tableName === tableName);

  const getSuggestion = (tableName: string) =>
    aiSuggestions.find((s) => s.tableName === tableName);

  const toggleTableExpanded = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  const handleTableToggle = useCallback((table: DetectedTable, checked: boolean) => {
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
  }, [selectedTables, onSelectionChange]);

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

      {/* Discovery Method Info */}
      {discoveryMethod === 'pattern_discovery' && tables.length > 0 && (
        <Alert className="bg-accent/5 border-accent/20">
          <Info className="h-4 w-4 text-accent" />
          <AlertTitle className="text-accent">Descoberta por padrões</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Encontramos {tables.length} tabelas testando nomes comuns. Para listar TODAS as tabelas do seu banco, 
            crie a função auxiliar abaixo no SQL Editor do Supabase:
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 gap-1"
              onClick={handleCopyRpcHelper}
            >
              <Copy className="h-3 w-3" />
              Copiar SQL da função helper
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Empty State */}
      {!isLoading && tables.length === 0 && (
        <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Nenhuma tabela encontrada</AlertTitle>
          <AlertDescription>
            Não foi possível acessar tabelas no banco conectado. Verifique:
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>As políticas RLS permitem leitura com a anon key</li>
              <li>As tabelas existem no schema public</li>
            </ul>
            <p className="mt-3 text-sm">
              Para garantir que TODAS as tabelas sejam listadas, crie esta função no seu banco:
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 gap-1"
              onClick={handleCopyRpcHelper}
            >
              <Copy className="h-3 w-3" />
              Copiar SQL da função helper
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Search and Controls */}
      {tables.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tabelas ou colunas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Select All Toggle */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={allTablesSelected ? "secondary" : "outline"}
                    size="sm"
                    onClick={handleSelectAll}
                    className="gap-2 shrink-0"
                  >
                    {allTablesSelected ? (
                      <>
                        <CheckSquare className="w-4 h-4" />
                        Desmarcar Todas
                      </>
                    ) : (
                      <>
                        <Square className="w-4 h-4" />
                        Selecionar Todas
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {allTablesSelected 
                    ? 'Desmarcar todas as tabelas' 
                    : `Selecionar todas as ${tables.length} tabelas`
                  }
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* AI Suggestions Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchAISuggestions}
                    disabled={isLoadingAI || tables.length === 0}
                    className="gap-2 shrink-0 border-accent/50 hover:bg-accent/10"
                  >
                    {isLoadingAI ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analisando...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 text-accent" />
                        Sugestão IA
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  IA analisará todas as tabelas e sugerirá as melhores para o dashboard
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Table Filters */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filtrar:</span>
            <div className="flex gap-1">
              <Button
                variant={tableFilter === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setTableFilter('all')}
                className="h-7 text-xs"
              >
                Todas ({tables.length})
              </Button>
              <Button
                variant={tableFilter === 'no_system' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setTableFilter('no_system')}
                className="h-7 text-xs"
              >
                Sem sistema ({tables.filter(t => !isSystemTable(t.name)).length})
              </Button>
              {aiSuggestions.length > 0 && (
                <Button
                  variant={tableFilter === 'suggested' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setTableFilter('suggested')}
                  className="h-7 text-xs gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Sugeridas IA ({aiSuggestions.length})
                </Button>
              )}
            </div>
          </div>

          {/* AI Suggestions Panel - Expanded */}
          {showSuggestions && aiSuggestions.length > 0 && (
            <Card className="border-accent/30 bg-accent/5">
              <div className="p-4 border-b border-accent/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-accent" />
                    <h4 className="font-semibold text-foreground">Sugestões da IA</h4>
                    <Badge variant="outline" className="text-xs">
                      {aiSuggestions.length} tabelas
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={applySuggestions}
                      className="gap-1"
                    >
                      <Check className="w-3 h-3" />
                      Aplicar Todas
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => setShowSuggestions(false)}
                    >
                      Fechar
                    </Button>
                  </div>
                </div>
              </div>
              <ScrollArea className="h-[500px] pr-4">
                <div className="p-4 space-y-3">
                  {aiSuggestions.map((suggestion) => (
                    <div 
                      key={suggestion.tableName}
                      className="p-3 bg-background rounded-lg border border-border/50 hover:border-accent/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs shrink-0",
                                suggestion.score >= 80 ? "border-accent/50 bg-accent/10 text-accent" :
                                suggestion.score >= 60 ? "border-primary/50 bg-primary/10 text-primary" :
                                "border-muted-foreground/50"
                              )}
                            >
                              {suggestion.score}%
                            </Badge>
                            <span className="font-semibold text-sm truncate">{suggestion.tableName}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {suggestion.reason}
                          </p>
                          {suggestion.suggestedColumns && suggestion.suggestedColumns.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="text-[10px] text-muted-foreground">Colunas sugeridas:</span>
                              {suggestion.suggestedColumns.map((col) => (
                                <Badge 
                                  key={col} 
                                  variant="secondary" 
                                  className="text-[10px] py-0 px-1.5"
                                >
                                  {col}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const table = tables.find(t => t.name === suggestion.tableName);
                            if (table) {
                              handleTableToggle(table, !isTableSelected(suggestion.tableName));
                            }
                          }}
                          className="shrink-0 h-7"
                        >
                          {isTableSelected(suggestion.tableName) ? (
                            <>
                              <Check className="w-3 h-3 mr-1" />
                              Selecionada
                            </>
                          ) : (
                            'Selecionar'
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}
        </div>
      )}

      {/* Tables List */}
      {tables.length > 0 && (
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-3">
          {filteredTables.map((table) => {
            const isSelected = isTableSelected(table.name);
            const selectedTable = getSelectedTable(table.name);
            const isExpanded = expandedTables.has(table.name);
            const suggestion = getSuggestion(table.name);

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
      )}

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
