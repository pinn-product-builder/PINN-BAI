import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import OrgAvatar from '@/components/admin/OrgAvatar';
import { Image as ImageIcon, Loader2, Save, Trash2, Upload } from 'lucide-react';

interface OrgIdentityCardProps {
  orgId: string;
  name: string;
  logoUrl: string | null;
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB

const OrgIdentityCard = ({ orgId, name: initialName, logoUrl: initialLogoUrl }: OrgIdentityCardProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setName(initialName);
    setLogoUrl(initialLogoUrl);
  }, [initialName, initialLogoUrl]);

  const isDirty = name.trim() !== initialName || (logoUrl ?? null) !== (initialLogoUrl ?? null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-organization', orgId] });
    queryClient.invalidateQueries({ queryKey: ['admin-organizations-list'] });
    queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
    queryClient.invalidateQueries({ queryKey: ['organizations'] });
    queryClient.invalidateQueries({ queryKey: ['organization-settings', orgId] });
    window.dispatchEvent(new Event('org-settings-updated'));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Arquivo inválido', description: 'Selecione uma imagem (PNG, JPG, SVG, WebP).', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast({ title: 'Arquivo muito grande', description: 'O logo deve ter no máximo 2MB.', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const filePath = `${orgId}/logo.${ext}`;

      // Remove possíveis logos antigos (qualquer extensão) — best-effort
      await supabase.storage.from('org-logos').remove([filePath]);

      const { error: uploadError } = await supabase.storage
        .from('org-logos')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage.from('org-logos').getPublicUrl(filePath);
      // cache buster pra forçar atualização imediata em <img>
      setLogoUrl(`${publicUrl.publicUrl}?t=${Date.now()}`);
      toast({ title: 'Logo carregado', description: 'Clique em "Salvar alterações" para aplicar.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha desconhecida';
      toast({ title: 'Erro no upload', description: message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const removeLogo = () => {
    setLogoUrl(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error('Nome da organização não pode ficar em branco.');
      const { error } = await supabase
        .from('organizations')
        .update({ name: trimmedName, logo_url: logoUrl })
        .eq('id', orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Identidade atualizada', description: 'Nome e logo da organização foram salvos.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <Card className="border border-border bg-card/80 backdrop-blur-xl shadow-sm">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <ImageIcon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-foreground">Identidade da Organização</CardTitle>
            <CardDescription>
              Nome exibido no app, no menu lateral e nas listagens, e o logo do cliente.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="org-name" className="text-sm font-medium">Nome da organização</Label>
          <Input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Pinn Revenue OS"
            maxLength={120}
            className="max-w-md"
          />
        </div>

        <Separator />

        <div className="space-y-3">
          <Label className="text-sm font-medium">Logo do cliente</Label>
          <div className="flex items-center gap-4 flex-wrap">
            <OrgAvatar
              name={name || 'Org'}
              logoUrl={logoUrl}
              sizeClassName="w-20 h-20"
              textClassName="text-2xl"
              roundedClassName="rounded-2xl"
            />
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  {logoUrl ? 'Trocar logo' : 'Enviar logo'}
                </Button>
                {logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeLogo}
                    className="text-red-600 hover:text-red-700 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remover
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, SVG ou WebP — até 2MB. Quadrado funciona melhor.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || saveMutation.isPending || isUploading}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar alterações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrgIdentityCard;
