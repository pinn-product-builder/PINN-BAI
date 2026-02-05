import { useState, useCallback, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { Plus, Trash2, ArrowRight, Info, PenLine, Check, Wand2, Loader2, Sparkles, CheckCircle2, X, RotateCcw, History, Bot, Pencil, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSavedMetrics } from '@/hooks/useSavedMetrics';
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

type SuggestionState = 'pending' | 'accepted' | 'rejected';

type TransformationType = 'none' | 'date' | 'number' | 'currency' | 'percentage' | 'text' | 'boolean';

interface MappingStepProps {
  integration: DataIntegration | null;
  mappings: DataMapping[];
  onUpdate: (mappings: DataMapping[]) => void;
  onPrimaryTableChange?: (tableName: string) => void;
  orgId?: string;
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
  { value: 'mensagens', label: 'Mensagens', description: 'Total de mensagens enviadas/recebidas' },
  { value: 'reuniões_agendadas', label: 'Reuniões Agendadas', description: 'Total de reuniões agendadas' },
  { value: 'reuniões_canceladas', label: 'Reuniões Canceladas', description: 'Total de reuniões canceladas' },
  { value: 'investimento', label: 'Investimento', description: 'Valor investido em marketing' },
  { value: 'cpl', label: 'CPL (Custo por Lead)', description: 'Custo médio por lead adquirido' },
  { value: 'cpm', label: 'CPM (Custo por Reunião)', description: 'Custo médio por reunião agendada' },
];

const MappingStep = ({ integration, mappings, onUpdate, onPrimaryTableChange, orgId }: MappingStepProps) => {
  const { toast } = useToast();
  const [selectedTable, setSelectedTable] = useState<string>(
    integration?.tables?.[0]?.name || ''
  );
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<MappingSuggestion[]>([]);
  const [aiSummary, setAiSummary] = useState('');
  const [aiMethod, setAiMethod] = useState<'ai' | 'heuristic'>('ai');
  const [hasAutoMapped, setHasAutoMapped] = useState(false);
  
  // Tab state - default to AI mapping
  const [activeTab, setActiveTab] = useState<'ai' | 'manual'>('ai');
  
  // Individual suggestion states
  const [suggestionStates, setSuggestionStates] = useState<Record<number, SuggestionState>>({});
  
  // Saved metrics hook
  const { savedMetrics, saveMetric, incrementUsage } = useSavedMetrics(orgId || null);

  const tables = integration?.tables || [];
  const currentTable = tables.find(t => t.name === selectedTable);
  const columns = currentTable?.columns || [];

  // Derived counters for suggestions
  const suggestionCounts = useMemo(() => {
    const states = Object.values(suggestionStates);
    return {
      accepted: states.filter(s => s === 'accepted').length,
      rejected: states.filter(s => s === 'rejected').length,
      pending: aiSuggestions.length - states.filter(s => s === 'accepted' || s === 'rejected').length,
    };
  }, [suggestionStates, aiSuggestions.length]);

  // Notify parent of primary table changes
  const handleTableChange = (tableName: string) => {
    setSelectedTable(tableName);
    onPrimaryTableChange?.(tableName);
  };

  // Toggle suggestion state
  const toggleSuggestion = useCallback((index: number, state: SuggestionState) => {
    setSuggestionStates(prev => ({
      ...prev,
      [index]: prev[index] === state ? 'pending' : state,
    }));
  }, []);

  // Accept all suggestions
  const acceptAllSuggestions = useCallback(() => {
    const newStates: Record<number, SuggestionState> = {};
    aiSuggestions.forEach((_, idx) => {
      newStates[idx] = 'accepted';
    });
    setSuggestionStates(newStates);
  }, [aiSuggestions]);

  // Reset all suggestion states
  const resetSuggestionStates = useCallback(() => {
    setSuggestionStates({});
  }, []);

  // Fetch AI mapping suggestions
  const fetchAIMappings = useCallback(async (autoApply: boolean = false) => {
    if (tables.length === 0) return;
    
    setIsLoadingAI(true);
    setSuggestionStates({});
    
    try {
      // Prepare comprehensive data for AI analysis
      const tablesData = tables.map(t => ({
        name: t.name,
        rowCount: t.rowCount,
        columns: t.columns.map(c => ({ 
          name: c.name, 
          type: c.type,
          // Send maximum samples for deep analysis (15-20 values)
          sampleValues: c.sampleValues?.slice(0, 20) || [],
        })),
        // Send more sample rows for better context understanding (10 rows)
        sampleData: t.sampleData?.slice(0, 10) || [],
      }));

      const { data, error } = await supabase.functions.invoke('suggest-mappings', {
        body: { tables: tablesData },
      });

      if (error) throw error;

      if (data?.suggestions && data.suggestions.length > 0) {
        // Validate suggestions before using them
        const validSuggestions = data.suggestions.filter((s: MappingSuggestion) => {
          // Check if source table exists
          const tableExists = tables.some(t => t.name === s.sourceTable);
          if (!tableExists) {
            console.warn(`Table ${s.sourceTable} not found for suggestion`, s);
            return false;
          }
          
          // Check if source field exists in the table
          const table = tables.find(t => t.name === s.sourceTable);
          if (table) {
            const fieldExists = table.columns.some(c => c.name === s.sourceField);
            if (!fieldExists) {
              console.warn(`Field ${s.sourceField} not found in table ${s.sourceTable}`, s);
              return false;
            }
          }
          
          return true;
        });
        
        if (validSuggestions.length === 0) {
          toast({
            title: 'Nenhuma sugestão válida',
            description: 'As sugestões da IA não correspondem às tabelas disponíveis.',
            variant: 'destructive',
          });
          setActiveTab('manual');
          return;
        }
        
        setAiSuggestions(validSuggestions);
        setAiSummary(data.summary || '');
        setAiMethod(data.method || 'ai');
        
        // Update primary table if AI suggests one
        if (data.primaryTable && data.primaryTable !== selectedTable) {
          const primaryTableExists = tables.some(t => t.name === data.primaryTable);
          if (primaryTableExists) {
            handleTableChange(data.primaryTable);
          }
        }
        
        // Auto-accept all valid suggestions
        const newStates: Record<number, SuggestionState> = {};
        validSuggestions.forEach((_: MappingSuggestion, idx: number) => {
          newStates[idx] = 'accepted';
        });
        setSuggestionStates(newStates);
        
        // If auto-apply, create mappings immediately with aggregation
        if (autoApply) {
          const autoMappings: DataMapping[] = validSuggestions.map((suggestion: MappingSuggestion, idx: number) => {
            // Determine aggregation based on metric type
            let aggregation = 'count';
            if (['revenue', 'mrr', 'investimento', 'cpl', 'cpm', 'ltv', 'cac', 'avg_ticket'].includes(suggestion.targetMetric)) {
              aggregation = 'sum';
            } else if (['conversion_rate', 'growth_rate', 'ctr'].includes(suggestion.targetMetric)) {
              aggregation = 'avg';
            } else if (suggestion.targetMetric.includes('_rate') || suggestion.targetMetric.includes('taxa')) {
              aggregation = 'avg';
            } else if (['total_leads', 'new_leads', 'conversions', 'active_users', 'mensagens', 'reuniões'].includes(suggestion.targetMetric)) {
              aggregation = 'count';
            }
            
            return {
              id: `mapping-ai-${Date.now()}-${idx}`,
              sourceField: suggestion.sourceField,
              sourceTable: suggestion.sourceTable,
              targetMetric: suggestion.targetMetric,
              transformation: suggestion.transformation,
              aggregation,
            };
          });
          onUpdate(autoMappings);
          
          toast({
            title: 'Dashboard configurado automaticamente!',
            description: `IA analisou ${tables.length} tabelas e criou ${validSuggestions.length} mapeamentos válidos. Você pode editar na aba "Manual".`,
          });
        } else {
          toast({
            title: 'Mapeamentos sugeridos!',
            description: `IA analisou ${tables.length} tabelas e sugeriu ${validSuggestions.length} mapeamentos válidos. Revise e aceite os que desejar.`,
          });
        }
      } else {
        toast({
          title: 'Sem sugestões',
          description: 'Não foi possível identificar mapeamentos automáticos. Configure manualmente.',
          variant: 'destructive',
        });
        setActiveTab('manual');
      }
    } catch (error) {
      console.error('AI mappings error:', error);
      toast({
        title: 'Erro ao gerar mapeamentos',
        description: 'Não foi possível analisar as tabelas com IA.',
        variant: 'destructive',
      });
      setActiveTab('manual');
    } finally {
      setIsLoadingAI(false);
      setHasAutoMapped(true);
    }
  }, [tables, selectedTable, toast, onUpdate]);

  // Auto-run AI mapping when component loads (only once)
  useEffect(() => {
    if (tables.length > 0 && !hasAutoMapped && !isLoadingAI && mappings.length === 0) {
      fetchAIMappings(true);
    }
  }, [tables.length, hasAutoMapped, isLoadingAI, mappings.length, fetchAIMappings]);

  // Apply accepted AI suggestions only
  const applyAcceptedSuggestions = useCallback(() => {
    const acceptedMappings: DataMapping[] = aiSuggestions
      .filter((_, idx) => suggestionStates[idx] === 'accepted')
      .map((suggestion, idx) => {
        // Determine aggregation based on metric type
        let aggregation = 'count';
        if (['revenue', 'mrr', 'investimento', 'cpl', 'cpm', 'ltv', 'cac', 'avg_ticket'].includes(suggestion.targetMetric)) {
          aggregation = 'sum';
        } else if (['conversion_rate', 'growth_rate', 'ctr'].includes(suggestion.targetMetric)) {
          aggregation = 'avg';
        } else if (suggestion.targetMetric.includes('_rate') || suggestion.targetMetric.includes('taxa')) {
          aggregation = 'avg';
        } else if (['total_leads', 'new_leads', 'conversions', 'active_users', 'mensagens', 'reuniões'].includes(suggestion.targetMetric)) {
          aggregation = 'count';
        }
        
        return {
          id: `mapping-ai-${Date.now()}-${idx}`,
          sourceField: suggestion.sourceField,
          sourceTable: suggestion.sourceTable,
          targetMetric: suggestion.targetMetric,
          transformation: suggestion.transformation,
          aggregation,
        };
      });

    if (acceptedMappings.length === 0) {
      toast({
        title: 'Nenhuma sugestão aceita',
        description: 'Aceite pelo menos uma sugestão para aplicar.',
        variant: 'destructive',
      });
      return;
    }

    onUpdate([...mappings, ...acceptedMappings]);
    
    toast({
      title: 'Mapeamentos aplicados!',
      description: `${acceptedMappings.length} mapeamentos configurados. Você pode ajustá-los na aba Manual.`,
    });
  }, [aiSuggestions, suggestionStates, mappings, onUpdate, toast]);

  // Replace mappings with accepted suggestions
  const replaceWithAcceptedSuggestions = useCallback(() => {
    const acceptedMappings: DataMapping[] = aiSuggestions
      .filter((_, idx) => suggestionStates[idx] === 'accepted')
      .map((suggestion, idx) => {
        // Determine aggregation based on metric type
        let aggregation = 'count';
        if (['revenue', 'mrr', 'investimento', 'cpl', 'cpm', 'ltv', 'cac', 'avg_ticket'].includes(suggestion.targetMetric)) {
          aggregation = 'sum';
        } else if (['conversion_rate', 'growth_rate', 'ctr'].includes(suggestion.targetMetric)) {
          aggregation = 'avg';
        } else if (suggestion.targetMetric.includes('_rate') || suggestion.targetMetric.includes('taxa')) {
          aggregation = 'avg';
        } else if (['total_leads', 'new_leads', 'conversions', 'active_users', 'mensagens', 'reuniões'].includes(suggestion.targetMetric)) {
          aggregation = 'count';
        }
        
        return {
          id: `mapping-ai-${Date.now()}-${idx}`,
          sourceField: suggestion.sourceField,
          sourceTable: suggestion.sourceTable,
          targetMetric: suggestion.targetMetric,
          transformation: suggestion.transformation,
          aggregation,
        };
      });

    if (acceptedMappings.length === 0) {
      toast({
        title: 'Nenhuma sugestão aceita',
        description: 'Aceite pelo menos uma sugestão para aplicar.',
        variant: 'destructive',
      });
      return;
    }

    onUpdate(acceptedMappings);
    
    toast({
      title: 'Mapeamentos substituídos!',
      description: `${acceptedMappings.length} mapeamentos configurados. Você pode ajustá-los na aba Manual.`,
    });
  }, [aiSuggestions, suggestionStates, onUpdate, toast]);

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

  // Save custom metric when user types a non-predefined metric
  const handleMetricChange = useCallback((mappingId: string, metricValue: string) => {
    updateMapping(mappingId, { targetMetric: metricValue });
    
    // Check if it's a custom metric (not in predefined list)
    const isPredefined = TARGET_METRICS.some(m => m.value === metricValue);
    if (!isPredefined && metricValue.trim().length >= 3 && orgId) {
      // Save custom metric for future use
      saveMetric({
        orgId,
        metricName: metricValue.toLowerCase().replace(/\s+/g, '_'),
        displayLabel: metricValue,
      });
    }
  }, [orgId, saveMetric]);

  const handleSavedMetricSelect = useCallback((mappingId: string, metric: { id: string; metric_name: string }) => {
    updateMapping(mappingId, { targetMetric: metric.metric_name });
    incrementUsage(metric.id);
  }, [incrementUsage]);

  const removeMapping = (id: string) => {
    onUpdate(mappings.filter(m => m.id !== id));
  };

  const getSampleValues = (columnName: string): unknown[] => {
    const column = columns.find(c => c.name === columnName);
    return column?.sampleValues || [];
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600 bg-green-500/20 border-green-500/40 font-semibold';
    if (confidence >= 80) return 'text-blue-600 bg-blue-500/20 border-blue-500/40 font-semibold';
    if (confidence >= 75) return 'text-amber-600 bg-amber-500/20 border-amber-500/40';
    return 'text-muted-foreground bg-muted/50 border-muted';
  };

  const getSuggestionStateStyle = (idx: number) => {
    const state = suggestionStates[idx];
    if (state === 'accepted') return 'border-green-500/50 bg-green-500/5';
    if (state === 'rejected') return 'opacity-40 bg-muted/30 line-through';
    return 'bg-background/50';
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Mapeamento de Dados
          </h2>
          <p className="text-muted-foreground">
            A IA analisa suas tabelas e configura o dashboard automaticamente
          </p>
        </div>

        {/* Tabs for AI vs Manual */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'ai' | 'manual')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ai" className="gap-2">
              <Bot className="w-4 h-4" />
              Mapeamento IA
              {mappings.length > 0 && (
                <Badge variant="secondary" className="ml-1">{mappings.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <Pencil className="w-4 h-4" />
              Edição Manual
              {mappings.length > 0 && (
                <Badge variant="outline" className="ml-1">{mappings.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* AI Mapping Tab */}
          <TabsContent value="ai" className="mt-4 space-y-4">
            {/* Status Card */}
            <Card className="p-5 border-accent/30 bg-gradient-to-br from-accent/5 via-accent/3 to-transparent">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="p-3 rounded-xl bg-accent/20 shadow-lg shadow-accent/10">
                    {isLoadingAI ? (
                      <Loader2 className="w-6 h-6 text-accent animate-spin" />
                    ) : (
                      <Wand2 className="w-6 h-6 text-accent" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">
                        {isLoadingAI ? 'Analisando tabelas com IA...' : 'Mapeamento Automático com IA'}
                      </h3>
                      {aiSuggestions.length > 0 && (
                        <Badge variant="outline" className="text-xs border-accent/30 bg-accent/10">
                          {aiMethod === 'ai' ? 'Gemini AI' : 'Heurística'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {isLoadingAI 
                        ? 'A IA está analisando o esquema, tipos de dados e valores de amostra para criar o melhor mapeamento possível'
                        : aiSuggestions.length > 0 
                          ? aiSummary || `${aiSuggestions.length} mapeamentos inteligentes identificados automaticamente`
                          : 'Clique no botão para a IA analisar suas tabelas e gerar mapeamentos automaticamente'}
                    </p>
                    {aiSuggestions.length > 0 && (
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Database className="w-3 h-3" />
                          {tables.length} {tables.length === 1 ? 'tabela' : 'tabelas'} analisadas
                        </span>
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          {aiSuggestions.length} {aiSuggestions.length === 1 ? 'sugestão' : 'sugestões'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                {!isLoadingAI && (
                  <Button
                    onClick={() => fetchAIMappings(false)}
                    variant="outline"
                    className="gap-2 shrink-0 border-accent/30 hover:bg-accent/10"
                  >
                    <Sparkles className="w-4 h-4" />
                    {aiSuggestions.length > 0 ? 'Regerar' : 'Gerar Mapeamentos'}
                  </Button>
                )}
              </div>
            </Card>

            {/* AI Suggestions List */}
            {aiSuggestions.length > 0 && (
              <Card className="p-5 border-2 border-accent/20">
                {/* Header with counters */}
                <div className="flex items-center justify-between flex-wrap gap-4 mb-5 pb-4 border-b">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-accent/10">
                      <Sparkles className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Sugestões da IA</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Revise e aceite as sugestões mais relevantes
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs border-accent/30 bg-accent/10">
                      {aiMethod === 'ai' ? 'Gemini AI' : 'Análise Heurística'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 font-medium">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {suggestionCounts.accepted} aceitas
                    </Badge>
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                      <X className="w-3 h-3 mr-1" />
                      {suggestionCounts.rejected} rejeitadas
                    </Badge>
                    <Badge variant="outline" className="bg-muted text-muted-foreground">
                      {suggestionCounts.pending} pendentes
                    </Badge>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 pb-4 mb-4 border-b">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={acceptAllSuggestions}
                    className="gap-2 border-green-500/30 hover:bg-green-500/10 hover:border-green-500/50"
                    disabled={aiSuggestions.length === 0}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Aceitar Todas ({aiSuggestions.length})
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={resetSuggestionStates}
                    className="gap-2"
                    disabled={Object.keys(suggestionStates).length === 0}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Limpar Seleções
                  </Button>
                  <div className="flex-1" />
                  <div className="text-xs text-muted-foreground self-center">
                    Ordenado por confiança (maior primeiro)
                  </div>
                </div>

                {/* Scrollable Suggestions List */}
                <ScrollArea className="h-[500px] pr-3">
                  <div className="space-y-3">
                    {[...aiSuggestions]
                      .map((suggestion, originalIdx) => ({ ...suggestion, originalIdx }))
                      .sort((a, b) => b.confidence - a.confidence)
                      .map((suggestion) => {
                        const idx = suggestion.originalIdx;
                        const state = suggestionStates[idx];
                        const isAccepted = state === 'accepted';
                        const isRejected = state === 'rejected';
                        
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "flex items-start gap-3 p-4 rounded-lg border transition-all hover:shadow-md",
                              isAccepted && "border-green-500/50 bg-green-500/5 ring-2 ring-green-500/20",
                              isRejected && "opacity-50 bg-muted/30 border-muted",
                              !isAccepted && !isRejected && "bg-background/50 border-border hover:border-accent/30"
                            )}
                          >
                            {/* Confidence Badge */}
                            <div className="flex flex-col items-center gap-2 shrink-0">
                              <Badge className={cn("text-xs font-mono px-2 py-1", getConfidenceColor(suggestion.confidence))}>
                                {suggestion.confidence}%
                              </Badge>
                              {isAccepted && (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              )}
                              {isRejected && (
                                <X className="w-4 h-4 text-destructive" />
                              )}
                            </div>
                            
                            {/* Mapping Info */}
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-center gap-2 text-sm flex-wrap">
                                <div className="flex items-center gap-1.5">
                                  <code className="px-2 py-1 bg-muted rounded text-xs font-mono border border-border">
                                    {suggestion.sourceTable}
                                  </code>
                                  <span className="text-muted-foreground">.</span>
                                  <code className="px-2 py-1 bg-muted rounded text-xs font-mono border border-border">
                                    {suggestion.sourceField}
                                  </code>
                                </div>
                                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-foreground">
                                    {TARGET_METRICS.find(m => m.value === suggestion.targetMetric)?.label || suggestion.targetMetric}
                                  </span>
                                  {!TARGET_METRICS.find(m => m.value === suggestion.targetMetric) && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-accent/30 bg-accent/5">
                                      Custom
                                    </Badge>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-[10px] shrink-0 border-accent/30">
                                  {TRANSFORMATIONS.find(t => t.value === suggestion.transformation)?.label || suggestion.transformation}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {suggestion.reason}
                              </p>
                            </div>

                            {/* Accept/Reject Buttons */}
                            <div className="flex gap-1 shrink-0">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant={isAccepted ? 'default' : 'ghost'}
                                    className={cn(
                                      "h-9 w-9",
                                      isAccepted && "bg-green-500 hover:bg-green-600 text-white"
                                    )}
                                    onClick={() => toggleSuggestion(idx, 'accepted')}
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Aceitar sugestão</TooltipContent>
                              </Tooltip>
                              
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant={isRejected ? 'destructive' : 'ghost'}
                                    className="h-9 w-9"
                                    onClick={() => toggleSuggestion(idx, 'rejected')}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Rejeitar sugestão</TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </ScrollArea>

                {/* Apply Button */}
                <div className="flex justify-between gap-2 pt-3 border-t mt-3">
                  <p className="text-xs text-muted-foreground self-center">
                    {mappings.length > 0 
                      ? `${mappings.length} mapeamentos ativos` 
                      : 'Nenhum mapeamento aplicado ainda'}
                  </p>
                  <div className="flex gap-2">
                    {mappings.length > 0 && (
                      <Button 
                        variant="outline"
                        onClick={replaceWithAcceptedSuggestions}
                        disabled={suggestionCounts.accepted === 0}
                        className="gap-2"
                      >
                        Substituir Todos
                      </Button>
                    )}
                    <Button 
                      onClick={applyAcceptedSuggestions}
                      disabled={suggestionCounts.accepted === 0}
                      className="gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Aplicar {suggestionCounts.accepted > 0 ? suggestionCounts.accepted : ''} Selecionados
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Loading state */}
            {isLoadingAI && (
              <Card className="p-8">
                <div className="flex flex-col items-center justify-center gap-4 text-center">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-accent animate-spin" />
                    </div>
                    <Sparkles className="w-5 h-5 text-accent absolute -top-1 -right-1 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">A IA está analisando suas tabelas</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Identificando métricas, tipos de dados e melhores mapeamentos...
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Empty state */}
            {!isLoadingAI && aiSuggestions.length === 0 && hasAutoMapped && (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground mb-4">
                  Não foi possível gerar mapeamentos automáticos.
                </p>
                <div className="flex justify-center gap-3">
                  <Button onClick={() => fetchAIMappings(false)} variant="outline">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Tentar Novamente
                  </Button>
                  <Button onClick={() => setActiveTab('manual')}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Configurar Manualmente
                  </Button>
                </div>
              </Card>
            )}

            {/* Info */}
            <Alert className="bg-muted/30 border-muted">
              <Info className="w-4 h-4" />
              <AlertTitle className="text-sm">Como funciona?</AlertTitle>
              <AlertDescription className="text-xs">
                A IA analisa automaticamente suas tabelas e cria mapeamentos inteligentes. 
                Use ✓ para aceitar ou ✗ para rejeitar cada sugestão. 
                Após revisar, clique em "Aplicar Selecionados" para confirmar.
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* Manual Mapping Tab */}
          <TabsContent value="manual" className="mt-4 space-y-4">
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
                    <Button onClick={() => {
                      setActiveTab('ai');
                      if (aiSuggestions.length === 0) {
                        fetchAIMappings(false);
                      }
                    }}>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Usar IA
                    </Button>
                  </div>
                </Card>
              ) : (
                <ScrollArea className="h-[400px] pr-2">
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

                          {/* Target Metric with Custom Input + Saved Metrics */}
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
                                    onChange={(e) => handleMetricChange(mapping.id, e.target.value)}
                                    className="h-8"
                                  />
                                  <p className="text-[10px] text-muted-foreground mt-1">
                                    Escreva seu próprio nome ou selecione abaixo
                                  </p>
                                </div>
                                
                                {/* Saved/Recent Metrics */}
                                {savedMetrics.length > 0 && (
                                  <div className="border-b">
                                    <p className="text-xs text-muted-foreground px-2 py-1.5 flex items-center gap-1">
                                      <History className="w-3 h-3" />
                                      Métricas Recentes
                                    </p>
                                    <div className="max-h-[120px] overflow-y-auto">
                                      {savedMetrics.slice(0, 5).map(m => (
                                        <button
                                          key={m.id}
                                          onClick={() => handleSavedMetricSelect(mapping.id, { id: m.id, metric_name: m.metric_name })}
                                          className={cn(
                                            "flex items-center justify-between w-full px-2 py-1.5 text-sm hover:bg-muted transition-colors text-left",
                                            mapping.targetMetric === m.metric_name && "bg-accent/10"
                                          )}
                                        >
                                          <span className="truncate">{m.display_label}</span>
                                          <Badge variant="outline" className="text-[10px] ml-2 shrink-0">
                                            {m.usage_count}x
                                          </Badge>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Predefined Metrics */}
                                <div className="max-h-[200px] overflow-y-auto p-1">
                                  <p className="text-xs text-muted-foreground px-2 py-1">Métricas Padrão</p>
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
                </ScrollArea>
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
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
};

export default MappingStep;
