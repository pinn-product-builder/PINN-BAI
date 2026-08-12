import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Settings, Layers, Users, Shield } from 'lucide-react';
import type { PlatformSettings } from '@/lib/mock-data';
import GeneralSettingsCard from '@/components/admin/settings/GeneralSettingsCard';
import PlansSettingsCard from '@/components/admin/settings/PlansSettingsCard';
import NotificationsSettingsCard from '@/components/admin/settings/NotificationsSettingsCard';
import SecuritySettingsCard from '@/components/admin/settings/SecuritySettingsCard';
import AdminUsers from '@/pages/admin/Users';
import { usePlatformSettings, useUpdatePlatformSettings } from '@/hooks/usePlatformSettings';

const VALID_TABS = ['general', 'plans', 'users', 'security'] as const;
type SettingsTab = (typeof VALID_TABS)[number];

const AdminSettings = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: remoteSettings, isLoading: isLoadingSettings } = usePlatformSettings();
  const saveMutation = useUpdatePlatformSettings();

  // Estado local para edição (rascunho); sincronizado com remoto até salvar.
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  useEffect(() => {
    if (remoteSettings) setSettings(remoteSettings);
  }, [remoteSettings]);

  const tabFromUrl = searchParams.get('tab');
  const activeTab: SettingsTab = (VALID_TABS as readonly string[]).includes(tabFromUrl ?? '')
    ? (tabFromUrl as SettingsTab)
    : 'general';

  const handleTabChange = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === 'general') next.delete('tab');
      else next.set('tab', value);
      return next;
    }, { replace: true });
  };

  const handleSave = () => {
    if (!settings) return;
    saveMutation.mutate(settings, {
      onSuccess: () => {
        toast({
          title: 'Configurações salvas',
          description: 'Alterações persistidas em platform_settings.',
        });
      },
      onError: (err) => {
        toast({
          title: 'Erro ao salvar',
          description: err instanceof Error ? err.message : 'Verifique se a migração platform_settings foi aplicada.',
          variant: 'destructive',
        });
      },
    });
  };

  const showGlobalSave = activeTab === 'general' || activeTab === 'security';
  const isSaving = saveMutation.isPending;
  const isLoadingForm = isLoadingSettings || !settings;

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
        {showGlobalSave && (
          <Button
            onClick={handleSave}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={isSaving || isLoadingForm}
          >
            {isSaving ? (
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
        )}
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
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
          {isLoadingForm ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <GeneralSettingsCard settings={settings} onSettingsChange={setSettings} />
              <NotificationsSettingsCard settings={settings} onSettingsChange={setSettings} />
            </>
          )}
        </TabsContent>

        <TabsContent value="plans" className="space-y-6 max-w-4xl">
          <PlansSettingsCard />
        </TabsContent>

        <TabsContent value="users" className="-mx-8 -mt-2">
          <AdminUsers />
        </TabsContent>

        <TabsContent value="security" className="space-y-6 max-w-4xl">
          {isLoadingForm ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <SecuritySettingsCard settings={settings} onSettingsChange={setSettings} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettings;
