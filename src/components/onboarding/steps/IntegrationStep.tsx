import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, FileSpreadsheet, FileUp, Globe, Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DataIntegration, IntegrationType, DetectedTable, DetectedColumn } from '@/lib/mock-data';

import SupabaseIntegration from '../integrations/SupabaseIntegration';
import GoogleSheetsIntegration from '../integrations/GoogleSheetsIntegration';
import CsvUploadIntegration from '../integrations/CsvUploadIntegration';
import ApiIntegration from '../integrations/ApiIntegration';

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

// Mock detected tables for simulation
const generateMockTables = (): DetectedTable[] => [
  {
    name: 'leads',
    columns: [
      { name: 'id', type: 'number', nullable: false, sampleValues: ['1', '2', '3'] },
      { name: 'name', type: 'string', nullable: false, sampleValues: ['João Silva', 'Maria Santos', 'Carlos Lima'] },
      { name: 'email', type: 'string', nullable: false, sampleValues: ['joao@email.com', 'maria@email.com', 'carlos@email.com'] },
      { name: 'source', type: 'string', nullable: true, sampleValues: ['Google Ads', 'LinkedIn', 'Referral'] },
      { name: 'status', type: 'string', nullable: false, sampleValues: ['new', 'qualified', 'converted'] },
      { name: 'value', type: 'number', nullable: true, sampleValues: ['5000', '12000', '8500'] },
      { name: 'created_at', type: 'date', nullable: false, sampleValues: ['2024-01-15', '2024-02-20', '2024-03-10'] },
    ],
    rowCount: 2450,
    sampleData: [
      { id: 1, name: 'João Silva', email: 'joao@email.com', source: 'Google Ads', status: 'qualified', value: 5000 },
      { id: 2, name: 'Maria Santos', email: 'maria@email.com', source: 'LinkedIn', status: 'converted', value: 12000 },
    ],
  },
  {
    name: 'conversions',
    columns: [
      { name: 'id', type: 'number', nullable: false, sampleValues: ['1', '2', '3'] },
      { name: 'lead_id', type: 'number', nullable: false, sampleValues: ['1', '5', '12'] },
      { name: 'revenue', type: 'number', nullable: false, sampleValues: ['5000', '12000', '8500'] },
      { name: 'converted_at', type: 'date', nullable: false, sampleValues: ['2024-02-01', '2024-02-15', '2024-03-01'] },
    ],
    rowCount: 320,
    sampleData: [
      { id: 1, lead_id: 1, revenue: 5000, converted_at: '2024-02-01' },
      { id: 2, lead_id: 5, revenue: 12000, converted_at: '2024-02-15' },
    ],
  },
  {
    name: 'monthly_metrics',
    columns: [
      { name: 'month', type: 'date', nullable: false, sampleValues: ['2024-01', '2024-02', '2024-03'] },
      { name: 'total_leads', type: 'number', nullable: false, sampleValues: ['180', '220', '195'] },
      { name: 'total_conversions', type: 'number', nullable: false, sampleValues: ['22', '28', '24'] },
      { name: 'revenue', type: 'number', nullable: false, sampleValues: ['85000', '112000', '98000'] },
    ],
    rowCount: 12,
    sampleData: [
      { month: '2024-01', total_leads: 180, total_conversions: 22, revenue: 85000 },
      { month: '2024-02', total_leads: 220, total_conversions: 28, revenue: 112000 },
    ],
  },
];

const IntegrationStep = ({ integration, onUpdate }: IntegrationStepProps) => {
  const [selectedType, setSelectedType] = useState<IntegrationType | null>(
    integration?.type || null
  );
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async (config: any) => {
    setIsConnecting(true);
    
    // Simulate API connection
    await new Promise(resolve => setTimeout(resolve, 2000));

    const newIntegration: DataIntegration = {
      id: `integration-${Date.now()}`,
      type: selectedType!,
      name: INTEGRATION_TYPES.find(t => t.type === selectedType)?.name || '',
      config,
      status: 'connected',
      lastSync: new Date().toISOString(),
      tables: generateMockTables(),
    };

    onUpdate(newIntegration);
    setIsConnecting(false);
  };

  const handleDisconnect = () => {
    onUpdate(null);
    setSelectedType(null);
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

      {/* Integration Type Selection */}
      {!integration && (
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
                onClick={() => setSelectedType(intType.type)}
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
      )}

      {/* Integration Form */}
      {selectedType && !integration && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-foreground">
              Configurar {INTEGRATION_TYPES.find(t => t.type === selectedType)?.name}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setSelectedType(null)}>
              Trocar fonte
            </Button>
          </div>
          {renderIntegrationForm()}
        </div>
      )}

      {/* Connected State */}
      {integration && integration.status === 'connected' && (
        <div className="space-y-6">
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

          {/* Detected Tables */}
          {integration.tables && integration.tables.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium text-foreground">
                Tabelas Detectadas ({integration.tables.length})
              </h3>
              <div className="grid gap-3">
                {integration.tables.map((table) => (
                  <Card key={table.name} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Database className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">{table.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {table.columns.length} colunas • {table.rowCount.toLocaleString()} registros
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {table.columns.slice(0, 4).map((col) => (
                          <Badge key={col.name} variant="outline" className="text-xs">
                            {col.name}
                          </Badge>
                        ))}
                        {table.columns.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                            +{table.columns.length - 4}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IntegrationStep;
