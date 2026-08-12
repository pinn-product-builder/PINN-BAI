import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import type { Permission } from '@/lib/permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';

/**
 * Gate de RBAC fino por AÇÃO em torno de uma área de gestão. Diferente do
 * ProtectedRoute (que gateia por papel a entrada da rota), aqui gateamos pela
 * PERMISSÃO derivada do papel — ex.: viewer não acessa Import/Integrações.
 *
 * Usar envolvendo o conteúdo de telas de escrita (data:edit / org:manage).
 */
const RequirePermission = ({
  permission,
  children,
}: {
  permission: Permission;
  children: JSX.Element;
}) => {
  const { can } = usePermissions();
  const { isLoading } = useAuth();

  if (isLoading) return null;
  if (can(permission)) return children;

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-border shadow-xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <CardTitle className="text-2xl">Sem permissão</CardTitle>
          <CardDescription>
            Seu perfil não tem acesso a esta área. Fale com o administrador da sua organização
            para solicitar a permissão necessária.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
};

export default RequirePermission;
