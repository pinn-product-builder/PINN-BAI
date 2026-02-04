import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  Building2,
  LayoutTemplate,
  Users,
  Settings,
  LogOut,
  Activity,
  LayoutDashboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/admin/hq', label: 'Global HQ', icon: LayoutDashboard },
  { path: '/admin/organizations', label: 'Organizações', icon: Building2 },
  { path: '/admin/templates', label: 'Templates', icon: LayoutTemplate },
  { path: '/admin/users', label: 'Usuários', icon: Users },
  { path: '/admin/activity', label: 'Atividade', icon: Activity },
  { path: '/admin/settings', label: 'Configurações', icon: Settings },
];

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3 p-6 border-b border-sidebar-border">
            <img src="/pinn-logo.svg" alt="Pinn Logo" className="h-10 w-auto object-contain" />
            <div>
              <span className="text-xl font-bold text-sidebar-foreground hidden">Pinn BAI</span>
              <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-widest ml-1">Admin Panel</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
                  <span className="text-sm font-medium text-sidebar-accent-foreground">A</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-sidebar-foreground">Admin</p>
                  <p className="text-xs text-sidebar-foreground/60">Plataforma</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() => navigate('/login')}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
