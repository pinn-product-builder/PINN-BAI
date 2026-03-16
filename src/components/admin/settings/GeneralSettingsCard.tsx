import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Zap } from 'lucide-react';
import type { PlatformSettings } from '@/lib/mock-data';

interface GeneralSettingsCardProps {
  settings: PlatformSettings;
  onSettingsChange: (settings: PlatformSettings) => void;
}

const GeneralSettingsCard = ({ settings, onSettingsChange }: GeneralSettingsCardProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle>Configurações Gerais</CardTitle>
            <CardDescription>Parâmetros básicos da plataforma</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="platformName">Nome da Plataforma</Label>
            <Input
              id="platformName"
              value={settings.platformName}
              onChange={(e) => onSettingsChange({ ...settings, platformName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supportEmail">Email de Suporte</Label>
            <Input
              id="supportEmail"
              type="email"
              value={settings.supportEmail}
              onChange={(e) => onSettingsChange({ ...settings, supportEmail: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="defaultPlan">Plano Padrão para Trial</Label>
            <Select
              value={String(settings.defaultPlan)}
              onValueChange={(value) => onSettingsChange({ ...settings, defaultPlan: parseInt(value) as 1 | 2 | 3 | 4 })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Starter</SelectItem>
                <SelectItem value="2">Professional</SelectItem>
                <SelectItem value="3">Business</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="trialDays">Dias de Trial</Label>
            <Input
              id="trialDays"
              type="number"
              value={settings.trialDays}
              onChange={(e) => onSettingsChange({ ...settings, trialDays: parseInt(e.target.value) || 14 })}
            />
          </div>
        </div>
        <div className="flex items-center justify-between pt-2">
          <div>
            <p className="font-medium text-foreground">Modo Manutenção</p>
            <p className="text-sm text-muted-foreground">
              Bloqueia acesso de clientes durante atualizações
            </p>
          </div>
          <Switch
            checked={settings.maintenanceMode}
            onCheckedChange={(checked) => onSettingsChange({ ...settings, maintenanceMode: checked })}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-foreground">Permitir Novos Registros</p>
            <p className="text-sm text-muted-foreground">
              Habilita criação de novas organizações
            </p>
          </div>
          <Switch
            checked={settings.allowNewRegistrations}
            onCheckedChange={(checked) => onSettingsChange({ ...settings, allowNewRegistrations: checked })}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default GeneralSettingsCard;
