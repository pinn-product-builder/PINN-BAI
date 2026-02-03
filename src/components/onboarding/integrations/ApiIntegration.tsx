import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Globe, Plus, X } from 'lucide-react';
import type { ApiConfig } from '@/lib/types';

interface ApiIntegrationProps {
  onConnect: (config: ApiConfig) => void;
  isConnecting: boolean;
}

const ApiIntegration = ({ onConnect, isConnecting }: ApiIntegrationProps) => {
  const [config, setConfig] = useState<{
    baseUrl: string;
    authType: 'bearer' | 'api_key' | 'basic' | 'none';
    authValue: string;
    endpoint: string;
    method: 'GET' | 'POST';
    refreshInterval: number;
  }>({
    baseUrl: '',
    authType: 'bearer',
    authValue: '',
    endpoint: '/api/data',
    method: 'GET' as const,
    refreshInterval: 60,
  });
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);

  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '' }]);
  };

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    setHeaders(headers.map((h, i) => (i === index ? { ...h, [field]: value } : h)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect({
      ...config,
      headers: headers.reduce((acc, h) => {
        if (h.key) acc[h.key] = h.value;
        return acc;
      }, {} as Record<string, string>),
    });
  };

  const isValid = config.baseUrl.startsWith('http') && config.endpoint;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 bg-purple-500/5 rounded-lg border border-purple-500/20">
        <div className="flex items-start gap-3">
          <Globe className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Conectar API Externa</p>
            <p className="text-sm text-muted-foreground mt-1">
              Configure uma API REST para sincronizar dados automaticamente.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="base-url">URL Base *</Label>
          <Input
            id="base-url"
            placeholder="https://api.exemplo.com"
            value={config.baseUrl}
            onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="endpoint">Endpoint *</Label>
            <Input
              id="endpoint"
              placeholder="/api/data"
              value={config.endpoint}
              onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="method">Método</Label>
            <Select
              value={config.method}
              onValueChange={(value) => setConfig({ ...config, method: value as 'GET' | 'POST' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="auth-type">Tipo de Autenticação</Label>
            <Select
              value={config.authType}
              onValueChange={(value) => setConfig({ ...config, authType: value as ApiConfig['authType'] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                <SelectItem value="bearer">Bearer Token</SelectItem>
                <SelectItem value="api_key">API Key</SelectItem>
                <SelectItem value="basic">Basic Auth</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {config.authType !== 'none' && (
            <div className="space-y-2">
              <Label htmlFor="auth-value">
                {config.authType === 'bearer' && 'Token'}
                {config.authType === 'api_key' && 'API Key'}
                {config.authType === 'basic' && 'Credenciais (user:pass)'}
              </Label>
              <Input
                id="auth-value"
                type="password"
                placeholder="..."
                value={config.authValue}
                onChange={(e) => setConfig({ ...config, authValue: e.target.value })}
              />
            </div>
          )}
        </div>

        {/* Custom Headers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Headers Customizados</Label>
            <Button type="button" variant="ghost" size="sm" onClick={addHeader}>
              <Plus className="w-4 h-4 mr-1" />
              Adicionar
            </Button>
          </div>
          {headers.map((header, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder="Header name"
                value={header.key}
                onChange={(e) => updateHeader(index, 'key', e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Value"
                value={header.value}
                onChange={(e) => updateHeader(index, 'value', e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeHeader(index)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="refresh-api">Intervalo de Atualização (minutos)</Label>
          <Input
            id="refresh-api"
            type="number"
            min={5}
            max={1440}
            value={config.refreshInterval}
            onChange={(e) => setConfig({ ...config, refreshInterval: parseInt(e.target.value) || 60 })}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!isValid || isConnecting}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Conectando...
            </>
          ) : (
            <>
              <Globe className="w-4 h-4 mr-2" />
              Conectar API
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default ApiIntegration;
