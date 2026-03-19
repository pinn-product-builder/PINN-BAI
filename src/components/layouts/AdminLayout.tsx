import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Building2,
  LayoutTemplate,
  Users,
  Settings,
  LogOut,
  Activity,
  LayoutDashboard,
  Gauge,
  ChevronRight,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ThemeToggle from '@/components/ThemeToggle';

const navItems = [
  { path: '/admin/hq', label: 'Command', icon: LayoutDashboard },
  { path: '/admin/organizations', label: 'Organizações', icon: Building2 },
  { path: '/admin/templates', label: 'Templates', icon: LayoutTemplate },
  { path: '/admin/custom-metrics', label: 'Métricas', icon: Gauge },
  { path: '/admin/rfm-churn', label: 'RFM + Churn', icon: Target },
  { path: '/admin/users', label: 'Usuários', icon: Users },
  { path: '/admin/activity', label: 'Atividade', icon: Activity },
  { path: '/admin/settings', label: 'Config', icon: Settings },
];

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background flex" style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-[220px] flex flex-col bg-sidebar-background border-r border-sidebar-border">

        {/* Logo */}
        <div className="px-5 pt-6 pb-5 border-b border-sidebar-border">
          <img src="/pinn-logo.svg" alt="Pinn" className="h-8 w-auto" />
          <div className="mt-3 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/40 font-semibold">
              Admin Panel
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                )}
              >
                <Icon className={cn(
                  'w-4 h-4 shrink-0',
                  active ? 'text-primary' : 'text-sidebar-foreground/35 group-hover:text-sidebar-foreground/65'
                )} />
                <span>{label}</span>
                {active && <ChevronRight className="w-3 h-3 ml-auto text-primary/50" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-5 pt-4 space-y-2 border-t border-sidebar-border">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-sidebar-accent">
            <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-primary">A</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">Admin</p>
              <p className="text-[10px] text-sidebar-foreground/40 truncate">Plataforma</p>
            </div>
            <ThemeToggle />
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-sidebar-foreground/40 hover:text-destructive hover:bg-destructive/8 rounded-lg h-8 text-xs font-medium"
            onClick={async () => { await signOut(); navigate('/login'); }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </Button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="ml-[220px] flex-1 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
