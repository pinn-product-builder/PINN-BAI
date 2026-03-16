import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
import {
  Building2,
  Plus,
  Search,
  Users,
  TrendingUp,
  AlertCircle,
  Loader2,
  LayoutDashboard
} from 'lucide-react';
import { planNames } from '@/lib/mock-data';

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  active: { label: 'Ativo', variant: 'default', className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  suspended: { label: 'Suspenso', variant: 'destructive', className: '' },
  trial: { label: 'Trial', variant: 'secondary', className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
};

const Organizations = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

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
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Gestão de Empresas</h1>
          <p className="text-muted-foreground mt-1">
            Controle centralizado do ecossistema Pinn
          </p>
        </div>
        <Button
          className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold rounded-xl"
          onClick={() => navigate('/admin/organizations/new')}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Organização
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-white/5 bg-white/5 backdrop-blur-sm">
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

        <Card className="border-white/5 bg-white/5 backdrop-blur-sm">
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

        <Card className="border-white/5 bg-white/5 backdrop-blur-sm">
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

        <Card className="border-white/5 bg-white/5 backdrop-blur-sm">
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
      <Card className="border-white/5 bg-white/5 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Universo Pinn</CardTitle>
              <CardDescription>
                {filteredOrgs?.length || 0} organizações monitoradas
              </CardDescription>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar por nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white/5 border-white/10 rounded-xl"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-white/5">
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
                      className="border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => navigate(`/admin/organizations/${org.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                            <span className="text-sm font-bold text-accent">
                              {org.name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{org.name}</p>
                            <p className="text-xs text-muted-foreground">{org.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-foreground">{org.admin_name || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{org.admin_email || 'n/a'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-white/10 text-white/60">
                          {planNames[org.plan] || `Plano ${org.plan}`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`rounded-full px-3 ${status.className}`} variant={status.variant}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(org.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:bg-accent/10 hover:text-accent"
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
    </div>
  );
};

export default Organizations;
