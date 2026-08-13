import { useMemo, useState } from "react";
import { fmtMoney, fmtNum } from "@/bai/helpers";

/**
 * Linha de evidência da auditoria (chaves = `evidence_tables.rows` no backend).
 * Campos vêm do snapshot do CRM; valores podem faltar em payloads legados.
 */
export type EvidenceRow = {
  entity_type?: string;
  external_id?: unknown;
  name?: unknown;
  owner_name?: unknown;
  pipeline_name?: unknown;
  stage_name?: unknown;
  value?: number | null;
  days_stuck?: number | null;
  days_overdue?: number | null;
  updated_at?: string | null;
  problem?: string;
  severity?: string;
  recommendation?: string;
  lead_external_id?: unknown;
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

const PAGE_SIZE = 8;
const PAGE_STEP = 12;

type Props = {
  id: string;
  title: string;
  subtitle: string;
  rows: EvidenceRow[];
  universeTotal?: number;
  rowCap?: number;
  emptyHint: string;
};

/**
 * Tabela de evidências com busca, filtro de severidade e paginação incremental.
 * Estilo bai-* (src/bai-dashboard.css). ⚠️ Reconstruída a partir dos
 * consumidores e das classes CSS remanescentes (não constava no bundle antigo).
 */
export function EvidenceDataTable({ id, title, subtitle, rows, universeTotal, rowCap, emptyHint }: Props) {
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (severity && row.severity !== severity) return false;
        if (search) {
          const query = search.toLowerCase();
          return [row.name, row.owner_name, row.pipeline_name, row.stage_name, row.problem, row.external_id].some(
            (field) => String(field ?? "").toLowerCase().includes(query),
          );
        }
        return true;
      }),
    [rows, severity, search],
  );

  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  if (rows.length === 0) {
    return (
      <section id={id} className="bai-evidence-section">
        <div className="bai-evidence-head">
          <h3>{title}</h3>
          <p className="bai-muted-cap">{subtitle}</p>
        </div>
        <div className="bai-evidence-empty">
          <p className="bai-muted-cap">{emptyHint}</p>
        </div>
      </section>
    );
  }

  return (
    <section id={id} className="bai-evidence-section">
      <div className="bai-evidence-head">
        <h3>
          {title}
          {universeTotal != null ? ` · ${fmtNum(universeTotal)}` : ""}
        </h3>
        <p className="bai-muted-cap">{subtitle}</p>
      </div>

      <div className="bai-evidence-toolbar">
        <input
          className="bai-evidence-search"
          type="search"
          placeholder="Buscar…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setVisible(PAGE_SIZE);
          }}
        />
        <select
          className="bai-evidence-select"
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value);
            setVisible(PAGE_SIZE);
          }}
        >
          <option value="">Todas severidades</option>
          {(["critical", "high", "medium", "low"] as const).map((sev) => (
            <option key={sev} value={sev}>
              {SEVERITY_LABEL[sev]}
            </option>
          ))}
        </select>
      </div>

      <div className="bai-table-wrap">
        <table className="bai-table">
          <thead>
            <tr>
              {["Entidade", "Responsável", "Pipeline / Etapa", "Valor", "Última atividade", "Diagnóstico", "Sev.", "Ação"].map(
                (header) => (
                  <th key={header}>{header}</th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr key={i}>
                <td>
                  <strong>{String(row.name ?? "—")}</strong>
                  <p className="bai-muted-cap">
                    {String(row.entity_type ?? "")}
                    {row.external_id ? ` · #${String(row.external_id)}` : ""}
                  </p>
                </td>
                <td>{String(row.owner_name ?? "—")}</td>
                <td>
                  {String(row.pipeline_name ?? "—")}
                  <p className="bai-muted-cap">{String(row.stage_name ?? "—")}</p>
                </td>
                <td>{row.value != null && !Number.isNaN(Number(row.value)) ? fmtMoney(Number(row.value)) : "—"}</td>
                <td>
                  {row.days_stuck != null
                    ? `${fmtNum(Number(row.days_stuck))}d parado`
                    : row.days_overdue != null
                      ? `${fmtNum(Number(row.days_overdue))}d atraso`
                      : String(row.updated_at ?? "—").slice(0, 16)}
                </td>
                <td>{String(row.problem ?? "—")}</td>
                <td>
                  <span className={`bai-sev-pill bai-sev-${String(row.severity ?? "low")}`}>
                    {SEVERITY_LABEL[String(row.severity ?? "low")] ?? String(row.severity ?? "low")}
                  </span>
                </td>
                <td>{String(row.recommendation ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bai-evidence-foot">
        <p className="bai-muted-cap">
          Mostrando {shown.length} de {filtered.length}
          {filtered.length !== rows.length ? ` (filtrado de ${rows.length})` : ""}
          {universeTotal != null ? ` · universo: ${fmtNum(universeTotal)}` : ""}
          {rowCap != null && rows.length >= rowCap ? ` · amostra limitada a ${fmtNum(rowCap)} linhas` : ""}
        </p>
        {hasMore && (
          <button type="button" className="bai-evidence-more" onClick={() => setVisible((v) => v + PAGE_STEP)}>
            Carregar mais
          </button>
        )}
      </div>
    </section>
  );
}
