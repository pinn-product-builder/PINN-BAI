import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, FileSpreadsheet, FileUp, Globe, Check, AlertCircle, Loader2, ArrowRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { IntegrationType, DetectedTable, ConnectionTestResult, SupabaseConfig, GoogleSheetsConfig, CsvConfig, ApiConfig } from '@/lib/types';

import SupabaseIntegration from '../integrations/SupabaseIntegration';
import GoogleSheetsIntegration from '../integrations/GoogleSheetsIntegration';
import CsvUploadIntegration from '../integrations/CsvUploadIntegration';
import ApiIntegration from '../integrations/ApiIntegration';
import TableSelection, { type SelectedTableConfig } from '../TableSelection';

// Union type for all config types
type IntegrationConfig = SupabaseConfig | GoogleSheetsConfig | CsvConfig | ApiConfig;

// Local interface for wizard state (different from database types)
export interface DataIntegration {
  id: string;
  type: IntegrationType;
  name: string;
  config: IntegrationConfig;
  status: 'pending' | 'connected' | 'error' | 'syncing';
  lastSync?: string;
  tables?: DetectedTable[];
  selectedTables?: SelectedTableConfig[];
}

interface IntegrationStepProps {
  integration: DataIntegration | null;
  onUpdate: (integration: DataIntegration | null) => void;
}

const INTEGRATION_TYPES = [
  {
    type: 'supabase' as IntegrationType,
    name: 'Supabase',
    description: 'Banco de dados PostgreSQL',
    icon: Database,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
  {
    type: 'google_sheets' as IntegrationType,
    name: 'Google Sheets',
    description: 'Planilha do Google',
    icon: FileSpreadsheet,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  {
    type: 'csv' as IntegrationType,
    name: 'Upload CSV',
    description: 'Arquivo local',
    icon: FileUp,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    type: 'api' as IntegrationType,
    name: 'API Externa',
    description: 'REST API endpoint',
    icon: Globe,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
];

type IntegrationPhase = 'select-type' | 'configure' | 'select-tables';

const IntegrationStep = ({ integration, onUpdate }: IntegrationStepProps) => {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<IntegrationType | null>(
    integration?.type || null
  );
  const [phase, setPhase] = useState<IntegrationPhase>(
    integration?.status === 'connected' ? 'select-tables' : 'select-type'
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [detectedTables, setDetectedTables] = useState<DetectedTable[]>(
    integration?.tables || []
  );
  const [selectedTables, setSelectedTables] = useState<SelectedTableConfig[]>(
    integration?.selectedTables || []
  );

  const handleConnect = async (config: IntegrationConfig) => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      let result: ConnectionTestResult;

      if (selectedType === 'supabase') {
        // Call the test-supabase-connection edge function
        const supabaseConfig = config as SupabaseConfig;
        const { data, error } = await supabase.functions.invoke('test-supabase-connection', {
          body: {
            projectUrl: supabaseConfig.projectUrl,
            anonKey: supabaseConfig.anonKey,
          },
        });

        if (error) throw new Error(error.message);
        result = data as ConnectionTestResult;
      } else if (selectedType === 'google_sheets') {
        // Call the fetch-google-sheets edge function
        const sheetsConfig = config as GoogleSheetsConfig;
        const { data, error } = await supabase.functions.invoke('fetch-google-sheets', {
          body: {
            spreadsheetUrl: sheetsConfig.spreadsheetUrl,
            sheetName: sheetsConfig.sheetName,
          },
        });

        if (error) throw new Error(error.message);
        
        // Transform Google Sheets response to tables format
        const sheetsData = data as { 
          success: boolean; 
          columns: { name: string; type: string; nullable: boolean; sampleValues: unknown[] }[];
          rows: Record<string, unknown>[];
          sheetName: string;
          error?: string;
        };
        
        if (!sheetsData.success) {
          throw new Error(sheetsData.error || 'Falha ao conectar ao Google Sheets');
        }

        result = {
          success: true,
          tables: [{
            name: sheetsData.sheetName || 'Sheet1',
            columns: sheetsData.columns.map(col => ({
              name: col.name,
              type: col.type as 'string' | 'number' | 'date' | 'boolean' | 'unknown',
              nullable: col.nullable,
              sampleValues: col.sampleValues,
            })),
            rowCount: sheetsData.rows.length,
            sampleData: sheetsData.rows.slice(0, 3),
          }],
        };
      } else if (selectedType === 'api') {
        // Call the sync-external-api edge function
        const apiConfig = config as ApiConfig;
        const { data, error } = await supabase.functions.invoke('sync-external-api', {
          body: {
            baseUrl: apiConfig.baseUrl,
            endpoint: apiConfig.endpoint,
            method: apiConfig.method || 'GET',
            authType: apiConfig.authType,
            authValue: apiConfig.authValue,
            headers: apiConfig.headers,
          },
        });

        if (error) throw new Error(error.message);
        
        const apiData = data as { 
          success: boolean; 
          data: Record<string, unknown>[];
          columns: { name: string; type: string; nullable: boolean; sampleValues: unknown[] }[];
          rowCount: number;
          error?: string;
        };
        
        if (!apiData.success) {
          throw new Error(apiData.error || 'Falha ao conectar à API');
        }

        result = {
          success: true,
          tables: [{
            name: 'api_data',
            columns: apiData.columns.map(col => ({
              name: col.name,
              type: col.type as 'string' | 'number' | 'date' | 'boolean' | 'unknown',
              nullable: col.nullable,
              sampleValues: col.sampleValues,
            })),
            rowCount: apiData.rowCount,
            sampleData: apiData.data.slice(0, 3),
          }],
        };
      } else if (selectedType === 'csv') {
        const csvConfig = config as CsvConfig;
        // For CSV, we simulate the detection based on the uploaded file
        // In a real scenario, this would parse the CSV and detect columns
        result = {
          success: true,
          tables: [{
            name: csvConfig.fileName?.replace('.csv', '') || 'csv_data',
            columns: [
              { name: 'id', type: 'number', nullable: false, sampleValues: ['1', '2', '3'] },
              { name: 'name', type: 'string', nullable: false, sampleValues: ['Item 1', 'Item 2', 'Item 3'] },
              { name: 'value', type: 'number', nullable: true, sampleValues: ['100', '200', '300'] },
              { name: 'date', type: 'date', nullable: true, sampleValues: ['2024-01-01', '2024-02-01', '2024-03-01'] },
            ],
            rowCount: 100, // Would be calculated from actual file
            sampleData: [
              { id: 1, name: 'Item 1', value: 100, date: '2024-01-01' },
              { id: 2, name: 'Item 2', value: 200, date: '2024-02-01' },
            ],
          }],
        };
      } else {
        throw new Error('Tipo de integração não suportado');
      }

      if (!result.success) {
        throw new Error(result.error || 'Falha na conexão');
      }

      // Connection successful, move to table selection
      setDetectedTables(result.tables || []);
      
      // Auto-select all tables with all columns by default
      const autoSelected: SelectedTableConfig[] = (result.tables || []).map((table, index) => ({
        tableName: table.name,
        selectedColumns: table.columns.map(c => c.name),
        isPrimary: index === 0,
        rowCount: table.rowCount,
        columnTypes: table.columns.reduce((acc, col) => ({ ...acc, [col.name]: col.type }), {}),
        sampleData: table.sampleData,
      }));
      setSelectedTables(autoSelected);

      // Update integration state
      const newIntegration: DataIntegration = {
        id: `integration-${Date.now()}`,
        type: selectedType!,
        name: INTEGRATION_TYPES.find(t => t.type === selectedType)?.name || '',
        config,
        status: 'connected',
        lastSync: new Date().toISOString(),
        tables: result.tables,
        selectedTables: autoSelected,
      };

      onUpdate(newIntegration);
      setPhase('select-tables');

      toast({
        title: 'Conexão estabelecida!',
        description: `${result.tables?.length || 0} tabela(s) detectada(s).`,
      });

    } catch (error) {
      console.error('Connection error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setConnectionError(errorMessage);
      toast({
        title: 'Erro na conexão',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleTableSelectionChange = (selected: SelectedTableConfig[]) => {
    setSelectedTables(selected);
    
    // Update the integration with new selection
    if (integration) {
      onUpdate({
        ...integration,
        selectedTables: selected,
      });
    }
  };

  const handleDisconnect = () => {
    onUpdate(null);
    setSelectedType(null);
    setPhase('select-type');
    setDetectedTables([]);
    setSelectedTables([]);
    setConnectionError(null);
  };

  const handleRetry = () => {
    setConnectionError(null);
  };

  const renderIntegrationForm = () => {
    if (!selectedType) return null;

    const commonProps = {
      onConnect: handleConnect,
      isConnecting,
    };

    switch (selectedType) {
      case 'supabase':
        return <SupabaseIntegration {...commonProps} />;
      case 'google_sheets':
        return <GoogleSheetsIntegration {...commonProps} />;
      case 'csv':
        return <CsvUploadIntegration {...commonProps} />;
      case 'api':
        return <ApiIntegration {...commonProps} />;
      default:
        return null;
    }
  };

  // Phase 1: Select Integration Type
  if (phase === 'select-type' && !integration) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Integração de Dados
          </h2>
          <p className="text-muted-foreground">
            Selecione a fonte de dados do cliente para alimentar o dashboard
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {INTEGRATION_TYPES.map((intType) => {
            const Icon = intType.icon;
            const isSelected = selectedType === intType.type;

            return (
              <Card
                key={intType.type}
                className={cn(
                  "p-4 cursor-pointer transition-all hover:border-accent/50",
                  isSelected && "border-accent bg-accent/5 ring-2 ring-accent/20"
                )}
                onClick={() => {
                  setSelectedType(intType.type);
                  setPhase('configure');
                }}
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <div className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center",
                    intType.bgColor
                  )}>
                    <Icon className={cn("w-7 h-7", intType.color)} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{intType.name}</p>
                    <p className="text-sm text-muted-foreground">{intType.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Phase 2: Configure Integration
  if (phase === 'configure' && selectedType && !integration) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Integração de Dados
          </h2>
          <p className="text-muted-foreground">
            Configure a conexão com {INTEGRATION_TYPES.find(t => t.type === selectedType)?.name}
          </p>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-foreground">
            Configurar {INTEGRATION_TYPES.find(t => t.type === selectedType)?.name}
          </h3>
          <Button variant="ghost" size="sm" onClick={() => {
            setSelectedType(null);
            setPhase('select-type');
          }}>
            Trocar fonte
          </Button>
        </div>

        {connectionError && (
          <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Erro na conexão</p>
                <p className="text-sm text-muted-foreground">{connectionError}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar novamente
            </Button>
          </div>
        )}

        {renderIntegrationForm()}
      </div>
    );
  }

  // Phase 3: Select Tables and Columns
  if (phase === 'select-tables' && integration?.status === 'connected') {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Integração de Dados
          </h2>
          <p className="text-muted-foreground">
            Selecione as tabelas e colunas que deseja importar
          </p>
        </div>

        {/* Connection Status */}
        <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="font-medium text-emerald-600">
                  {integration.name} conectado com sucesso!
                </p>
                <p className="text-sm text-muted-foreground">
                  Última sincronização: {new Date(integration.lastSync || '').toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleDisconnect}>
              Desconectar
            </Button>
          </div>
        </div>

        {/* Table Selection */}
        {detectedTables.length > 0 && (
          <TableSelection
            tables={detectedTables}
            selectedTables={selectedTables}
            onSelectionChange={handleTableSelectionChange}
            minTables={1}
            maxTables={10}
          />
        )}

        {/* Navigation hint */}
        {selectedTables.length > 0 && (
          <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
            <ArrowRight className="w-4 h-4" />
            Clique em "Próximo" para continuar com o mapeamento de campos
          </div>
        )}
      </div>
    );
  }

  // Fallback - shouldn't normally reach here
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Integração de Dados
        </h2>
        <p className="text-muted-foreground">
          Configure a fonte de dados
        </p>
      </div>
      <Button onClick={handleDisconnect}>Reiniciar configuração</Button>
    </div>
  );
};

export default IntegrationStep;
