import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Search,
  MoreHorizontal,
  Shield,
  Users as UsersIcon,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  UserCheck,
  UserX,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  usePlatformUsers,
  useResetUserPassword,
  useSetUserActive,
  type PlatformUserRow,
} from '@/hooks/usePlatformUsers';

type RoleVisual = { label: string; icon: typeof Shield; className: string };

const roleVisuals: Record<string, RoleVisual> = {
  platform_admin: { label: 'Platform Admin', icon: Shield,    className: 'bg-primary/10 text-primary border-primary/20' },
  client_admin:   { label: 'Client Admin',   icon: UsersIcon, className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  analyst:        { label: 'Analyst',        icon: UsersIcon, className: 'bg-violet-500/10 text-violet-500 border-violet-500/20' },
  viewer:         { label: 'Viewer',         icon: UsersIcon, className: 'bg-muted text-muted-foreground border-border' },
};

const formatDate = (iso: string | null) => {
  if (!iso) return 'Nunca acessou';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const initials = (name: string | null, email: string | null) => {
  const source = name?.trim() || email || '?';
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
};

const AdminUsers = () => {
  const { toast } = useToast();
  const { data: users = [], isLoading, error, refetch } = usePlatformUsers();
  const resetPassword = useResetUserPassword();
  const setActive = useSetUserActive();

  const [searchQuery, setSearchQuery] = useState('');

  // Reset password modal state
  const [pwdDialog, setPwdDialog] = useState<PlatformUserRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Toggle access alert state
  const [toggleTarget, setToggleTarget] = useState<PlatformUserRow | null>(null);

  const filteredUsers = useMemo(
    () =>
      users.filter((u) => {
        const q = searchQuery.toLowerCase();
        if (!q) return true;
        return (
          (u.full_name ?? '').toLowerCase().includes(q) ||
          (u.email ?? '').toLowerCase().includes(q) ||
          (u.org_name ?? '').toLowerCase().includes(q)
        );
      }),
    [users, searchQuery],
  );

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.roles.includes('platform_admin')).length;
    const active = users.filter((u) => u.is_active).length;
    const clients = users.filter((u) => u.roles.includes('client_admin')).length;
    return { total, admins, active, clients };
  }, [users]);

  const handleResetPassword = async () => {
    if (!pwdDialog) return;
    if (newPassword.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A nova senha precisa ter ao menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await resetPassword.mutateAsync({ userId: pwdDialog.id, newPassword });
      toast({
        title: 'Senha redefinida',
        description: `A senha de ${pwdDialog.email} foi atualizada.`,
      });
      setPwdDialog(null);
      setNewPassword('');
    } catch (err) {
      toast({
        title: 'Erro ao redefinir senha',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async () => {
    if (!toggleTarget) return;
    const next = !toggleTarget.is_active;
    try {
      await setActive.mutateAsync({ userId: toggleTarget.id, isActive: next });
      toast({
        title: next ? 'Acesso reativado' : 'Acesso suspenso',
        description: `${toggleTarget.email} ${next ? 'pode entrar normalmente' : 'foi bloqueado de logar no BAI'}.`,
      });
      setToggleTarget(null);
    } catch (err) {
      toast({
        title: 'Erro ao atualizar acesso',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-foreground">Usuários da Plataforma</h1>
          <p className="text-muted-foreground mt-1">
            Lista real de admins e clientes do Pinn BAI — gerenciados via Supabase Auth.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <UsersIcon className="w-4 h-4 mr-2" />
          )}
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-3xl font-bold text-foreground">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <UsersIcon className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Platform Admins</p>
                <p className="text-3xl font-bold text-foreground">{stats.admins}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Client Admins</p>
                <p className="text-3xl font-bold text-blue-500">{stats.clients}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <UsersIcon className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ativos</p>
                <p className="text-3xl font-bold text-emerald-500">{stats.active}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle>Lista de Usuários</CardTitle>
              <CardDescription>{filteredUsers.length} usuário(s) encontrado(s)</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou org..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {error ? (
            <div className="text-center py-10 text-destructive text-sm">
              Erro ao carregar usuários: {(error as Error).message}
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground italic">
              Nenhum usuário encontrado.
            </div>
          ) : (
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Organização</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último Login</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const primaryRole = user.roles[0] ?? 'viewer';
                  const visual = roleVisuals[primaryRole] ?? roleVisuals.viewer;
                  const RoleIcon = visual.icon;
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-9 w-9">
                            {user.avatar_url ? (
                              <AvatarImage src={user.avatar_url} alt={user.full_name ?? user.email ?? ''} />
                            ) : null}
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {initials(user.full_name, user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {user.full_name || '—'}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        {user.org_name || (
                          <span className="text-muted-foreground italic text-xs">Sem org</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.length === 0 ? (
                            <Badge variant="outline" className="text-muted-foreground">Sem role</Badge>
                          ) : (
                            user.roles.map((role) => {
                              const v = roleVisuals[role] ?? roleVisuals.viewer;
                              const Icon = v.icon;
                              return (
                                <Badge key={role} variant="outline" className={v.className}>
                                  <Icon className="w-3 h-3 mr-1" />
                                  {v.label}
                                </Badge>
                              );
                            })
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            user.is_active
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              : 'bg-red-500/10 text-red-500 border-red-500/20'
                          }
                          variant="outline"
                        >
                          {user.is_active ? 'Ativo' : 'Suspenso'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDate(user.last_sign_in_at)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem
                              onClick={() => {
                                setPwdDialog(user);
                                setNewPassword('');
                                setShowPassword(false);
                              }}
                            >
                              <KeyRound className="w-4 h-4 mr-2" />
                              Trocar senha
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setToggleTarget(user)}
                              className={user.is_active ? 'text-destructive' : 'text-emerald-600'}
                            >
                              {user.is_active ? (
                                <>
                                  <UserX className="w-4 h-4 mr-2" />
                                  Suspender acesso
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-4 h-4 mr-2" />
                                  Reativar acesso
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reset password dialog */}
      <Dialog
        open={pwdDialog != null}
        onOpenChange={(open) => {
          if (!open) {
            setPwdDialog(null);
            setNewPassword('');
            setShowPassword(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir nova senha</DialogTitle>
            <DialogDescription>
              Você está alterando a senha de <strong>{pwdDialog?.email}</strong>. O usuário terá
              que usar essa nova senha no próximo login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="new-password">Nova senha</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdDialog(null)} disabled={resetPassword.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={resetPassword.isPending || newPassword.length < 6}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {resetPassword.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar nova senha'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toggle access alert */}
      <AlertDialog
        open={toggleTarget != null}
        onOpenChange={(open) => !open && setToggleTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleTarget?.is_active ? 'Suspender acesso?' : 'Reativar acesso?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleTarget?.is_active
                ? `Ao suspender, ${toggleTarget?.email} não conseguirá mais entrar no Pinn BAI. Você pode reativar a qualquer momento.`
                : `Reativando ${toggleTarget?.email}, o usuário voltará a conseguir logar no BAI normalmente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={setActive.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleToggleActive();
              }}
              disabled={setActive.isPending}
              className={
                toggleTarget?.is_active
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }
            >
              {setActive.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Aplicando...
                </>
              ) : toggleTarget?.is_active ? (
                'Sim, suspender'
              ) : (
                'Sim, reativar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsers;
