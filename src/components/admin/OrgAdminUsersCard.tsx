import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  usePlatformUsers,
  useResetUserPassword,
  useUpdateUserEmail,
  type PlatformUserRow,
} from '@/hooks/usePlatformUsers';
import {
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  UserX,
  Users,
} from 'lucide-react';

interface OrgAdminUsersCardProps {
  orgId: string;
}

type DialogMode = 'password' | 'email' | null;

const roleLabel = (role: string): string => {
  switch (role) {
    case 'platform_admin':
      return 'Platform Admin';
    case 'client_admin':
      return 'Admin do Cliente';
    case 'analyst':
      return 'Analista';
    case 'viewer':
      return 'Visualizador';
    default:
      return role;
  }
};

const roleClass = (role: string): string => {
  switch (role) {
    case 'platform_admin':
      return 'bg-primary/10 text-primary border-primary/20';
    case 'client_admin':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'analyst':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

const OrgAdminUsersCard = ({ orgId }: OrgAdminUsersCardProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: users, isLoading } = usePlatformUsers();
  const resetPassword = useResetUserPassword();
  const updateEmail = useUpdateUserEmail();

  const [activeUser, setActiveUser] = useState<PlatformUserRow | null>(null);
  const [mode, setMode] = useState<DialogMode>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  const orgUsers = useMemo(
    () => (users ?? []).filter((u) => u.org_id === orgId),
    [users, orgId],
  );

  const openPasswordDialog = (user: PlatformUserRow) => {
    setActiveUser(user);
    setMode('password');
    setNewPassword('');
    setShowPassword(false);
  };

  const openEmailDialog = (user: PlatformUserRow) => {
    setActiveUser(user);
    setMode('email');
    setNewEmail(user.email ?? '');
  };

  const closeDialog = () => {
    setActiveUser(null);
    setMode(null);
    setNewPassword('');
    setNewEmail('');
    setShowPassword(false);
  };

  const submitPassword = async () => {
    if (!activeUser) return;
    if (newPassword.length < 6) {
      toast({ title: 'Senha muito curta', description: 'Use ao menos 6 caracteres.', variant: 'destructive' });
      return;
    }
    try {
      await resetPassword.mutateAsync({ userId: activeUser.id, newPassword });
      toast({ title: 'Senha trocada', description: `${activeUser.email ?? 'Usuário'} já pode entrar com a nova senha.` });
      closeDialog();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha desconhecida';
      toast({ title: 'Erro ao trocar senha', description: message, variant: 'destructive' });
    }
  };

  const submitEmail = async () => {
    if (!activeUser) return;
    const trimmed = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast({ title: 'E-mail inválido', description: 'Confira o formato do e-mail.', variant: 'destructive' });
      return;
    }
    if (trimmed === (activeUser.email ?? '').toLowerCase()) {
      toast({ title: 'Sem alterações', description: 'O e-mail informado é igual ao atual.' });
      return;
    }
    try {
      await updateEmail.mutateAsync({ userId: activeUser.id, newEmail: trimmed });
      toast({ title: 'E-mail atualizado', description: `Login agora é ${trimmed}.` });
      closeDialog();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha desconhecida';
      toast({ title: 'Erro ao trocar e-mail', description: message, variant: 'destructive' });
    }
  };

  return (
    <>
      <Card className="border border-border bg-card/80 backdrop-blur-xl shadow-sm">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-foreground">Acessos & Credenciais</CardTitle>
              <CardDescription>
                Usuários vinculados a esta organização. Troque o e-mail de login ou redefina a senha sem precisar
                pedir reset por e-mail.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="py-10 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : orgUsers.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed border-border rounded-2xl space-y-3">
              <UserX className="w-8 h-8 text-muted-foreground mx-auto" />
              <div>
                <p className="font-medium text-foreground">Nenhum usuário vinculado a esta org</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cadastre um admin pela tela de Usuários da plataforma para começar.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/users')}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Ir para Usuários
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
              {orgUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-card hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground truncate">
                        {user.full_name || 'Sem nome'}
                      </p>
                      {!user.is_active && (
                        <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px] uppercase">
                          Suspenso
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{user.email ?? '—'}</p>
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      {user.roles.length === 0 ? (
                        <Badge variant="outline" className="text-[10px]">sem role</Badge>
                      ) : (
                        user.roles.map((r) => (
                          <Badge
                            key={r}
                            variant="outline"
                            className={`text-[10px] ${roleClass(r)}`}
                          >
                            {r === 'platform_admin' && <ShieldCheck className="w-3 h-3 mr-1" />}
                            {roleLabel(r)}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEmailDialog(user)}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Trocar e-mail
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPasswordDialog(user)}
                    >
                      <KeyRound className="w-4 h-4 mr-2" />
                      Trocar senha
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={mode !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === 'password' ? 'Trocar senha' : 'Trocar e-mail de login'}
            </DialogTitle>
            <DialogDescription>
              {activeUser?.full_name || activeUser?.email}
              {mode === 'password' && (
                <> — defina uma nova senha. O usuário entra com ela imediatamente.</>
              )}
              {mode === 'email' && (
                <> — o novo e-mail será o login. O usuário recebe automaticamente como confirmado.</>
              )}
            </DialogDescription>
          </DialogHeader>

          {mode === 'password' && (
            <div className="space-y-2">
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}

          {mode === 'email' && (
            <div className="space-y-2">
              <Label htmlFor="new-email">Novo e-mail</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Atual: <span className="font-mono">{activeUser?.email ?? '—'}</span>
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDialog}
              disabled={resetPassword.isPending || updateEmail.isPending}
            >
              Cancelar
            </Button>
            {mode === 'password' && (
              <Button
                onClick={submitPassword}
                disabled={resetPassword.isPending || newPassword.length < 6}
              >
                {resetPassword.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <KeyRound className="w-4 h-4 mr-2" />
                )}
                Salvar senha
              </Button>
            )}
            {mode === 'email' && (
              <Button onClick={submitEmail} disabled={updateEmail.isPending}>
                {updateEmail.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                Salvar e-mail
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OrgAdminUsersCard;
