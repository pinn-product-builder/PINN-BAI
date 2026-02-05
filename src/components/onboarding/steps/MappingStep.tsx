import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Plus, Trash2, ArrowRight, Info, PenLine, Check, Wand2, Loader2, Sparkles, CheckCircle2, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { DataIntegration } from './IntegrationStep';

// Local types for mapping step
export interface DataMapping {
  id: string;
  sourceField: string;
  sourceTable: string;
  targetMetric: string;
  transformation: string;
  aggregation?: string;
  format?: string;
}

interface MappingSuggestion {
  sourceField: string;
  sourceTable: string;
  targetMetric: string;
  transformation: string;
  confidence: number;
  reason: string;
}

type TransformationType = 'none' | 'date' | 'number' | 'currency' | 'percentage' | 'text' | 'boolean';

interface MappingStepProps {
  integration: DataIntegration | null;
  mappings: DataMapping[];
  onUpdate: (mappings: DataMapping[]) => void;
  onPrimaryTableChange?: (tableName: string) => void;
}

const TRANSFORMATIONS: { value: TransformationType; label: string }[] = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'number', label: 'Número' },
  { value: 'currency', label: 'Moeda (R$)' },
  { value: 'percentage', label: 'Percentual (%)' },
  { value: 'date', label: 'Data' },
  { value: 'text', label: 'Texto' },
];

const TARGET_METRICS: { value: string; label: string; description: string }[] = [
  { value: 'total_leads', label: 'Total de Leads', description: 'Número total de leads no período' },
  { value: 'new_leads', label: 'Novos Leads', description: 'Leads capturados recentemente' },
  { value: 'conversions', label: 'Conversões', description: 'Leads convertidos em clientes' },
  { value: 'conversion_rate', label: 'Taxa de Conversão', description: 'Percentual de leads convertidos' },
  { value: 'revenue', label: 'Receita Total', description: 'Soma de todas as vendas' },
  { value: 'mrr', label: 'MRR', description: 'Receita Recorrente Mensal' },
  { value: 'growth_rate', label: 'Taxa de Crescimento', description: 'Variação percentual no período' },
  { value: 'active_users', label: 'Usuários Ativos', description: 'Usuários com atividade recente' },
  { value: 'funnel_stage', label: 'Estágio do Funil', description: 'Posição no funil de vendas' },
  { value: 'lead_source', label: 'Origem do Lead', description: 'Canal de aquisição' },
  { value: 'created_date', label: 'Data de Criação', description: 'Data do registro' },
];

const MappingStep = ({ integration, mappings, onUpdate, onPrimaryTableChange }: MappingStepProps) => {
  const { toast } = useToast();
  const [selectedTable, setSelectedTable] = useState<string>(
    integration?.tables?.[0]?.name || ''
  );
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<MappingSuggestion[]>([]);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [aiMethod, setAiMethod] = useState<'ai' | 'heuristic'>('ai');

  // Notify parent of primary table changes
  const handleTableChange = (tableName: string) => {
    setSelectedTable(tableName);
    onPrimaryTableChange?.(tableName);
  };

  const tables = integration?.tables || [];
  const currentTable = tables.find(t => t.name === selectedTable);
  const columns = currentTable?.columns || [];

  // Fetch AI mapping suggestions
  const fetchAIMappings = useCallback(async () => {
    if (tables.length === 0) return;
    
    setIsLoadingAI(true);
    try {
      const tablesData = tables.map(t => ({
        name: t.name,
        rowCount: t.rowCount,
        columns: t.columns.map(c => ({ 
          name: c.name, 
          type: c.type,
          sampleValues: c.sampleValues?.slice(0, 3),
        })),
        sampleData: t.sampleData?.slice(0, 2),
      }));

      const { data, error } = await supabase.functions.invoke('suggest-mappings', {
        body: { tables: tablesData },
      });

      if (error) throw error;

      if (data?.suggestions && data.suggestions.length > 0) {
        setAiSuggestions(data.suggestions);
        setAiSummary(data.summary || '');
        setAiMethod(data.method || 'ai');
        setShowAISuggestions(true);
        
        // Update primary table if AI suggests one
        if (data.primaryTable && data.primaryTable !== selectedTable) {
          handleTableChange(data.primaryTable);
        }
        
        toast({
          title: 'Mapeamentos sugeridos!',
          description: `IA analisou ${tables.length} tabelas e sugeriu ${data.suggestions.length} mapeamentos.`,
        });
      } else {
        toast({
          title: 'Sem sugestões',
          description: 'Não foi possível identificar mapeamentos automáticos. Configure manualmente.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('AI mappings error:', error);
      toast({
        title: 'Erro ao gerar mapeamentos',
        description: 'Não foi possível analisar as tabelas com IA.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAI(false);
    }
  }, [tables, selectedTable, toast]);

  // Apply AI suggestions
  const applyAISuggestions = useCallback(() => {
    const newMappings: DataMapping[] = aiSuggestions.map((suggestion, idx) => ({
      id: `mapping-ai-${Date.now()}-${idx}`,
      sourceField: suggestion.sourceField,
      sourceTable: suggestion.sourceTable,
      targetMetric: suggestion.targetMetric,
      transformation: suggestion.transformation,
    }));

    onUpdate(newMappings);
    setShowAISuggestions(false);
    
    toast({
      title: 'Mapeamentos aplicados!',
      description: `${newMappings.length} mapeamentos configurados. Você pode ajustá-los abaixo.`,
    });
  }, [aiSuggestions, onUpdate, toast]);

  const addMapping = () => {
    const newMapping: DataMapping = {
      id: `mapping-${Date.now()}`,
      sourceField: '',
      sourceTable: selectedTable,
      targetMetric: 'total_leads',
      transformation: 'none',
    };
    onUpdate([...mappings, newMapping]);
  };

  const updateMapping = (id: string, updates: Partial<DataMapping>) => {
    onUpdate(
      mappings.map(m => (m.id === id ? { ...m, ...updates } : m))
    );
  };

  const removeMapping = (id: string) => {
    onUpdate(mappings.filter(m => m.id !== id));
  };

  const getSampleValues = (columnName: string): unknown[] => {
    const column = columns.find(c => c.name === columnName);
    return column?.sampleValues || [];
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-500 bg-green-500/10 border-green-500/30';
    if (confidence >= 75) return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
    return 'text-muted-foreground bg-muted/50 border-muted';
  };

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Mapeamento de Dados
          </h2>
          <p className="text-muted-foreground">
            Conecte os campos da sua fonte de dados às métricas do dashboard
          </p>
        </div>

        {/* AI Mapping Button */}
        <Card className="p-4 border-accent/30 bg-accent/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/20">
                <Wand2 className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">Mapeamento Automático com IA</h3>
                <p className="text-sm text-muted-foreground">
                  Deixe a IA analisar suas tabelas e sugerir os melhores mapeamentos
                </p>
              </div>
            </div>
            <Button
              onClick={fetchAIMappings}
              disabled={isLoadingAI || tables.length === 0}
              className="gap-2"
            >
              {isLoadingAI ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Gerar Mapeamentos
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* AI Suggestions Panel */}
        {showAISuggestions && aiSuggestions.length > 0 && (
          <Card className="p-6 border-accent/30 bg-gradient-to-br from-accent/5 to-transparent">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-accent" />
                  <div>
                    <h3 className="font-semibold text-foreground">
                      Sugestões da IA
                      <Badge variant="outline" className="ml-2 text-xs">
                        {aiMethod === 'ai' ? 'Gemini' : 'Heurística'}
                      </Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground">{aiSummary}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowAISuggestions(false)}>
                    <Edit3 className="w-4 h-4 mr-1" />
                    Personalizar
                  </Button>
                  <Button size="sm" onClick={applyAISuggestions} className="gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Aplicar Todos
                  </Button>
                </div>
              </div>

              {/* Suggestions List */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {aiSuggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border"
                  >
                    <Badge className={cn("shrink-0 text-xs font-mono", getConfidenceColor(suggestion.confidence))}>
                      {suggestion.confidence}%
                    </Badge>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <code className="px-1.5 py-0.5 bg-muted rounded text-xs truncate max-w-[150px]">
                          {suggestion.sourceTable}.{suggestion.sourceField}
                        </code>
                        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">
                          {TARGET_METRICS.find(m => m.value === suggestion.targetMetric)?.label || suggestion.targetMetric}
                        </span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {TRANSFORMATIONS.find(t => t.value === suggestion.transformation)?.label || suggestion.transformation}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {suggestion.reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Alert className="bg-muted/30 border-muted">
                <Info className="w-4 h-4" />
                <AlertTitle className="text-sm">Como funciona?</AlertTitle>
                <AlertDescription className="text-xs">
                  Clique em "Aplicar Todos" para usar as sugestões da IA, ou "Personalizar" para fechá-las e editar manualmente.
                  Após aplicar, você ainda pode ajustar cada mapeamento individualmente.
                </AlertDescription>
              </Alert>
            </div>
          </Card>
        )}

        {/* Table Selection */}
        {tables.length > 0 && (
          <div className="space-y-2">
            <Label>Tabela Principal (DataSource)</Label>
            <Select value={selectedTable} onValueChange={handleTableChange}>
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="Selecione uma tabela" />
              </SelectTrigger>
              <SelectContent>
                {tables.map(table => (
                  <SelectItem key={table.name} value={table.name}>
                    {table.name} ({table.rowCount.toLocaleString()} registros)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Esta tabela será usada como fonte de dados para os widgets do dashboard
            </p>
          </div>
        )}

        {/* Data Preview */}
        {currentTable && currentTable.sampleData.length > 0 && (
          <div className="space-y-2">
            <Label>Preview dos Dados</Label>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      {currentTable.columns.slice(0, 6).map(col => (
                        <TableHead key={col.name} className="text-xs">
                          <div className="flex items-center gap-1">
                            {col.name}
                            <Badge variant="outline" className="text-[10px] px-1">
                              {col.type}
                            </Badge>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentTable.sampleData.slice(0, 3).map((row, i) => (
                      <TableRow key={i}>
                        {currentTable.columns.slice(0, 6).map(col => (
                          <TableCell key={col.name} className="text-sm">
                            {String(row[col.name] ?? '-')}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        )}

        {/* Mappings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Mapeamentos ({mappings.length})</Label>
            <Button variant="outline" size="sm" onClick={addMapping}>
              <Plus className="w-4 h-4 mr-1" />
              Adicionar Mapeamento
            </Button>
          </div>

          {mappings.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground mb-4">
                Nenhum mapeamento configurado ainda.
              </p>
              <div className="flex justify-center gap-3">
                <Button onClick={addMapping} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Manualmente
                </Button>
                <Button onClick={fetchAIMappings} disabled={isLoadingAI || tables.length === 0}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Usar IA
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {mappings.map((mapping) => (
                <Card key={mapping.id} className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Source Field */}
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Campo Origem</Label>
                      <Select
                        value={mapping.sourceField}
                        onValueChange={(value) => updateMapping(mapping.id, { sourceField: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o campo" />
                        </SelectTrigger>
                        <SelectContent>
                          {columns.map(col => (
                            <SelectItem key={col.name} value={col.name}>
                              <div className="flex items-center gap-2">
                                <span>{col.name}</span>
                                <Badge variant="outline" className="text-[10px]">
                                  {col.type}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {mapping.sourceField && (
                        <div className="flex gap-1 mt-1">
                          {getSampleValues(mapping.sourceField).slice(0, 2).map((val, i) => (
                            <span key={i} className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {String(val)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />

                    {/* Transformation */}
                    <div className="w-32 space-y-1">
                      <Label className="text-xs text-muted-foreground">Transformação</Label>
                      <Select
                        value={mapping.transformation}
                        onValueChange={(value) => updateMapping(mapping.id, { transformation: value as TransformationType })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TRANSFORMATIONS.map(t => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />

                    {/* Target Metric with Custom Input */}
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Métrica Destino</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between font-normal"
                          >
                            {TARGET_METRICS.find(m => m.value === mapping.targetMetric)?.label || mapping.targetMetric || 'Selecione...'}
                            <PenLine className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[280px] p-0" align="start">
                          <div className="p-2 border-b">
                            <Input
                              placeholder="Digite uma métrica customizada..."
                              value={mapping.targetMetric}
                              onChange={(e) => updateMapping(mapping.id, { targetMetric: e.target.value })}
                              className="h-8"
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Escreva seu próprio nome ou selecione abaixo
                            </p>
                          </div>
                          <div className="max-h-[200px] overflow-y-auto p-1">
                            {TARGET_METRICS.map(m => (
                              <button
                                key={m.value}
                                onClick={() => updateMapping(mapping.id, { targetMetric: m.value })}
                                className={cn(
                                  "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors text-left",
                                  mapping.targetMetric === m.value && "bg-accent/10"
                                )}
                              >
                                {mapping.targetMetric === m.value && (
                                  <Check className="w-3 h-3 text-accent" />
                                )}
                                <span className={cn(mapping.targetMetric !== m.value && "ml-5")}>{m.label}</span>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3 h-3 text-muted-foreground ml-auto" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right">
                                    <p className="text-xs max-w-[200px]">{m.description}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Delete Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMapping(mapping.id)}
                      className="text-destructive hover:text-destructive shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Tip */}
        <div className="p-4 bg-accent/5 rounded-lg border border-accent/20">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Dica</p>
              <p className="text-sm text-muted-foreground">
                Mapeie pelo menos 2 campos para gerar um dashboard básico. Quanto mais campos mapeados,
                mais completo será o dashboard gerado.
              </p>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default MappingStep;
