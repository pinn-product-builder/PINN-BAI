import { Link, useParams, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Upload,
  Settings,
  LogOut,
  Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import AIChat from '@/components/ai/AIChat';
import ThemeToggle from '@/components/ThemeToggle';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';

const navItems = [
  { path: 'dashboard', label: 'Centro de Comando', icon: LayoutDashboard },
  { path: 'import', label: 'Conector de Dados', icon: Upload },
  { path: 'insights', label: 'Inteligência IA', icon: Lightbulb },
  { path: 'settings', label: 'White Label', icon: Settings },
];

const ClientLayout = () => {
  const { orgId } = useParams();
  const location = useLocation();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const navigate = useNavigate();
  const { organization, isLoading } = useTheme();
  const { profile, signOut } = useAuth();

  const currentPath = location.pathname.split('/').pop();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground animate-pulse">Carregando ambiente...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
            {organization?.logo_url ? (
              <img src={organization.logo_url} alt={organization.name} className="h-8 max-w-[160px] object-contain" />
            ) : (
              <img src="/pinn-logo.svg" alt="Pinn Logo" className="h-7 w-auto object-contain text-foreground" />
            )}
            {!organization?.logo_url && (
              <span className="text-lg font-heading font-bold text-sidebar-foreground truncate">
                {organization?.name || 'Pinn'}
              </span>
            )}
          </div>

          {/* Org badge */}
          <div className="px-4 py-3 border-b border-sidebar-border">
            <div className="px-3 py-2 rounded-xl bg-sidebar-accent border border-sidebar-border flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                {organization?.name.charAt(0) || 'O'}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-semibold text-sidebar-foreground truncate">{organization?.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">Enterprise</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;
              return (
                <Link
                  key={item.path}
                  to={`/client/${orgId}/${item.path}`}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all',
                    isActive
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/20'
                      : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                  )}
                >
                  <Icon className="w-[18px] h-[18px]" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User */}
          <div className="px-4 py-3 border-t border-sidebar-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">
                    {profile?.full_name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {profile?.full_name || 'Usuário'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-xl h-8 w-8"
                  onClick={() => signOut()}
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 min-h-screen">
        <Outlet />
      </main>

      {/* AI Chat FAB */}
      <div className="fixed bottom-6 right-8 z-50">
        {!isChatOpen && (
          <Button
            className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 hover:scale-110 transition-transform"
            onClick={() => setIsChatOpen(true)}
          >
            <Sparkles size={24} />
          </Button>
        )}
      </div>

      {isChatOpen && <AIChat onClose={() => setIsChatOpen(false)} />}
    </div>
  );
};

export default ClientLayout;
