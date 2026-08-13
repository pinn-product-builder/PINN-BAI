import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Bell, ChevronRight, LogOut, Menu, Moon, Search, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/theme/ThemeProvider";
import { CommandPalette, type CommandNavItem } from "./CommandPalette";

export interface ShellNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}
export interface ShellNavGroup {
  label?: string;
  items: ShellNavItem[];
}
export interface ShellBrand {
  name: string;
  logoUrl?: string | null;
  caption?: string;
  initial?: string;
}

interface AppShellProps {
  brand: ShellBrand;
  nav: ShellNavGroup[];
  breadcrumb: string[];
  /** Bloco acima da nav (ex.: "Voltar ao Admin"). */
  topSlot?: ReactNode;
  /** Rodapé da sidebar (bloco de usuário / logout). */
  footer: ReactNode;
  /** Barra de filtros global, renderizada entre a topbar e o conteúdo. */
  filterBar?: ReactNode;
  children: ReactNode;
}

/**
 * Shell único do produto (Fase 2 da repaginação): sidebar + topbar (breadcrumb,
 * busca ⌘K, notificações, tema, usuário) + área principal. Tailwind/shadcn puro
 * — aposenta o Drawer/AppBar MUI e o segundo conjunto de ícones. ClientLayout e
 * AdminLayout apenas compõem este shell com sua config de navegação.
 */
export function AppShell({ brand, nav, breadcrumb, topSlot, footer, filterBar, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const { theme, toggle } = useTheme();

  // Atalho global ⌘K / Ctrl+K.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const commandItems: CommandNavItem[] = useMemo(
    () =>
      nav.flatMap((g) =>
        g.items.map((i) => ({ label: i.label, to: i.to, group: g.label ?? "Navegação" })),
      ),
    [nav],
  );

  const sidebarInner = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col">
      {/* Marca / organização */}
      <div className="border-b border-sidebar-border px-4 pb-4 pt-5">
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt={brand.name} className="h-8 max-w-[140px] object-contain" />
        ) : (
          <img src="/pinn-logo.svg" alt="Pinn" className="h-8 w-auto" />
        )}
        <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-primary/20 bg-primary/[0.08] px-2.5 py-2">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">
            {brand.initial ?? brand.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold leading-tight text-sidebar-foreground">{brand.name}</div>
            {brand.caption && (
              <div className="text-[11px] text-muted-foreground">{brand.caption}</div>
            )}
          </div>
        </div>
      </div>

      {topSlot && <div className="px-3 pt-3">{topSlot}</div>}

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {nav.map((group, gi) => (
          <div key={group.label ?? gi} className={cn(gi > 0 && "mt-4")}>
            {group.label && (
              <div className="px-2.5 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                {group.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon, active }) => (
                <li key={to}>
                  <RouterLink
                    to={to}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors",
                      active
                        ? "bg-primary/10 font-semibold text-primary"
                        : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    )}
                  >
                    <Icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                    {label}
                  </RouterLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">{footer}</div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-[228px] flex-shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar-background md:block">
        {sidebarInner()}
      </aside>

      {/* Sidebar mobile (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[240px] border-sidebar-border bg-sidebar-background p-0">
          <SheetTitle className="sr-only">Navegação</SheetTitle>
          {sidebarInner(() => setMobileOpen(false))}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md md:px-6">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <nav aria-label="Trilha" className="hidden items-center gap-2 whitespace-nowrap text-[13px] text-muted-foreground sm:flex">
            {breadcrumb.map((crumb, i) => {
              const last = i === breadcrumb.length - 1;
              return (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
                  <span className={cn(last && "font-semibold text-foreground")}>{crumb}</span>
                </span>
              );
            })}
          </nav>

          {/* Busca ⌘K */}
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="ml-auto flex w-[min(320px,32vw)] items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:border-primary/40"
            aria-label="Buscar (atalho Command K)"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden truncate lg:inline">Buscar telas, métricas…</span>
            <kbd className="ml-auto rounded border border-border bg-secondary px-1.5 text-[11px]">⌘K</kbd>
          </button>

          {/* Notificações — estado honesto (sem backend de alertas ainda) */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="Notificações"
              >
                <Bell className="h-[17px] w-[17px]" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 text-sm">
              <p className="font-medium text-foreground">Notificações</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Sem novidades. Alertas de meta e queda de conversão chegam aqui em breve.
              </p>
            </PopoverContent>
          </Popover>

          {/* Tema */}
          <button
            type="button"
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
          >
            {theme === "dark" ? <Sun className="h-[17px] w-[17px]" /> : <Moon className="h-[17px] w-[17px]" />}
          </button>

          <TopbarUserMenu />
        </header>

        {filterBar}

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} items={commandItems} />
    </div>
  );
}

/** Menu do usuário na topbar: identidade + logout. Lê o auth diretamente (sempre dentro do AuthProvider). */
function TopbarUserMenu() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const initial = profile?.full_name?.charAt(0)?.toUpperCase() || profile?.email?.charAt(0)?.toUpperCase() || "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-[11px] font-semibold text-foreground hover:border-primary/40"
          aria-label="Menu do usuário"
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">
          <div className="font-semibold">{profile?.full_name || "Usuário"}</div>
          {profile?.email && <div className="truncate text-xs font-normal text-muted-foreground">{profile.email}</div>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            navigate("/login");
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
