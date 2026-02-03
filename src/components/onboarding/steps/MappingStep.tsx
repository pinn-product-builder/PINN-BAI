import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
import { Plus, Trash2, ArrowRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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

type TransformationType = 'none' | 'date' | 'number' | 'currency' | 'percentage' | 'text' | 'boolean';

interface MappingStepProps {
  integration: DataIntegration | null;
  mappings: DataMapping[];
  onUpdate: (mappings: DataMapping[]) => void;
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

const MappingStep = ({ integration, mappings, onUpdate }: MappingStepProps) => {
  const [selectedTable, setSelectedTable] = useState<string>(
    integration?.tables?.[0]?.name || ''
  );

  const tables = integration?.tables || [];
  const currentTable = tables.find(t => t.name === selectedTable);
  const columns = currentTable?.columns || [];

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

  const getColumnType = (columnName: string): string => {
    const column = columns.find(c => c.name === columnName);
    return column?.type || 'unknown';
  };

  const getSampleValues = (columnName: string): unknown[] => {
    const column = columns.find(c => c.name === columnName);
    return column?.sampleValues || [];
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Mapeamento de Dados
        </h2>
        <p className="text-muted-foreground">
          Conecte os campos da sua fonte de dados às métricas do dashboard
        </p>
      </div>

      {/* Table Selection */}
      {tables.length > 0 && (
        <div className="space-y-2">
          <Label>Tabela de Origem</Label>
          <Select value={selectedTable} onValueChange={setSelectedTable}>
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
            <Button onClick={addMapping} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeiro Mapeamento
            </Button>
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

                  {/* Target Metric */}
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">Métrica Destino</Label>
                    <Select
                      value={mapping.targetMetric}
                      onValueChange={(value) => updateMapping(mapping.id, { targetMetric: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TARGET_METRICS.map(m => (
                          <SelectItem key={m.value} value={m.value}>
                            <div className="flex items-center gap-2">
                              <span>{m.label}</span>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="w-3 h-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">{m.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
  );
};

export default MappingStep;
