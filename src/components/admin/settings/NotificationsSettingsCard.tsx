import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bell } from 'lucide-react';
import type { PlatformSettings } from '@/lib/mock-data';

interface NotificationsSettingsCardProps {
  settings: PlatformSettings;
  onSettingsChange: (settings: PlatformSettings) => void;
}

const NotificationsSettingsCard = ({ settings, onSettingsChange }: NotificationsSettingsCardProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-accent" />
          </div>
          <div>
            <CardTitle>Notificações e IA</CardTitle>
            <CardDescription>Configure alertas e geração automática de insights</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-foreground">Notificações por Email</p>
            <p className="text-sm text-muted-foreground">
              Enviar emails para admins sobre eventos importantes
            </p>
          </div>
          <Switch
            checked={settings.enableNotifications}
            onCheckedChange={(checked) =>
              onSettingsChange({ ...settings, enableNotifications: checked })
            }
          />
        </div>
        
        <Separator />
        
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-foreground">Insights Automáticos por IA</p>
            <p className="text-sm text-muted-foreground">
              Gerar insights automaticamente via Edge Functions
            </p>
          </div>
          <Switch
            checked={settings.enableAutoInsights}
            onCheckedChange={(checked) =>
              onSettingsChange({ ...settings, enableAutoInsights: checked })
            }
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="insightsInterval">Intervalo de Geração</Label>
          <Select
            value={String(settings.insightsInterval)}
            onValueChange={(value) => onSettingsChange({ ...settings, insightsInterval: parseInt(value) })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">A cada 6 horas</SelectItem>
              <SelectItem value="12">A cada 12 horas</SelectItem>
              <SelectItem value="24">Diariamente</SelectItem>
              <SelectItem value="168">Semanalmente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationsSettingsCard;
