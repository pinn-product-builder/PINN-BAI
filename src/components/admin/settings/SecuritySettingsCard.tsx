import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Shield } from 'lucide-react';
import type { PlatformSettings } from '@/lib/mock-data';

interface SecuritySettingsCardProps {
  settings: PlatformSettings;
  onSettingsChange: (settings: PlatformSettings) => void;
}

const SecuritySettingsCard = ({ settings, onSettingsChange }: SecuritySettingsCardProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <CardTitle>Segurança</CardTitle>
            <CardDescription>Configurações de segurança e isolamento de dados</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-foreground">Row Level Security (RLS)</p>
            <p className="text-sm text-muted-foreground">
              Isolamento de dados por organização no banco de dados
            </p>
          </div>
          <Switch
            checked={settings.enableRLS}
            onCheckedChange={(checked) => onSettingsChange({ ...settings, enableRLS: checked })}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          ⚠️ Desabilitar o RLS pode expor dados entre organizações. Use apenas em ambiente de desenvolvimento.
        </p>
        
        <Separator />
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="maxFileSize">Tamanho Máximo de Arquivo (MB)</Label>
            <Input
              id="maxFileSize"
              type="number"
              value={settings.maxFileSize}
              onChange={(e) => onSettingsChange({ ...settings, maxFileSize: parseInt(e.target.value) || 50 })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logRetention">Retenção de Logs (dias)</Label>
            <Input
              id="logRetention"
              type="number"
              value={settings.logRetention}
              onChange={(e) => onSettingsChange({ ...settings, logRetention: parseInt(e.target.value) || 90 })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SecuritySettingsCard;
