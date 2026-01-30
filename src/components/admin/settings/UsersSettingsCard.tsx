import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Users, Plus, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { mockUsers, mockOrganizations, type User } from '@/lib/mock-data';

const UsersSettingsCard = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    role: 'analyst' as User['role'],
    orgId: '' as string,
  });

  const handleCreateUser = async () => {
    setIsCreating(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const newUser: User = {
      id: `user-${Date.now()}`,
      name: newUserData.name,
      email: newUserData.email,
      role: newUserData.role,
      orgId: newUserData.orgId || null,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    setUsers([...users, newUser]);
    setNewUserData({ name: '', email: '', role: 'analyst', orgId: '' });
    setIsDialogOpen(false);
    setIsCreating(false);

    toast({
      title: 'Usuário criado',
      description: `${newUser.name} foi adicionado ao sistema.`,
    });
  };

  const handleDeleteUser = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    setUsers(users.filter((u) => u.id !== userId));
    toast({
      title: 'Usuário removido',
      description: `${user?.name} foi removido.`,
      variant: 'destructive',
    });
  };

  const handleToggleActive = (userId: string) => {
    setUsers(users.map((user) =>
      user.id === userId ? { ...user, isActive: !user.isActive } : user
    ));
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'platform_admin':
        return <Badge className="bg-primary/10 text-primary border-primary/20">Admin Plataforma</Badge>;
      case 'client_admin':
        return <Badge className="bg-accent/10 text-accent border-accent/20">Admin Cliente</Badge>;
      case 'analyst':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Analista</Badge>;
      case 'viewer':
        return <Badge variant="secondary">Viewer</Badge>;
      default:
        return null;
    }
  };

  const getOrgName = (orgId: string | null) => {
    if (!orgId) return 'Plataforma';
    const org = mockOrganizations.find((o) => o.id === orgId);
    return org?.name || 'N/A';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>Gestão de Usuários</CardTitle>
              <CardDescription>Gerencie todos os usuários da plataforma</CardDescription>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Plus className="w-4 h-4 mr-2" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Criar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Adicione um novo usuário ao sistema
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="user-name">Nome</Label>
                    <Input
                      id="user-name"
                      placeholder="Nome completo"
                      value={newUserData.name}
                      onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-email">Email</Label>
                    <Input
                      id="user-email"
                      type="email"
                      placeholder="email@empresa.com"
                      value={newUserData.email}
                      onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="user-role">Papel</Label>
                    <Select
                      value={newUserData.role}
                      onValueChange={(value) => setNewUserData({ ...newUserData, role: value as User['role'] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="platform_admin">Admin Plataforma</SelectItem>
                        <SelectItem value="client_admin">Admin Cliente</SelectItem>
                        <SelectItem value="analyst">Analista</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-org">Organização</Label>
                    <Select
                      value={newUserData.orgId}
                      onValueChange={(value) => setNewUserData({ ...newUserData, orgId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Nenhuma (Plataforma)</SelectItem>
                        {mockOrganizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateUser}
                  disabled={isCreating || !newUserData.name || !newUserData.email}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    'Criar Usuário'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {users.map((user, index) => (
          <div key={user.id}>
            {index > 0 && <Separator className="my-3" />}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs">
                    {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground text-sm">{user.name}</p>
                    {getRoleBadge(user.role)}
                    {!user.isActive && (
                      <Badge variant="outline" className="text-muted-foreground">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {user.email} • {getOrgName(user.orgId)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={user.isActive ? 'active' : 'inactive'}
                  onValueChange={() => handleToggleActive(user.id)}
                >
                  <SelectTrigger className="w-24 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      disabled={user.role === 'platform_admin'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover Usuário</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja remover <strong>{user.name}</strong>?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteUser(user.id)}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default UsersSettingsCard;
