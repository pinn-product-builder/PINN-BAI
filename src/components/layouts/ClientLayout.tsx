import { Link, useParams, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  LayoutDashboard,
  Upload,
  Users,
  Settings,
  LogOut,
  Lightbulb,
  Database,
  ChevronDown,
} from 'lucide-react';
import { mockOrganizations } from '@/lib/mock-data';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const navItems = [
  { path: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: 'import', label: 'Importar Dados', icon: Upload },
  { path: 'datasets', label: 'Datasets', icon: Database },
  { path: 'insights', label: 'Insights IA', icon: Lightbulb },
  { path: 'users', label: 'Usuários', icon: Users },
  { path: 'settings', label: 'Configurações', icon: Settings },
];

const ClientLayout = () => {
  const { orgId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const currentOrg = mockOrganizations.find((org) => org.id === orgId);
  const currentPath = location.pathname.split('/').pop();

  if (!currentOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Organização não encontrada</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3 p-6 border-b border-sidebar-border">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-accent-foreground" />
            </div>
            <span className="text-xl font-bold text-sidebar-foreground">Pinn BAI</span>
          </div>

          {/* Organization Selector */}
          <div className="p-4 border-b border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
                      <span className="text-xs font-semibold text-primary">
                        {currentOrg.name.charAt(0)}
                      </span>
                    </div>
                    <span className="font-medium truncate max-w-[140px]">{currentOrg.name}</span>
                  </div>
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {mockOrganizations.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => navigate(`/client/${org.id}/dashboard`)}
                    className={cn(org.id === orgId && 'bg-accent')}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
                        <span className="text-xs font-semibold text-primary">
                          {org.name.charAt(0)}
                        </span>
                      </div>
                      <span>{org.name}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;
              return (
                <Link
                  key={item.path}
                  to={`/client/${orgId}/${item.path}`}
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
                  <span className="text-sm font-medium text-sidebar-accent-foreground">
                    {currentOrg.adminName.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-sidebar-foreground">
                    {currentOrg.adminName}
                  </p>
                  <p className="text-xs text-sidebar-foreground/60">Admin</p>
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

export default ClientLayout;
