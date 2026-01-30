import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { mockOrganizations, planNames, type Organization } from '@/lib/mock-data';

const statusConfig = {
  active: { label: 'Ativo', variant: 'default' as const, className: 'bg-success text-success-foreground' },
  suspended: { label: 'Suspenso', variant: 'destructive' as const, className: '' },
  trial: { label: 'Trial', variant: 'secondary' as const, className: 'bg-warning text-warning-foreground' },
};

const Organizations = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const filteredOrgs = mockOrganizations.filter(
    (org) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.adminEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: mockOrganizations.length,
    active: mockOrganizations.filter((o) => o.status === 'active').length,
    suspended: mockOrganizations.filter((o) => o.status === 'suspended').length,
    trial: mockOrganizations.filter((o) => o.status === 'trial').length,
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Organizações</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os clientes da plataforma Pinn BAI
          </p>
        </div>
        <Button
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
          onClick={() => navigate('/admin/organizations/new')}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Organização
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Clientes</p>
                <p className="text-3xl font-bold text-foreground">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ativos</p>
                <p className="text-3xl font-bold text-success">{stats.active}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Em Trial</p>
                <p className="text-3xl font-bold text-warning">{stats.trial}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Suspensos</p>
                <p className="text-3xl font-bold text-destructive">{stats.suspended}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Organizations table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Organizações</CardTitle>
              <CardDescription>
                {filteredOrgs.length} organizações encontradas
              </CardDescription>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organização</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Usuários</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrgs.map((org) => {
                const status = statusConfig[org.status];
                return (
                  <TableRow
                    key={org.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/client/${org.id}/dashboard`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-semibold text-primary">
                            {org.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{org.name}</p>
                          <p className="text-sm text-muted-foreground">{org.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{org.adminName}</p>
                        <p className="text-sm text-muted-foreground">{org.adminEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{planNames[org.plan]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={status.className} variant={status.variant}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{org.totalUsers}</TableCell>
                    <TableCell className="text-right font-medium">
                      {org.totalLeads.toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(org.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Organizations;
