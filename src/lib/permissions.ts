import type { AppRole } from '@/contexts/AuthContext';

/**
 * RBAC fino por AÇÃO (F2). Os papéis (user_roles) já existem e gateiam ROTAS
 * no ProtectedRoute; aqui adicionamos permissões por ação pra gatear
 * botões/operações dentro das telas.
 *
 * Matriz definida pelo produto: viewer só lê, analyst edita dados, client_admin
 * gere usuários/config. Dashboards são montados pela Pinn → dashboard:edit fica
 * com platform_admin.
 */
export type Permission =
  | 'dashboard:edit'   // editar layout/widgets do dashboard
  | 'data:edit'        // importar/editar dados, disparar sync
  | 'org:manage'       // usuários, integrações, configurações da org
  | 'report:export';   // exportar relatório PDF

export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  viewer:         ['report:export'],
  analyst:        ['report:export', 'data:edit'],
  client_admin:   ['report:export', 'data:edit', 'org:manage'],
  platform_admin: ['report:export', 'data:edit', 'org:manage', 'dashboard:edit'],
};

/**
 * platform_admin = acesso total (inclui permissões futuras ainda não mapeadas).
 * Demais papéis: união das permissões dos papéis que o usuário possui.
 */
export function rolesHavePermission(roles: AppRole[], permission: Permission): boolean {
  if (roles.includes('platform_admin')) return true;
  return roles.some((r) => ROLE_PERMISSIONS[r]?.includes(permission));
}
