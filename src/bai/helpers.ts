/** Utilidades do BAI CRM Auditor — formatação e leitura de severidade (sem dados inventados). */

export type ScoreTier = "critical" | "warning" | "healthy" | "excellent";

export function tierFromScore(score: number): ScoreTier {
  if (score < 40) return "critical";
  if (score < 65) return "warning";
  if (score < 85) return "healthy";
  return "excellent";
}

export function tierLabelPt(t: ScoreTier): string {
  switch (t) {
    case "critical":
      return "Crítico";
    case "warning":
      return "Atenção";
    case "healthy":
      return "Saudável";
    default:
      return "Excelente";
  }
}

export function fmtMoney(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtNum(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("pt-BR");
}

export function fmtPct(v: number | undefined | null, digits = 1): string {
  if (v === undefined || v === null || Number.isNaN(Number(v))) return "—";
  return `${Number(v).toFixed(digits)}%`;
}

export type GapLike = { title?: string; detail?: string; severity?: string };
export type StrengthLike = { title?: string; detail?: string };

/** Extrai bullets executivos a partir de gaps, riscos da IA e pontos fortes (sem inventar números). */
export function buildExecutiveBrief(input: {
  gaps: GapLike[];
  strengths: StrengthLike[];
  analysisRisks?: string[];
  recommendations?: string[];
}): {
  topProblems: string[];
  topRisks: string[];
  opportunities: string[];
  weeklyActions: string[];
} {
  const sevOrder = (s?: string) => (String(s).toLowerCase() === "high" ? 0 : String(s).toLowerCase() === "medium" ? 1 : 2);
  const sortedGaps = [...input.gaps].sort((a, b) => sevOrder(a.severity) - sevOrder(b.severity));
  const topProblems = sortedGaps.slice(0, 3).map((g) => `${g.title ?? "Alerta"} — ${g.detail ?? ""}`.trim());

  const topRisks = (input.analysisRisks ?? []).slice(0, 3);
  if (topRisks.length < 3) {
    const extra = sortedGaps.slice(0, 4).filter((g) => String(g.severity).toLowerCase() === "high");
    for (const g of extra) {
      if (topRisks.length >= 3) break;
      const line = `${g.title ?? "Risco"} — ${g.detail ?? ""}`.trim();
      if (!topRisks.includes(line)) topRisks.push(line);
    }
  }

  const opportunities = input.strengths.slice(0, 3).map((s) => `${s.title ?? "Ponto forte"} — ${s.detail ?? ""}`.trim());

  const weeklyActions = (input.recommendations ?? []).slice(0, 3);

  return {
    topProblems,
    topRisks: topRisks.slice(0, 3),
    opportunities,
    weeklyActions,
  };
}

/** Plano de ação em horizontes — usa recomendações da IA ou fallback dos gaps (sem inventar métricas novas). */
export function splitActionHorizons(recommendations: string[]): {
  d7: string[];
  d15: string[];
  d30: string[];
} {
  const r = [...recommendations];
  return {
    d7: r.slice(0, 5),
    d15: r.slice(5, 10),
    d30: r.slice(10, 16),
  };
}
