import type { DashboardTheme } from "@/hooks/useDashboardTheme";

export function DashboardHeader({
  productName,
  snapshotLabel,
  statusLabel,
  loading,
  theme,
  onToggleTheme,
  onRefresh,
  onAnalyze,
  onExportPlaceholder,
}: {
  productName: string;
  snapshotLabel: string | null;
  statusLabel: string;
  loading: boolean;
  theme: DashboardTheme;
  onToggleTheme: () => void;
  onRefresh: () => void;
  onAnalyze: () => void;
  onExportPlaceholder: () => void;
}) {
  return (
    <header className="bai-product-header">
      <div style={{ flex: "1 1 280px", minWidth: 0 }}>
        <div className="bai-product-badge">Auditoria comercial · BAI</div>
        <h1 className="bai-product-title">{productName}</h1>
        <p className="bai-product-meta">
          Kommo via Composio · último snapshot{" "}
          {snapshotLabel ?? <span className="bai-text-muted-inline">aguardando coleta</span>}
        </p>
        <div className="bai-status-pill">
          <span className={`bai-status-dot ${loading ? "bai-status-dot--loading" : "bai-status-dot--ok"}`} aria-hidden />
          <span>{statusLabel}</span>
        </div>
      </div>
      <div className="bai-header-actions">
        <button
          type="button"
          className="bai-btn bai-btn-ghost"
          onClick={onToggleTheme}
          aria-pressed={theme === "light"}
          title={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
        >
          {theme === "dark" ? "Modo claro" : "Modo escuro"}
        </button>
        <button type="button" className="bai-btn bai-btn-ghost" onClick={onRefresh} disabled={loading}>
          Atualizar dados
        </button>
        <button type="button" className="bai-btn bai-btn-primary" onClick={onAnalyze} disabled={loading}>
          Gerar parecer IA
        </button>
        <button type="button" className="bai-btn bai-btn-outline" onClick={onExportPlaceholder} disabled={loading} title="Em roadmap: export PDF / pacote">
          Exportar auditoria
        </button>
      </div>
    </header>
  );
}
