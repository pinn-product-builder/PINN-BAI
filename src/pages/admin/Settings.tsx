import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Settings, Layers, Users, Shield } from 'lucide-react';
import { mockPlatformSettings, type PlatformSettings } from '@/lib/mock-data';
import GeneralSettingsCard from '@/components/admin/settings/GeneralSettingsCard';
import PlansSettingsCard from '@/components/admin/settings/PlansSettingsCard';
import UsersSettingsCard from '@/components/admin/settings/UsersSettingsCard';
import NotificationsSettingsCard from '@/components/admin/settings/NotificationsSettingsCard';
import SecuritySettingsCard from '@/components/admin/settings/SecuritySettingsCard';

const AdminSettings = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<PlatformSettings>(mockPlatformSettings);

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
            Configure todos os parâmetros da plataforma Pinn BAI
          </p>
        </div>
        <Button
          onClick={handleSave}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
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

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="plans" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Planos
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Segurança
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 max-w-4xl">
          <GeneralSettingsCard settings={settings} onSettingsChange={setSettings} />
          <NotificationsSettingsCard settings={settings} onSettingsChange={setSettings} />
        </TabsContent>

        <TabsContent value="plans" className="space-y-6 max-w-4xl">
          <PlansSettingsCard />
        </TabsContent>

        <TabsContent value="users" className="space-y-6 max-w-4xl">
          <UsersSettingsCard />
        </TabsContent>

        <TabsContent value="security" className="space-y-6 max-w-4xl">
          <SecuritySettingsCard settings={settings} onSettingsChange={setSettings} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettings;
