import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Building2,
  UserPlus,
  Upload,
  Settings,
  Trash2,
  Edit2,
  LogIn,
  RefreshCw,
} from 'lucide-react';

interface ActivityLog {
  id: string;
  type: 'org_created' | 'user_created' | 'data_imported' | 'settings_changed' | 'login' | 'data_deleted' | 'dashboard_edited' | 'sync';
  description: string;
  user: string;
  organization?: string;
  timestamp: string;
}

const mockActivityLogs: ActivityLog[] = [
  {
    id: '1',
    type: 'org_created',
    description: 'Nova organização criada: TechCorp Solutions',
    user: 'Admin Pinn',
    organization: 'TechCorp Solutions',
    timestamp: '2024-03-15T10:30:00Z',
  },
  {
    id: '2',
    type: 'data_imported',
    description: 'Dados importados: 2.450 leads de leads_marco_2024.xlsx',
    user: 'João Silva',
    organization: 'TechCorp Solutions',
    timestamp: '2024-03-15T09:15:00Z',
  },
  {
    id: '3',
    type: 'user_created',
    description: 'Novo usuário criado: maria@techcorp.com (Analista)',
    user: 'João Silva',
    organization: 'TechCorp Solutions',
    timestamp: '2024-03-14T16:45:00Z',
  },
  {
    id: '4',
    type: 'dashboard_edited',
    description: 'Dashboard principal editado: layout atualizado',
    user: 'Maria Santos',
    organization: 'Marketing Plus',
    timestamp: '2024-03-14T14:20:00Z',
  },
  {
    id: '5',
    type: 'sync',
    description: 'Insights IA gerados automaticamente para 5 dashboards',
    user: 'Sistema',
    timestamp: '2024-03-14T06:00:00Z',
  },
  {
    id: '6',
    type: 'login',
    description: 'Login na plataforma',
    user: 'Pedro Costa',
    organization: 'Startup Hub',
    timestamp: '2024-03-14T08:30:00Z',
  },
  {
    id: '7',
    type: 'settings_changed',
    description: 'Plano atualizado de Professional para Business',
    user: 'Admin Pinn',
    organization: 'Marketing Plus',
    timestamp: '2024-03-13T11:00:00Z',
  },
  {
    id: '8',
    type: 'data_deleted',
    description: 'Dataset removido: leads_antigos_2023.xlsx',
    user: 'Ana Rodrigues',
    organization: 'Enterprise Global',
    timestamp: '2024-03-13T09:45:00Z',
  },
];

const activityIcons: Record<ActivityLog['type'], React.ReactNode> = {
  org_created: <Building2 className="w-4 h-4" />,
  user_created: <UserPlus className="w-4 h-4" />,
  data_imported: <Upload className="w-4 h-4" />,
  settings_changed: <Settings className="w-4 h-4" />,
  login: <LogIn className="w-4 h-4" />,
  data_deleted: <Trash2 className="w-4 h-4" />,
  dashboard_edited: <Edit2 className="w-4 h-4" />,
  sync: <RefreshCw className="w-4 h-4" />,
};

const activityColors: Record<ActivityLog['type'], string> = {
  org_created: 'bg-success/10 text-success',
  user_created: 'bg-primary/10 text-primary',
  data_imported: 'bg-accent/10 text-accent',
  settings_changed: 'bg-warning/10 text-warning',
  login: 'bg-muted text-muted-foreground',
  data_deleted: 'bg-destructive/10 text-destructive',
  dashboard_edited: 'bg-primary/10 text-primary',
  sync: 'bg-muted text-muted-foreground',
};

const Activity = () => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Agora mesmo';
    if (hours < 24) return `${hours}h atrás`;
    if (days < 7) return `${days}d atrás`;

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Atividade da Plataforma</h1>
        <p className="text-muted-foreground mt-1">
          Acompanhe todas as ações realizadas no sistema
        </p>
      </div>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Atividades</CardTitle>
          <CardDescription>Últimas {mockActivityLogs.length} ações registradas</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {mockActivityLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${activityColors[log.type]}`}
                  >
                    {activityIcons[log.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{log.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">por {log.user}</span>
                      {log.organization && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <Badge variant="outline" className="text-xs">
                            {log.organization}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(log.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default Activity;
