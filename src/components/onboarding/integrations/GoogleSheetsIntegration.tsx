import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, FileSpreadsheet, ExternalLink } from 'lucide-react';
import type { GoogleSheetsConfig } from '@/lib/types';

interface GoogleSheetsIntegrationProps {
  onConnect: (config: GoogleSheetsConfig) => void;
  isConnecting: boolean;
}

const GoogleSheetsIntegration = ({ onConnect, isConnecting }: GoogleSheetsIntegrationProps) => {
  const [config, setConfig] = useState({
    spreadsheetUrl: '',
    sheetName: 'Sheet1',
    headerRow: 1,
    refreshInterval: 60,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect(config);
  };

  const isValid = config.spreadsheetUrl.includes('docs.google.com/spreadsheets');

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 bg-success/5 rounded-lg border border-success/20">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="w-5 h-5 text-success shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Conectar ao Google Sheets</p>
            <p className="text-sm text-muted-foreground mt-1">
              Conecte uma planilha do Google para sincronizar dados automaticamente.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sheet-url">URL da Planilha *</Label>
          <Input
            id="sheet-url"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={config.spreadsheetUrl}
            onChange={(e) => setConfig({ ...config, spreadsheetUrl: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Cole o link completo da planilha. Certifique-se que está compartilhada como "Qualquer pessoa com o link".
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sheet-name">Nome da Aba</Label>
            <Input
              id="sheet-name"
              placeholder="Sheet1"
              value={config.sheetName}
              onChange={(e) => setConfig({ ...config, sheetName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="header-row">Linha do Cabeçalho</Label>
            <Input
              id="header-row"
              type="number"
              min={1}
              value={config.headerRow}
              onChange={(e) => setConfig({ ...config, headerRow: parseInt(e.target.value) || 1 })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="refresh">Intervalo de Atualização (minutos)</Label>
          <Input
            id="refresh"
            type="number"
            min={5}
            max={1440}
            value={config.refreshInterval}
            onChange={(e) => setConfig({ ...config, refreshInterval: parseInt(e.target.value) || 60 })}
          />
          <p className="text-xs text-muted-foreground">
            Frequência em que os dados serão sincronizados (mínimo 5 minutos)
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!isValid || isConnecting}
          className="bg-success hover:bg-success/90 text-success-foreground"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Conectando...
            </>
          ) : (
            <>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Conectar Google Sheets
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default GoogleSheetsIntegration;
