/**
 * Padronização de nomes de etapa do funil.
 *
 * Cada CRM (Kommo, Pipedrive, etc.) cadastra nomes livres por tenant. Para a
 * mesma operação aparecer minimamente consistente entre dashboards, este
 * helper aplica:
 *
 * 1. Mapeamento de identificadores técnicos comuns para PT-BR ("new" → "Novos").
 * 2. Title case quando o nome veio em caixa baixa com underscore.
 * 3. Fallback amigável quando o nome veio vazio (exibe "Estágio #ID" em vez
 *    de aparecer "—" ou o UUID cru).
 */

const TECH_NAME_MAP: Record<string, string> = {
  new: "Novos",
  qualified: "Qualificados",
  in_analysis: "Em Análise",
  in_progress: "Em Andamento",
  proposal: "Proposta",
  negotiation: "Negociação",
  converted: "Convertidos",
  won: "Ganhos",
  lost: "Perdidos",
  open: "Em Aberto",
};

const NULL_INDICATORS = new Set(["", "null", "undefined", "nan", "—"]);

export interface FormatStageNameOpts {
  /** ID externo do estágio (Kommo) — usado como fallback quando o nome veio vazio. */
  externalId?: string | number | null;
  /** Limite de caracteres no nome final (default: 40). */
  maxLen?: number;
}

export function formatStageName(raw: unknown, opts: FormatStageNameOpts = {}): string {
  const maxLen = opts.maxLen ?? 40;
  const text = String(raw ?? "").trim();
  const normalized = text.toLowerCase();

  if (!text || NULL_INDICATORS.has(normalized)) {
    return opts.externalId != null && String(opts.externalId).trim() !== ""
      ? `Estágio #${String(opts.externalId)}`
      : "Estágio sem nome";
  }

  if (TECH_NAME_MAP[normalized]) {
    return truncate(TECH_NAME_MAP[normalized], maxLen);
  }

  // Já é "Title Case Acentuado" com espaço — mantém como está.
  if (/^[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ]/.test(text) && text.includes(" ")) {
    return truncate(text, maxLen);
  }

  // Snake/kebab case → título.
  const titled = text
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+/g, " ");

  return truncate(titled, maxLen);
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}
