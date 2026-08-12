import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Loader2, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useGoogleCalendarStatus,
  useStartGoogleOAuth,
  useDisconnectGoogleCalendar,
} from '@/hooks/useGoogleCalendar';

/**
 * Card de conexão Google Calendar (per-org).
 *
 * Mostra status + botão conectar/desconectar. Usado na página Integrations
 * e no fluxo da Pauta IA.
 */
export function GoogleCalendarCard({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const status = useGoogleCalendarStatus(orgId);
  const startOAuth = useStartGoogleOAuth();
  const disconnect = useDisconnectGoogleCalendar();

  const handleConnect = async () => {
    try {
      await startOAuth.mutateAsync({ orgId });
      // mutateAsync redireciona — não retorna aqui em fluxo feliz
    } catch (e) {
      toast({ variant: 'destructive', title: 'Falha ao iniciar OAuth', description: (e as Error).message });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync(orgId);
      toast({ title: 'Google Calendar desconectado' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Falha', description: (e as Error).message });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-950/40">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-base">Google Calendar</CardTitle>
            <CardDescription className="text-xs">
              Pauta IA usa próximos eventos pra montar briefing automaticamente.
            </CardDescription>
          </div>
        </div>
        {status.data?.connected && (
          <Badge variant="outline" className="text-emerald-700 border-emerald-300">
            Conectado
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {status.isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : status.data?.connected ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Conta: <span className="font-mono">{status.data.google_email ?? 'desconhecida'}</span>
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDisconnect}
              disabled={disconnect.isPending}
            >
              {disconnect.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
              ) : (
                <LogOut className="w-3.5 h-3.5 mr-2" />
              )}
              Desconectar
            </Button>
          </div>
        ) : (
          <Button onClick={handleConnect} disabled={startOAuth.isPending}>
            {startOAuth.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Calendar className="w-4 h-4 mr-2" />
            Conectar Google Calendar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default GoogleCalendarCard;
