import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useSyncStatus, useSyncNow, formatRelativeTime } from '@/hooks/useSyncStatus';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Chip "Última sync há Xh" + botão "Sincronizar agora" no header do dashboard.
 * Só platform_admin enxerga (consistente com o resto da edição admin).
 */
export function SyncStatusBadge({ orgId }: { orgId: string }) {
  const { isPlatformAdmin } = useAuth();
  const { toast } = useToast();
  const { data: rows = [] } = useSyncStatus(orgId);
  const syncNow = useSyncNow();

  if (!isPlatformAdmin) return null;
  if (rows.length === 0) return null;

  // Pega a connection mais recente (a "principal" da org) — geralmente só tem uma.
  const main = [...rows]
    .sort((a, b) => (b.last_sync_at ?? '').localeCompare(a.last_sync_at ?? ''))[0];

  const isError = main.sync_status === 'error';
  const isSyncing = main.sync_status === 'syncing' || syncNow.isPending;
  const since = formatRelativeTime(main.last_sync_at);

  const handleSync = async () => {
    try {
      const result = await syncNow.mutateAsync({ orgId, provider: main.provider });
      const synced = result?.synced as Record<string, number> | undefined;
      const summary = synced ? Object.entries(synced).map(([k, v]) => `${v} ${k}`).join(', ') : null;
      toast({
        title: `${main.provider} sincronizado`,
        description: summary ?? 'Dashboard atualizado.',
      });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Sync falhou', description: (e as Error).message });
    }
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={
                isError
                  ? 'border-destructive/40 bg-destructive/5 text-destructive'
                  : isSyncing
                  ? 'border-primary/40 bg-primary/5 text-primary'
                  : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700'
              }
            >
              {isSyncing ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : isError ? (
                <AlertCircle className="w-3 h-3 mr-1" />
              ) : (
                <CheckCircle2 className="w-3 h-3 mr-1" />
              )}
              {main.provider} · {isSyncing ? 'sincronizando' : since}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            {isError && main.sync_error ? (
              <span>Erro: {main.sync_error}</span>
            ) : (
              <span>Última sync: {main.last_sync_at ?? 'nunca'}</span>
            )}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={handleSync}
              disabled={isSyncing}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Sincronizar agora</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export default SyncStatusBadge;
