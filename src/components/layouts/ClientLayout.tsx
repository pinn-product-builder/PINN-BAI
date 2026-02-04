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
  Layout,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import AIChat from '@/components/ai/AIChat';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';

const navItems = [
  { path: 'dashboard', label: 'Centro de Comando', icon: LayoutDashboard },
  { path: 'crm', label: 'Smart CRM', icon: Layout },
  { path: 'import', label: 'Conector de Dados', icon: Upload },
  { path: 'insights', label: 'Inteligência IA', icon: Lightbulb },
  { path: 'datasets', label: 'Fontes de Dados', icon: Database },
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
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground animate-pulse">Carregando ambiente premium...</p>
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
          <div className="flex items-center gap-3 p-6 border-b border-sidebar-border">
            {organization?.logo_url ? (
              <img src={organization.logo_url} alt="Logo" className="w-9 h-9 object-contain" />
            ) : (
              <img src="/pinn-logo.svg" alt="Pinn Logo" className="h-8 w-auto object-contain" />
            )}
            <span className="text-xl font-bold text-sidebar-foreground truncate">
              {organization?.name || 'Pinn BAI'}
            </span>
          </div>

          <div className="p-4 border-b border-sidebar-border">
            <div className="px-3 py-2 rounded-lg bg-sidebar-accent/50 border border-sidebar-border flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-accent-foreground font-bold">
                {organization?.name.charAt(0) || 'O'}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold text-sidebar-foreground truncate uppercase tracking-widest">Enterprise</p>
                <p className="text-[10px] text-sidebar-foreground/60 truncate">{organization?.name}</p>
              </div>
            </div>
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

          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-9 h-9 rounded-xl bg-sidebar-accent flex items-center justify-center border border-sidebar-border">
                  <span className="text-sm font-bold text-sidebar-accent-foreground">
                    {profile?.full_name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-bold text-sidebar-foreground truncate">
                    {profile?.full_name || 'Usuário'}
                  </p>
                  <p className="text-[10px] text-sidebar-foreground/60 uppercase font-mono">
                    Dashboard Access
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-xl"
                onClick={() => signOut()}
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

      {/* AI Chat Floating Action Button */}
      <div className="fixed bottom-6 right-8 z-50">
        {!isChatOpen && (
          <Button
            className="w-14 h-14 rounded-full bg-accent text-accent-foreground shadow-2xl shadow-accent/40 hover:scale-110 transition-transform animate-bounce-slow"
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
