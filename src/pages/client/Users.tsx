import { useState } from 'react';
import { useParams } from 'react-router-dom';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Search, MoreHorizontal, Shield, Eye, BarChart } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { mockOrganizations } from '@/lib/mock-data';

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: 'client_admin' | 'analyst' | 'viewer';
  status: 'active' | 'inactive' | 'pending';
  lastLogin: string;
  createdAt: string;
}

const getMockOrgUsers = (orgId: string): OrgUser[] => {
  const org = mockOrganizations.find((o) => o.id === orgId);
  if (!org) return [];

  return [
    {
      id: '1',
      name: org.admin_name || 'Admin',
      email: org.admin_email || 'admin@empresa.com',
      role: 'client_admin',
      status: 'active',
      lastLogin: '2024-03-15T10:30:00Z',
      createdAt: '2024-01-15T00:00:00Z',
    },
    {
      id: '2',
      name: 'Carlos Analista',
      email: `analista@${org.slug}.com`,
      role: 'analyst',
      status: 'active',
      lastLogin: '2024-03-14T16:45:00Z',
      createdAt: '2024-02-01T00:00:00Z',
    },
    {
      id: '3',
      name: 'Diretoria',
      email: `diretoria@${org.slug}.com`,
      role: 'viewer',
      status: 'active',
      lastLogin: '2024-03-10T09:00:00Z',
      createdAt: '2024-02-15T00:00:00Z',
    },
    {
      id: '4',
      name: 'Novo Usuário',
      email: `novo@${org.slug}.com`,
      role: 'analyst',
      status: 'pending',
      lastLogin: '',
      createdAt: '2024-03-14T00:00:00Z',
    },
  ];
};

const roleConfig = {
  client_admin: { label: 'Admin', icon: Shield, className: 'bg-primary/10 text-primary' },
  analyst: { label: 'Analista', icon: BarChart, className: 'bg-accent/10 text-accent' },
  viewer: { label: 'Viewer', icon: Eye, className: 'bg-muted text-muted-foreground' },
};

const statusConfig = {
  active: { label: 'Ativo', className: 'bg-success text-success-foreground' },
  inactive: { label: 'Inativo', className: 'bg-muted text-muted-foreground' },
  pending: { label: 'Pendente', className: 'bg-warning text-warning-foreground' },
};

const ClientUsers = () => {
  const { orgId } = useParams();
  const [searchQuery, setSearchQuery] = useState('');
  const users = getMockOrgUsers(orgId || '');

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Nunca';
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
          <h1 className="text-3xl font-bold text-foreground">Usuários</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os usuários da sua organização
          </p>
        </div>
        <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Plus className="w-4 h-4 mr-2" />
          Convidar Usuário
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Total</p>
            <p className="text-3xl font-bold text-foreground">{users.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Admins</p>
            <p className="text-3xl font-bold text-primary">
              {users.filter((u) => u.role === 'client_admin').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Analistas</p>
            <p className="text-3xl font-bold text-accent">
              {users.filter((u) => u.role === 'analyst').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Viewers</p>
            <p className="text-3xl font-bold text-muted-foreground">
              {users.filter((u) => u.role === 'viewer').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Usuários</CardTitle>
              <CardDescription>{filteredUsers.length} usuários encontrados</CardDescription>
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
                <TableHead>Usuário</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último Login</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const role = roleConfig[user.role];
                const status = statusConfig[user.status];
                const RoleIcon = role.icon;
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {user.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={role.className}>
                        <RoleIcon className="w-3 h-3 mr-1" />
                        {role.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={status.className}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(user.lastLogin)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Editar</DropdownMenuItem>
                          <DropdownMenuItem>Reenviar convite</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Remover</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

export default ClientUsers;
