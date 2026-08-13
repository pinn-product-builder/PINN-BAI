import { useLocation, Outlet } from "react-router-dom";
import { LayoutDashboard, Building2, FileText, Settings, type LucideIcon } from "lucide-react";
import { AppShell, type ShellNavGroup } from "@/components/shell/AppShell";

// Pinn SDR / LinkedIn SDR migraram para dentro da org Pinn Product Builder
// (rotas /client/:orgId/pinn-sdr e /linkedin-sdr). Por isso saíram daqui.
const baseNavItems: Array<{ path: string; label: string; icon: LucideIcon }> = [
  { path: "/admin/hq", label: "Command", icon: LayoutDashboard },
  { path: "/admin/organizations", label: "Organizações", icon: Building2 },
  { path: "/admin/templates", label: "Templates", icon: FileText },
  { path: "/admin/settings", label: "Configurações", icon: Settings },
];

const AdminLayout = () => {
  const location = useLocation();

  const nav: ShellNavGroup[] = [
    {
      label: "Plataforma",
      items: baseNavItems.map((i) => ({
        to: i.path,
        label: i.label,
        icon: i.icon,
        active: location.pathname.startsWith(i.path),
      })),
    },
  ];

  const activeLabel = baseNavItems.find((i) => location.pathname.startsWith(i.path))?.label;
  const breadcrumb = ["Admin", activeLabel ?? "Command"];

  const footer = (
    <div className="flex items-center gap-2.5 rounded-lg bg-sidebar-accent/60 px-2.5 py-2.5">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-primary bg-primary/[0.12] text-[11px] font-bold text-primary">
        A
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-semibold text-sidebar-foreground">Admin</div>
        <div className="text-[9px] uppercase tracking-[0.06em] text-muted-foreground">Plataforma</div>
      </div>
    </div>
  );

  return (
    <AppShell
      brand={{ name: "Pinn BAI", caption: "Admin Panel", initial: "P" }}
      nav={nav}
      breadcrumb={breadcrumb}
      footer={footer}
    >
      <Outlet />
    </AppShell>
  );
};

export default AdminLayout;
