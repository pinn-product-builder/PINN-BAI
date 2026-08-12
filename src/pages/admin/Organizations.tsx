import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Building2,
  Plus,
  Search,
  Users,
  TrendingUp,
  AlertCircle,
  Loader2,
  LayoutDashboard,
  Ban,
} from 'lucide-react';
import { usePlans } from '@/hooks/usePlans';
import { getPlanShortName } from '@/lib/plans';
import OrgAvatar from '@/components/admin/OrgAvatar';
import { useToast } from '@/hooks/use-toast';
import type { OrgStatus } from '@/lib/types';

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  active: { label: 'Ativo', variant: 'default', className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  suspended: { label: 'Suspenso', variant: 'destructive', className: '' },
  trial: { label: 'Trial', variant: 'secondary', className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
};

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  plan: number;
  status: OrgStatus;
  logo_url: string | null;
  admin_name: string | null;
  admin_email: string | null;
  created_at: string;
};

const Organizations = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suspendTarget, setSuspendTarget] = useState<OrgRow | null>(null);
  const navigate = useNavigate();
  const { data: plans } = usePlans();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: organizations, isLoading } = useQuery({
    queryKey: ['admin-organizations-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const setStatusMutation = useMutation({
    mutationFn: async ({ orgId, action }: { orgId: string; action: 'suspend' | 'activate' }) => {
      const updates = action === 'suspend'
        ? { status: 'suspended' as OrgStatus, trial_ends_at: null }
        : { status: 'active' as OrgStatus, trial_ends_at: null };
      const { error } = await supabase.from('organizations').update(updates).eq('id', orgId);
      if (error) throw error;
      return action;
    },
    onSuccess: (action) => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast({
        title: action === 'suspend' ? 'Organização suspensa' : 'Organização reativada',
        description: action === 'suspend'
          ? 'O cliente perde acesso ao BAI imediatamente.'
          : 'O cliente já pode entrar normalmente.',
      });
      setSuspendTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao alterar status', description: err.message, variant: 'destructive' });
    },
  });

  const filteredOrgs = organizations?.filter(
    (org) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (org.admin_email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: organizations?.length || 0,
    active: organizations?.filter((o) => o.status === 'active').length || 0,
    suspended: organizations?.filter((o) => o.status === 'suspended').length || 0,
    trial: organizations?.filter((o) => o.status === 'trial').length || 0,
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Gestão de Empresas</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Controle centralizado do ecossistema Pinn
          </p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shrink-0"
          onClick={() => navigate('/admin/organizations/new')}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Organização
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-3xl font-bold text-foreground">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ativos</p>
                <p className="text-3xl font-bold text-emerald-500">{stats.active}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Em Trial</p>
                <p className="text-3xl font-bold text-amber-500">{stats.trial}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Suspensos</p>
                <p className="text-3xl font-bold text-red-500">{stats.suspended}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Organizations table */}
      <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-foreground">Universo Pinn</CardTitle>
              <CardDescription>
                {filteredOrgs?.length || 0} organizações monitoradas
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar por nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted/50 border-border rounded-xl"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[720px] table-fixed">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[28%] max-w-0" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="text-muted-foreground">Organização</TableHead>
                <TableHead className="text-muted-foreground">Admin</TableHead>
                <TableHead className="text-muted-foreground">Plano</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Criado em</TableHead>
                <TableHead className="text-right text-muted-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!filteredOrgs || filteredOrgs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground italic">
                    Nenhuma empresa encontrada no sistema.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrgs.map((org) => {
                  const status = statusConfig[org.status] || { label: org.status, variant: 'outline', className: '' };
                  return (
                    <TableRow
                      key={org.id}
                      className="border-border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/admin/organizations/${org.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-0">
                          <OrgAvatar name={org.name} logoUrl={org.logo_url} />
                          <div className="min-w-0">
                            <p className="font-bold text-foreground truncate">{org.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{org.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{org.admin_name || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground truncate">{org.admin_email || 'n/a'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-border text-muted-foreground whitespace-nowrap">
                          {getPlanShortName(plans, org.plan)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {org.status === 'trial' ? (
                          <Badge className={`rounded-full px-3 ${status.className} whitespace-nowrap`} variant={status.variant}>
                            {status.label}
                          </Badge>
                        ) : (
                          <div
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Switch
                              checked={org.status === 'active'}
                              disabled={setStatusMutation.isPending}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setStatusMutation.mutate({ orgId: org.id, action: 'activate' });
                                } else {
                                  setSuspendTarget(org as OrgRow);
                                }
                              }}
                              aria-label={org.status === 'active' ? 'Suspender acesso' : 'Reativar acesso'}
                            />
                            <span
                              className={`text-xs font-medium whitespace-nowrap ${
                                org.status === 'active' ? 'text-emerald-600' : 'text-red-600'
                              }`}
                            >
                              {org.status === 'active' ? 'Ativo' : 'Suspenso'}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDate(org.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:bg-primary/10 hover:text-primary"
                          aria-label="Abrir detalhes"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/organizations/${org.id}`);
                          }}
                        >
                          <LayoutDashboard className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!suspendTarget} onOpenChange={(open) => !open && setSuspendTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspender acesso da organização?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">{suspendTarget?.name}</span> deixará
              de conseguir acessar o BAI imediatamente. Todos os usuários da org verão a tela de
              bloqueio até a reativação manual. Você pode reverter a qualquer momento por esta
              mesma tela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={setStatusMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={setStatusMutation.isPending}
              onClick={() => {
                if (suspendTarget) {
                  setStatusMutation.mutate({ orgId: suspendTarget.id, action: 'suspend' });
                }
              }}
            >
              {setStatusMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Ban className="w-4 h-4 mr-2" />
              )}
              Suspender acesso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Organizations;
