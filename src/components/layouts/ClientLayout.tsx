import { Link, useParams, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Upload, Settings, LogOut, Lightbulb, Sparkles, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import AIChat from '@/components/ai/AIChat';
import ThemeToggle from '@/components/ThemeToggle';
import { useState } from 'react';

const navItems = [
  { path: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: 'import', label: 'Dados', icon: Upload },
  { path: 'insights', label: 'Inteligência IA', icon: Lightbulb },
  { path: 'rfm-churn', label: 'RFM + Churn', icon: Target },
  { path: 'settings', label: 'White Label', icon: Settings },
];

const ClientLayout = () => {
  const { orgId } = useParams();
  const location = useLocation();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { organization, isLoading } = useTheme();
  const { profile, signOut } = useAuth();

  const currentPath = location.pathname.split('/').pop();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-[11px] text-muted-foreground tracking-widest uppercase">Carregando...</p>
        </div>
      </div>
    );
  }

  const orgInitial = organization?.name?.charAt(0)?.toUpperCase() || 'O';

  return (
    <div className="min-h-screen bg-background flex" style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-[220px] flex flex-col bg-sidebar-background border-r border-sidebar-border">

        {/* Logo + Org */}
        <div className="px-5 pt-6 pb-4 border-b border-sidebar-border">
          {organization?.logo_url
            ? <img src={organization.logo_url} alt={organization.name} className="h-8 max-w-[140px] object-contain" />
            : <img src="/pinn-logo.svg" alt="Pinn" className="h-8 w-auto" />
          }

          {/* Org pill */}
          <div className="mt-4 flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-primary/8 border border-primary/15">
            <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 bg-primary text-white">
              {orgInitial}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-sidebar-foreground truncate leading-tight">
                {organization?.name || 'Organização'}
              </p>
              <p className="text-[9px] text-sidebar-foreground/40 uppercase tracking-wider">Enterprise</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = currentPath === path;
            return (
              <Link
                key={path}
                to={`/client/${orgId}/${path}`}
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
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-5 pt-4 space-y-2 border-t border-sidebar-border">
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-sidebar-accent">
            <div className="w-7 h-7 rounded-lg bg-sidebar-border flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-sidebar-foreground">
                {profile?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">
                {profile?.full_name || 'Usuário'}
              </p>
              <p className="text-[9px] text-sidebar-foreground/40 uppercase tracking-wider">Dashboard</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 rounded-lg text-sidebar-foreground/30 hover:text-destructive hover:bg-destructive/8"
                onClick={() => signOut()}
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="ml-[220px] flex-1 min-h-screen">
        <Outlet />
      </main>

      {/* ── AI Chat FAB ── */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isChatOpen && (
          <button
            onClick={() => setIsChatOpen(true)}
            className="w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-all duration-200 hover:scale-110 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #FF6900, #FCB900)',
              boxShadow: '0 4px 16px rgba(255,105,0,0.30)',
            }}
            aria-label="Abrir IA"
          >
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </button>
        )}
      </div>

      {isChatOpen && <AIChat onClose={() => setIsChatOpen(false)} />}
    </div>
  );
};

export default ClientLayout;
