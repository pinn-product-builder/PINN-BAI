import { useAuth } from '@/contexts/AuthContext';
import { rolesHavePermission, type Permission } from '@/lib/permissions';

/**
 * Hook de RBAC fino: `can('dashboard:edit')` etc. Deriva dos papéis do usuário
 * (user_roles via useAuth). Use pra gatear ações dentro das telas.
 */
export function usePermissions() {
  const { roles } = useAuth();
  return {
    can: (permission: Permission) => rolesHavePermission(roles, permission),
  };
}
