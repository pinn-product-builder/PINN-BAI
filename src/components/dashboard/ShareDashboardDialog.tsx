import { useState } from 'react';
import { useDashboardShares, useCreateShare, useDeleteShare } from '@/hooks/useDashboardSharing';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Copy, Trash2, Loader2, Link, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  orgId: string;
  dashboardId: string;
  dashboardName: string;
  onClose: () => void;
}

export function ShareDashboardDialog({ orgId, dashboardId, dashboardName, onClose }: Props) {
  const { toast } = useToast();
  const { data: shares = [], isLoading } = useDashboardShares(dashboardId);
  const createShare = useCreateShare();
  const deleteShare = useDeleteShare();

  const [title, setTitle] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [allowFilters, setAllowFilters] = useState(true);

  const baseUrl = window.location.origin;

  const handleCreate = async () => {
    try {
      await createShare.mutateAsync({
        orgId,
        dashboardId,
        title: title || undefined,
        expiresAt: expiresAt || undefined,
        allowFilters,
      });
      toast({ title: 'Link de compartilhamento criado!' });
      setTitle('');
      setExpiresAt('');
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao criar link.' });
    }
  };

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(`${baseUrl}/share/${token}`);
    toast({ title: 'Link copiado!' });
  };

  const handleDelete = async (shareId: string) => {
    if (!confirm('Revogar este link? Quem tiver o link não poderá mais acessar.')) return;
    try {
      await deleteShare.mutateAsync({ shareId, dashboardId });
      toast({ title: 'Link revogado.' });
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao revogar.' });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="w-4 h-4" />
            Compartilhar "{dashboardName}"
          </DialogTitle>
        </DialogHeader>

        {/* Create form */}
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Título do link (opcional)</Label>
            <Input
              placeholder="Ex: Relatório para o cliente"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Expiração (opcional)</Label>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Permitir filtros</Label>
              <div className="flex items-center gap-2 h-9">
                <Switch checked={allowFilters} onCheckedChange={setAllowFilters} />
                <span className="text-xs text-muted-foreground">{allowFilters ? 'Sim' : 'Não'}</span>
              </div>
            </div>
          </div>
          <Button
            onClick={handleCreate}
            disabled={createShare.isPending}
            className="w-full gap-2"
          >
            {createShare.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
            Gerar Link Público
          </Button>
        </div>

        {/* Existing shares */}
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
        ) : shares.length > 0 ? (
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Links ativos ({shares.length})</p>
            {shares.map((share) => (
              <div key={share.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 hover:border-border transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{share.title ?? 'Link sem título'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <code className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                      {baseUrl}/share/{share.token.substring(0, 16)}…
                    </code>
                    {share.expires_at && (
                      <Badge variant="outline" className="text-[9px] px-1">
                        Expira {format(new Date(share.expires_at), 'dd/MM/yy', { locale: ptBR })}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[9px] px-1 text-muted-foreground">
                      {share.view_count} views
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleCopy(share.token)}>
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                    <a href={`${baseUrl}/share/${share.token}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(share.id)}
                    disabled={deleteShare.isPending}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
