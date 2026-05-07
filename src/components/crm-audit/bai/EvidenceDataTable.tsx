/**
 * Tabela de evidências com busca, filtros e paginação local.
 * Colunas alinhadas ao payload `evidence_tables.rows` do backend.
 */
import { useMemo, useState } from "react";
import { fmtMoney, fmtNum } from "@/bai/helpers";

export type EvidenceRow = Record<string, unknown>;

const INITIAL_VISIBLE = 8;
const PAGE_SIZE = 12;

const SEV_OPTS = [
  { value: "", label: "Todas severidades" },
  { value: "critical", label: "Crítico" },
  { value: "high", label: "Alto" },
  { value: "medium", label: "Médio" },
  { value: "low", label: "Baixo" },
];

function severityLabel(s: string): string {
  const m: Record<string, string> = {
    critical: "Crítico",
    high: "Alto",
    medium: "Médio",
    low: "Baixo",
  };
  return m[s] ?? s;
}

function sevPillClass(sev: string): string {
  const s = (sev || "low").toLowerCase();
  const map: Record<string, string> = {
    critical: "bai-sev-pill bai-sev-critical",
    high: "bai-sev-pill bai-sev-high",
    medium: "bai-sev-pill bai-sev-medium",
    low: "bai-sev-pill bai-sev-low",
  };
  return map[s] ?? "bai-sev-pill bai-sev-low";
}

function rowMatchesSearch(r: EvidenceRow, q: string): boolean {
  if (!q.trim()) return true;
  const needle = q.trim().toLowerCase();
  const parts = [
    r.name,
    r.owner_name,
    r.pipeline_name,
    r.stage_name,
    r.problem,
    r.external_id,
    r.entity_type,
    r.lead_external_id,
    r.contacts_preview,
  ];
  return parts.some((p) => String(p ?? "").toLowerCase().includes(needle));
}

function fmtWhen(r: EvidenceRow): string {
  const entity = String(r.entity_type ?? "");
  if (entity === "task") {
    const due = r.updated_at as string | undefined;
    const d = r.days_overdue;
    if (due && d != null) return `${due.slice(0, 16)} · ${fmtNum(Number(d))}d atraso`;
    return due ? due.slice(0, 19) : "—";
  }
  if (entity === "stage") {
    const pct = r.pct_of_open_pipeline;
    const cnt = r.open_leads_in_stage;
    if (pct != null && cnt != null) return `${fmtNum(Number(cnt))} abertas · ${Number(pct).toFixed(1)}% do total`;
    return "—";
  }
  const u = r.updated_at as string | undefined;
  if (!u) return "—";
  const ds = r.days_stuck;
  if (ds != null) return `${u.slice(0, 16)} · ${fmtNum(Number(ds))}d parado`;
  return u.slice(0, 19);
}

function fmtVal(r: EvidenceRow): string {
  const v = r.value;
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return fmtMoney(n);
}

type Props = {
  id?: string;
  title: string;
  subtitle?: string;
  rows: EvidenceRow[];
  universeTotal?: number;
  emptyHint: string;
  rowCap?: number;
};

export function EvidenceDataTable({ id, title, subtitle, rows, universeTotal, emptyHint, rowCap }: Props) {
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");
  const [owner, setOwner] = useState("");
  const [visible, setVisible] = useState(INITIAL_VISIBLE);

  const owners = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      const o = String(r.owner_name ?? "").trim();
      if (o) s.add(o);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (severity && String(r.severity ?? "") !== severity) return false;
      if (owner && String(r.owner_name ?? "") !== owner) return false;
      if (!rowMatchesSearch(r, search)) return false;
      return true;
    });
  }, [rows, severity, owner, search]);

  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  const emptyMain = rows.length === 0;
  const emptyFiltered = !emptyMain && filtered.length === 0;

  const footNote =
    universeTotal != null && rowCap != null && universeTotal > rowCap
      ? `Universo do CRM: ${universeTotal} registro(s). Até ${rowCap} linhas neste payload.`
      : universeTotal != null
        ? `${universeTotal} registro(s) neste recorte.`
        : null;

  return (
    <section id={id} className="bai-evidence-section">
      <div className="bai-evidence-head" style={{ marginBottom: "0.85rem" }}>
        <h3>{title}</h3>
        {subtitle ? <p className="bai-muted-cap">{subtitle}</p> : null}
        {footNote ? <p className="bai-muted-cap" style={{ marginTop: "0.35rem" }}>{footNote}</p> : null}
      </div>

      <div className="bai-evidence-toolbar">
        <input
          type="search"
          placeholder="Buscar nesta lista…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setVisible(INITIAL_VISIBLE);
          }}
          className="bai-evidence-search"
          aria-label="Buscar evidências"
        />
        <select
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value);
            setVisible(INITIAL_VISIBLE);
          }}
          className="bai-evidence-select"
          aria-label="Filtrar por severidade"
        >
          {SEV_OPTS.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={owner}
          onChange={(e) => {
            setOwner(e.target.value);
            setVisible(INITIAL_VISIBLE);
          }}
          className="bai-evidence-select"
          aria-label="Filtrar por responsável"
          disabled={owners.length === 0}
        >
          <option value="">Todos os responsáveis</option>
          {owners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {emptyMain ? (
        <div className="bai-evidence-empty">
          <p style={{ margin: "0 0 6px", fontWeight: 700, color: "var(--pinn-text-secondary)", fontSize: "0.88rem" }}>Nada para listar</p>
          <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--pinn-text-muted)", lineHeight: 1.45 }}>{emptyHint}</p>
        </div>
      ) : emptyFiltered ? (
        <div className="bai-evidence-empty">
          <p style={{ margin: "0 0 6px", fontWeight: 700, color: "var(--pinn-text-secondary)", fontSize: "0.88rem" }}>Sem resultados</p>
          <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--pinn-text-muted)", lineHeight: 1.45 }}>Ajuste busca, severidade ou responsável.</p>
        </div>
      ) : (
        <>
          <div className="bai-table-wrap" style={{ overflowX: "auto" }}>
            <table className="bai-table">
              <thead>
                <tr>
                  <th>Entidade</th>
                  <th>Responsável</th>
                  <th>Pipeline</th>
                  <th>Etapa</th>
                  <th>Valor</th>
                  <th>Prazo / contexto</th>
                  <th>Diagnóstico</th>
                  <th>Severidade</th>
                  <th>Recomendação</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => (
                  <tr key={`${String(r.external_id)}-${String(r.entity_type)}-${i}`}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--pinn-text-primary)" }}>{String(r.name ?? "—")}</div>
                      <div className="bai-muted-cap" style={{ marginTop: 4 }}>
                        {String(r.entity_type ?? "")}
                        {r.external_id != null ? ` · ${String(r.external_id)}` : ""}
                      </div>
                    </td>
                    <td>{String(r.owner_name ?? "—")}</td>
                    <td>{String(r.pipeline_name ?? "—")}</td>
                    <td>{String(r.stage_name ?? "—")}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{fmtVal(r)}</td>
                    <td style={{ fontSize: "0.82rem", color: "var(--pinn-text-secondary)" }}>{fmtWhen(r)}</td>
                    <td style={{ fontSize: "0.82rem", maxWidth: 220, color: "var(--pinn-text-secondary)" }}>{String(r.problem ?? "—")}</td>
                    <td>
                      <span className={sevPillClass(String(r.severity ?? ""))}>{severityLabel(String(r.severity ?? ""))}</span>
                    </td>
                    <td style={{ fontSize: "0.82rem", maxWidth: 260, color: "var(--pinn-text-muted)", lineHeight: 1.45 }}>{String(r.recommendation ?? "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bai-evidence-foot">
            <span className="bai-muted-cap" style={{ margin: 0 }}>
              Mostrando {shown.length} de {filtered.length}
              {filtered.length !== rows.length ? ` (filtrado de ${rows.length})` : ""}
              {universeTotal != null ? ` · universo: ${universeTotal}` : ""}
            </span>
            {hasMore ? (
              <button type="button" className="bai-evidence-more" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Carregar mais linhas
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
