import { fmtNum, tierFromScore, tierLabelPt } from "@/bai/helpers";

type TierKey = ReturnType<typeof tierFromScore> | "warning";

type Scores = Record<string, number | undefined>;

const LABELS: Record<string, { title: string; hint: string }> = {
  general_0_100: {
    title: "Operação geral",
    hint: "Síntese dos pilares neste snapshot (sem série temporal comparativa).",
  },
  hygiene_0_100: {
    title: "Higiene do CRM",
    hint: "Qualidade de cadastro: contatos, duplicidade e campos críticos nas oportunidades.",
  },
  discipline_0_100: {
    title: "Disciplina comercial",
    hint: "Execução de tarefas, follow-up e ritmo de atualização das oportunidades abertas.",
  },
  risk_commercial_0_100: {
    title: "Risco comercial",
    hint: "Atrito operacional e concentração de valor — quanto maior o score, menor o risco relativo.",
  },
  forecast_0_100: {
    title: "Confiabilidade do forecast",
    hint: "Completude de valor, responsável, origem e consistência para previsão.",
  },
  engagement_0_100: {
    title: "Engajamento registrado",
    hint: "Volume de notas, eventos e conversas capturados neste recorte.",
  },
};

export function ExecutiveScoreboard({
  scores,
  historyAvailable,
  meta,
}: {
  scores: Scores | undefined;
  historyAvailable: boolean;
  meta?: Record<string, unknown>;
}) {
  const insufficient = meta?.insufficient_snapshot === true;
  const order = ["general_0_100", "hygiene_0_100", "discipline_0_100", "risk_commercial_0_100", "forecast_0_100", "engagement_0_100"];
  return (
    <div>
      {insufficient ? (
        <div className="bai-exec-alert-strip">
          Conta Kommo sem leads nem contatos neste snapshot — os indicadores permanecem zerados até a próxima sincronização.
        </div>
      ) : null}
      <div className="bai-exec-grid">
        {order.map((key) => {
          const v = scores?.[key] ?? 0;
          const tier = tierFromScore(v);
          const labelMeta = LABELS[key];
          if (!labelMeta) return null;
          const tierKey: TierKey = insufficient && v === 0 ? "warning" : tier;
          const badge = (
            <span className={tierBadgeClass(tierKey)}>
              {insufficient && v === 0 ? "Sem base" : tierLabelPt(tier)}
            </span>
          );
          return (
            <div key={key} className="bai-exec-pillar">
              <div className="bai-exec-kicker">{labelMeta.title}</div>
              <div className="bai-exec-score-row">
                <span className="bai-exec-score">{fmtNum(v)}</span>
                {badge}
              </div>
              <p className="bai-exec-hint">{labelMeta.hint}</p>
              <p className="bai-exec-trend">
                Tendência: {historyAvailable ? "em desenvolvimento" : "sem histórico suficiente"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function tierBadgeClass(tier: TierKey): string {
  const base = "bai-tier-badge";
  const map: Record<TierKey, string> = {
    critical: `${base} bai-tier-badge--critical`,
    warning: `${base} bai-tier-badge--warning`,
    healthy: `${base} bai-tier-badge--healthy`,
    excellent: `${base} bai-tier-badge--excellent`,
  };
  return map[tier] ?? `${base} bai-tier-badge--warning`;
}
