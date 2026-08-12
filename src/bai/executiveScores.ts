/**
 * Resolve o scoreboard executivo do payload da API (com fallback legado).
 */

export function resolveExecutiveScoreboard(data: Record<string, unknown>): {
  scores: Record<string, number>;
  meta: Record<string, unknown>;
} {
  const ex = data.executive_scoreboard as { scores?: Record<string, number>; meta?: Record<string, unknown> } | undefined;
  const sc = ex?.scores;
  if (
    sc &&
    typeof sc.general_0_100 === "number" &&
    typeof sc.hygiene_0_100 === "number" &&
    typeof sc.discipline_0_100 === "number"
  ) {
    return { scores: { ...sc } as Record<string, number>, meta: { ...(ex?.meta ?? {}) } };
  }

  const legacy = data.scores as Record<string, number | undefined> | undefined;
  const hy = Math.round(Number(legacy?.crm_data_quality_0_100 ?? 0));
  const disc = Math.round(Number(legacy?.operation_0_100 ?? 0));
  const mid = Math.round((hy + disc) / 2);
  return {
    scores: {
      general_0_100: mid,
      hygiene_0_100: hy,
      discipline_0_100: disc,
      risk_commercial_0_100: mid,
      forecast_0_100: mid,
      engagement_0_100: 0,
    },
    meta: {
      fallback_legacy_scores: true,
      weights_note: "Fallback: scores derivados de crm_data_quality_0_100 e operation_0_100 — atualize o backend.",
    },
  };
}
