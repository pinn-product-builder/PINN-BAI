import { useAuth, AppRole } from '@/contexts/AuthContext';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
  fallback?: React.ReactNode;
}

/**
 * Component that conditionally renders children based on user roles.
 * Platform admins always have access.
 */
const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  allowedRoles,
  fallback = null,
}) => {
  const { roles, isPlatformAdmin } = useAuth();

  // Platform admins always have access
  if (isPlatformAdmin) {
    return <>{children}</>;
  }

  // Check if user has at least one of the allowed roles
  const hasAccess = allowedRoles.some((role) => roles.includes(role));

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default RoleGuard;
