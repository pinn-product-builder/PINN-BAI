import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Palette, Type, Image, Eye, Upload, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const PRESET_COLORS = [
  { label: 'Azul', value: '#3B82F6' },
  { label: 'Roxo', value: '#8B5CF6' },
  { label: 'Verde', value: '#10B981' },
  { label: 'Laranja', value: '#F97316' },
  { label: 'Vermelho', value: '#EF4444' },
  { label: 'Rosa', value: '#EC4899' },
  { label: 'Ciano', value: '#06B6D4' },
  { label: 'Âmbar', value: '#F59E0B' },
];

const ClientSettings = () => {
  const { orgId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: org, isLoading: isLoadingOrg } = useQuery({
    queryKey: ['organization-settings', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (org) {
      setName(org.name || '');
      setLogoUrl(org.logo_url || '');
      setPrimaryColor(org.primary_color || '#3B82F6');
      const s = (org.settings && typeof org.settings === 'object' && !Array.isArray(org.settings)) ? org.settings as Record<string, any> : {};
      setSettings(s);
    }
  }, [org]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Arquivo inválido', description: 'Selecione uma imagem (PNG, JPG, SVG, WebP).', variant: 'destructive' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'O logo deve ter no máximo 2MB.', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const filePath = `${orgId}/logo.${ext}`;

      // Remove old logo if exists
      await supabase.storage.from('org-logos').remove([filePath]);

      const { error: uploadError } = await supabase.storage
        .from('org-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from('org-logos')
        .getPublicUrl(filePath);

      // Add cache buster
      const url = `${publicUrl.publicUrl}?t=${Date.now()}`;
      setLogoUrl(url);
      toast({ title: 'Logo enviado!', description: 'Salve as configurações para aplicar.' });
    } catch (err) {
      console.error('Upload error:', err);
      toast({ title: 'Erro no upload', description: 'Não foi possível enviar o logo.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('organizations')
        .update({
          name,
          logo_url: logoUrl || null,
          primary_color: primaryColor,
          settings: { ...settings },
        })
        .eq('id', orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-settings', orgId] });
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      // Trigger theme refetch so sidebar updates immediately
      window.dispatchEvent(new Event('org-settings-updated'));
      toast({ title: 'Configurações salvas', description: 'Suas personalizações foram aplicadas com sucesso.' });
    },
    onError: () => {
      toast({ title: 'Erro ao salvar', description: 'Não foi possível salvar as configurações.', variant: 'destructive' });
    },
  });

  if (isLoadingOrg) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">White Label</h1>
          <p className="text-muted-foreground mt-1">Personalize a identidade visual do seu dashboard</p>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Alterações
        </Button>
      </div>

      <Tabs defaultValue="brand" className="space-y-6">
        <TabsList>
          <TabsTrigger value="brand" className="gap-2"><Image className="w-4 h-4" />Marca</TabsTrigger>
          <TabsTrigger value="colors" className="gap-2"><Palette className="w-4 h-4" />Cores</TabsTrigger>
          <TabsTrigger value="preview" className="gap-2"><Eye className="w-4 h-4" />Preview</TabsTrigger>
        </TabsList>

        {/* Brand Tab */}
        <TabsContent value="brand" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Type className="w-5 h-5 text-primary" />Nome da Marca</CardTitle>
              <CardDescription>O nome exibido no menu lateral e cabeçalhos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-w-md">
                <Label htmlFor="brandName">Nome</Label>
                <Input id="brandName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da sua empresa" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Image className="w-5 h-5 text-primary" />Logotipo</CardTitle>
              <CardDescription>Envie seu logotipo ou cole uma URL. Recomendado: 200×40px, fundo transparente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File upload */}
              <div className="space-y-3">
                <Label>Upload de arquivo</Label>
                <div className="flex items-center gap-3">
                  <label
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-all text-sm font-medium",
                      isUploading
                        ? "border-primary/40 bg-primary/5 text-muted-foreground"
                        : "border-border hover:border-primary/50 hover:bg-primary/5 text-foreground"
                    )}
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {isUploading ? 'Enviando...' : 'Escolher arquivo'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                  </label>
                  <span className="text-xs text-muted-foreground">PNG, JPG, SVG ou WebP (máx. 2MB)</span>
                </div>
              </div>

              <Separator />

              {/* URL input */}
              <div className="space-y-2 max-w-lg">
                <Label htmlFor="logoUrl">Ou cole uma URL</Label>
                <Input
                  id="logoUrl"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://suaempresa.com/logo.png"
                />
              </div>

              {/* Logo preview */}
              <div className="flex items-center gap-4">
                <div className="w-48 h-14 rounded-xl border border-border bg-sidebar flex items-center justify-center overflow-hidden p-2 relative">
                  {logoUrl ? (
                    <>
                      <img
                        src={logoUrl}
                        alt="Logo preview"
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <button
                        onClick={() => setLogoUrl('')}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs hover:scale-110 transition-transform"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem logo</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">Preview do logo no menu</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Colors Tab */}
        <TabsContent value="colors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5 text-primary" />Cor Principal</CardTitle>
              <CardDescription>Cor de destaque usada em botões, badges e elementos interativos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Cores predefinidas</Label>
                <div className="flex flex-wrap gap-3">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setPrimaryColor(c.value)}
                      className={cn(
                        "w-10 h-10 rounded-xl border-2 transition-all flex items-center justify-center",
                        primaryColor === c.value ? "border-foreground scale-110 shadow-lg" : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    >
                      {primaryColor === c.value && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                    </button>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="space-y-2 max-w-xs">
                <Label htmlFor="customColor">Cor personalizada</Label>
                <div className="flex items-center gap-3">
                  <input type="color" id="customColor" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                  <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-32 font-mono text-sm" maxLength={7} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Opções adicionais</CardTitle>
              <CardDescription>Controle de elementos visuais do dashboard</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Mostrar badge "Powered by Pinn"</p>
                  <p className="text-sm text-muted-foreground">Exibir crédito da plataforma no rodapé</p>
                </div>
                <Switch checked={settings.showPoweredBy !== false} onCheckedChange={(checked) => setSettings({ ...settings, showPoweredBy: checked })} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Resumo Executivo com IA</p>
                  <p className="text-sm text-muted-foreground">Exibir card de insights gerados por IA no dashboard</p>
                </div>
                <Switch checked={settings.showAINarrative !== false} onCheckedChange={(checked) => setSettings({ ...settings, showAINarrative: checked })} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">CEO Briefing (Áudio)</p>
                  <p className="text-sm text-muted-foreground">Permitir resumo executivo em voz</p>
                </div>
                <Switch checked={settings.showVoiceBriefing !== false} onCheckedChange={(checked) => setSettings({ ...settings, showVoiceBriefing: checked })} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preview da Marca</CardTitle>
              <CardDescription>Visualize como sua marca aparecerá no dashboard</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-64 rounded-xl border border-border bg-sidebar overflow-hidden">
                <div className="flex items-center gap-3 p-5 border-b border-sidebar-border">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: primaryColor }}>
                      {name.charAt(0) || 'P'}
                    </div>
                  )}
                  <span className="text-base font-bold text-sidebar-foreground truncate">{name || 'Sua Marca'}</span>
                </div>
                <div className="p-3 space-y-1">
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: primaryColor }}>
                    <div className="w-4 h-4 rounded bg-white/20" />
                    Centro de Comando
                  </div>
                  {['Conector de Dados', 'Inteligência IA', 'White Label'].map((label) => (
                    <div key={label} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/60">
                      <div className="w-4 h-4 rounded bg-sidebar-accent/50" />
                      {label}
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-sidebar-border">
                  <button className="w-full py-2.5 rounded-lg text-white text-sm font-bold" style={{ backgroundColor: primaryColor }}>
                    Botão de Ação
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientSettings;
