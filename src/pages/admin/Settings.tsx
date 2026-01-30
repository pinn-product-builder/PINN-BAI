import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Bell, Shield, Database, Zap } from 'lucide-react';

const AdminSettings = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState({
    platformName: 'Pinn BAI',
    supportEmail: 'suporte@pinnbai.com',
    defaultPlan: '1',
    trialDays: '14',
    enableNotifications: true,
    enableAutoInsights: true,
    insightsInterval: '24',
    maxFileSize: '50',
    enableRLS: true,
    logRetention: '90',
  });

  const handleSave = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    toast({
      title: 'Configurações salvas',
      description: 'As alterações foram aplicadas com sucesso.',
    });
    setIsLoading(false);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">
            Configure os parâmetros gerais da plataforma
          </p>
        </div>
        <Button
          onClick={handleSave}
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Salvar Alterações
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* General Settings */}
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
                  onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supportEmail">Email de Suporte</Label>
                <Input
                  id="supportEmail"
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="defaultPlan">Plano Padrão para Trial</Label>
                <Select
                  value={settings.defaultPlan}
                  onValueChange={(value) => setSettings({ ...settings, defaultPlan: value })}
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
                  onChange={(e) => setSettings({ ...settings, trialDays: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-accent" />
              </div>
              <div>
                <CardTitle>Notificações</CardTitle>
                <CardDescription>Configure alertas e notificações do sistema</CardDescription>
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
                  setSettings({ ...settings, enableNotifications: checked })
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
                  setSettings({ ...settings, enableAutoInsights: checked })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="insightsInterval">Intervalo de Geração (horas)</Label>
              <Select
                value={settings.insightsInterval}
                onValueChange={(value) => setSettings({ ...settings, insightsInterval: value })}
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

        {/* Data & Storage */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-warning" />
              </div>
              <div>
                <CardTitle>Dados e Armazenamento</CardTitle>
                <CardDescription>Limites e configurações de dados</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxFileSize">Tamanho Máximo de Arquivo (MB)</Label>
                <Input
                  id="maxFileSize"
                  type="number"
                  value={settings.maxFileSize}
                  onChange={(e) => setSettings({ ...settings, maxFileSize: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logRetention">Retenção de Logs (dias)</Label>
                <Input
                  id="logRetention"
                  type="number"
                  value={settings.logRetention}
                  onChange={(e) => setSettings({ ...settings, logRetention: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <CardTitle>Segurança</CardTitle>
                <CardDescription>Configurações de segurança e isolamento</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Row Level Security (RLS)</p>
                <p className="text-sm text-muted-foreground">
                  Isolamento de dados por organização no banco de dados
                </p>
              </div>
              <Switch
                checked={settings.enableRLS}
                onCheckedChange={(checked) => setSettings({ ...settings, enableRLS: checked })}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              ⚠️ Desabilitar o RLS pode expor dados entre organizações. Use apenas em ambiente de
              desenvolvimento.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminSettings;
