import { useParams } from 'react-router-dom';
import { usePublicShare } from '@/hooks/useDashboardSharing';
import { Loader2, Lock, AlertTriangle } from 'lucide-react';
import { WidgetRenderer } from '@/components/dashboard/DashboardEngine';
import type { DashboardWidget } from '@/lib/types';

export default function PublicDashboard() {
  const { token } = useParams<{ token: string }>();
  const { data: share, isLoading, error } = usePublicShare(token);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !share) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 text-center px-4">
        <AlertTriangle className="w-12 h-12 text-destructive opacity-60" />
        <h1 className="text-xl font-bold">Link inválido ou expirado</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          {error instanceof Error ? error.message : 'Este link não existe ou foi removido.'}
        </p>
      </div>
    );
  }

  const shareRow = share as any;
  const dashboard = shareRow.dashboards;
  const orgId: string | undefined = shareRow.org_id;
  const widgets: DashboardWidget[] = dashboard?.dashboard_widgets ?? [];

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <div className="border-b border-border/50 bg-card px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{shareRow.title ?? dashboard?.name ?? 'Dashboard'}</h1>
          {dashboard?.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{dashboard.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="w-3.5 h-3.5" />
          <span>Somente leitura · {shareRow.view_count} visualizações</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {widgets.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <p className="font-medium">Dashboard sem widgets configurados.</p>
          </div>
        ) : !orgId ? (
          <div className="text-center py-24 text-muted-foreground">
            <p className="font-medium">Link incompleto — não foi possível identificar a organização.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-[minmax(220px,auto)]">
            {widgets.map((w) => (
              <div key={w.id} className="min-h-[220px]">
                <WidgetRenderer widget={w} orgId={orgId} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border/50 bg-card/80 backdrop-blur-sm px-6 py-2 flex items-center justify-center">
        <p className="text-[11px] text-muted-foreground">
          Powered by <span className="font-semibold text-primary">Pinn BAI</span>
        </p>
      </div>
    </div>
  );
}
