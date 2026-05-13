import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrganizationBranding } from '@/contexts/OrganizationBrandingContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, LogOut } from 'lucide-react';

interface OrgAccessGateProps {
  children: React.ReactNode;
}

/**
 * Bloqueia o acesso ao painel do cliente quando a org está em um destes
 * estados:
 *   - status = 'suspended'                       → Acesso suspenso pelo admin
 *   - status = 'trial' AND trial_ends_at < now() → Trial expirado
 *
 * Platform admins NÃO são bloqueados — precisam continuar conseguindo
 * "ver como cliente" para diagnosticar/reativar.
 */
const OrgAccessGate = ({ children }: OrgAccessGateProps) => {
  const { organization } = useOrganizationBranding();
  const { isPlatformAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const blocker = useMemo(() => {
    if (!organization || isPlatformAdmin) return null;

    if (organization.status === 'suspended') {
      return {
        kind: 'suspended' as const,
        title: 'Acesso suspenso',
        description:
          'O acesso ao Pinn BAI desta organização foi suspenso. Entre em contato com o suporte Pinn para reativar.',
        icon: AlertTriangle,
      };
    }

    const trialEndsAt = (organization as { trial_ends_at?: string | null }).trial_ends_at ?? null;
    if (organization.status === 'trial' && trialEndsAt) {
      const expired = new Date(trialEndsAt).getTime() < Date.now();
      if (expired) {
        return {
          kind: 'trial-expired' as const,
          title: 'Período de trial encerrado',
          description:
            'O período de avaliação desta organização chegou ao fim. Entre em contato com a Pinn para contratar o plano e liberar o acesso.',
          icon: Clock,
        };
      }
    }

    return null;
  }, [organization, isPlatformAdmin]);

  if (!blocker) return <>{children}</>;

  const Icon = blocker.icon;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-border shadow-xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Icon className="w-7 h-7" />
          </div>
          <CardTitle className="text-2xl">{blocker.title}</CardTitle>
          <CardDescription>{blocker.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              await signOut();
              navigate('/login', { replace: true });
            }}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Suporte: <a href="mailto:suporte@pinn.com.br" className="underline">suporte@pinn.com.br</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrgAccessGate;
