import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Database, ExternalLink } from 'lucide-react';
import type { SupabaseConfig } from '@/lib/types';

interface SupabaseIntegrationProps {
  onConnect: (config: SupabaseConfig) => void;
  isConnecting: boolean;
}

const SupabaseIntegration = ({ onConnect, isConnecting }: SupabaseIntegrationProps) => {
  const [config, setConfig] = useState({
    projectUrl: '',
    anonKey: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect({
      projectUrl: config.projectUrl,
      anonKey: config.anonKey,
    });
  };

  const isValid = config.projectUrl.includes('.supabase.co') && config.anonKey.length > 50;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Conectar ao Supabase</p>
            <p className="text-sm text-muted-foreground mt-1">
              Informe as credenciais do projeto Supabase do cliente para sincronizar os dados.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="supabase-url">URL do Projeto *</Label>
          <Input
            id="supabase-url"
            placeholder="https://xxxxx.supabase.co"
            value={config.projectUrl}
            onChange={(e) => setConfig({ ...config, projectUrl: e.target.value })}
          />
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            Encontre em: Project Settings → API → Project URL
            <a 
              href="https://supabase.com/dashboard" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-accent hover:underline inline-flex items-center gap-0.5"
            >
              Abrir Dashboard <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="supabase-key">Anon Key (public) *</Label>
          <Input
            id="supabase-key"
            type="password"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            value={config.anonKey}
            onChange={(e) => setConfig({ ...config, anonKey: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Encontre em: Project Settings → API → anon public key
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!isValid || isConnecting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Conectando...
            </>
          ) : (
            <>
              <Database className="w-4 h-4 mr-2" />
              Conectar Supabase
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default SupabaseIntegration;
