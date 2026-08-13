/**
 * dashboardSnapshot — captura o estado renderizado AGORA do dashboard a partir
 * do cache do React Query, para injetar como contexto no BAI Copilot
 * (edge function ai-data-chat, seção "Métricas visíveis na sessão").
 *
 * Sem isso a IA recomputava métricas a partir de dados crus e divergia do que
 * o usuário vê na tela (ex.: taxa de conversão 22% vs 1,1% no widget).
 *
 * Reconstruído fielmente a partir do bundle de produção
 * (dist/assets/index-*.js, build de 05/jul/2026).
 */
import type { QueryClient } from "@tanstack/react-query";

/** Prefixos de queryKey considerados relevantes para o contexto do copiloto. */
const RELEVANT_KEY_PREFIXES = [
  "widget-snapshot",
  "crm-audit-dashboard",
  "org-dashboards",
  "dashboard-widgets",
  "kpi-",
  "leads-count",
  "conversion-",
  "revenue",
  "forecast",
  "customer-health",
  "customer-alerts",
  "rfm",
  "churn",
  "paid-traffic",
  "integrations",
  "goals",
  "unit-economics",
];

/** Orçamento por entrada e total (em caracteres de JSON) — o payload vai num POST. */
const MAX_ENTRY_CHARS = 6_000;
const MAX_TOTAL_CHARS = 35_000;

export interface DashboardSnapshotEntry {
  key: unknown[];
  value: string;
}

export interface DashboardSnapshot {
  capturedAt: string;
  pathname: string;
  entries: DashboardSnapshotEntry[];
  truncated: boolean;
}

function isRelevantKey(queryKey: unknown): boolean {
  if (!Array.isArray(queryKey)) return false;
  const first = queryKey[0];
  if (typeof first !== "string") return false;
  return RELEVANT_KEY_PREFIXES.some((prefix) => first === prefix || first.startsWith(prefix));
}

/** JSON.stringify defensivo: corta strings longas, marca ciclos, nunca lança. */
function safeStringify(data: unknown, maxLen: number): string {
  try {
    const seen = new WeakSet<object>();
    const json = JSON.stringify(data, (_key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return "[Circular]";
        seen.add(value);
      }
      return typeof value === "string" && value.length > 800
        ? `${value.slice(0, 800)}…(+${value.length - 800})`
        : value;
    });
    if (!json) return "";
    return json.length > maxLen ? `${json.slice(0, maxLen)}…(+${json.length - maxLen})` : json;
  } catch {
    return "[unstringifiable]";
  }
}

/** Serializa a queryKey em partes JSON-safe (máx. 6 partes). */
function serializeKey(queryKey: unknown): unknown[] {
  if (!Array.isArray(queryKey)) return [];
  return queryKey
    .map((part) => {
      if (part == null) return null;
      if (typeof part === "string" || typeof part === "number" || typeof part === "boolean") return part;
      try {
        return JSON.parse(JSON.stringify(part));
      } catch {
        return String(part);
      }
    })
    .slice(0, 6);
}

/**
 * Percorre o cache do React Query e monta o snapshot das queries relevantes
 * com status "success". Nunca lança — em falha retorna snapshot vazio.
 */
export function captureDashboardSnapshot(queryClient: QueryClient, pathname: string): DashboardSnapshot {
  try {
    const queries = queryClient.getQueryCache().getAll();
    const entries: DashboardSnapshotEntry[] = [];
    let total = 0;
    let truncated = false;
    for (const query of queries) {
      if (!isRelevantKey(query.queryKey)) continue;
      const state = query.state;
      if (state.status !== "success" || state.data === undefined) continue;
      const value = safeStringify(state.data, MAX_ENTRY_CHARS);
      if (value) {
        if (total + value.length > MAX_TOTAL_CHARS) {
          truncated = true;
          break;
        }
        entries.push({ key: serializeKey(query.queryKey), value });
        total += value.length;
      }
    }
    return { capturedAt: new Date().toISOString(), pathname, entries, truncated };
  } catch (err) {
    console.warn("[dashboardSnapshot] falha ao capturar (snapshot ignorado):", err);
    return { capturedAt: new Date().toISOString(), pathname, entries: [], truncated: false };
  }
}
