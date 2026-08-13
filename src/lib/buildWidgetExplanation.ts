/**
 * buildWidgetExplanation — monta a estrutura MetricExplanation exibida pelo
 * MetricExplanationDialog quando o usuário clica num metric_card.
 *
 * Textos e faixas de interpretação reconstruídos fielmente a partir do bundle
 * de produção (dist/assets/index-*.js, build de 05/jul/2026).
 */
import { getConversionMetricDef } from "@/lib/conversionMetrics";
import type { MetricExplanation } from "@/components/dashboard/MetricExplanationDialog";

type WidgetFormat = "number" | "currency" | "percentage";

export interface BuildWidgetExplanationInput {
  widget: { title: string; description?: string | null; type?: string };
  config: {
    dataSource?: string;
    sourceTable?: string;
    metric?: string;
    metricField?: string;
    targetMetric?: string;
    aggregation?: "sum" | "count" | "avg" | "min" | "max";
    groupBy?: string;
    formula?: string;
    percentScale?: boolean;
  };
  value: number | undefined;
  format: WidgetFormat;
  rawCount?: number;
  rawSample?: Record<string, unknown>[];
}

/** Formata o valor final no padrão dos cards (R$ 1.2M, 12.3K, 4,5%…). */
function formatMetricValue(value: number, format: WidgetFormat): string {
  if (format === "currency") {
    if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}K`;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }
  if (format === "percentage") return `${value.toFixed(1)}%`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("pt-BR");
}

export function buildWidgetExplanation({
  widget,
  config,
  value,
  format,
  rawSample,
  rawCount,
}: BuildWidgetExplanationInput): MetricExplanation {
  const metricName = config.metric ?? config.metricField ?? widget.title;
  const source = config.dataSource ?? config.sourceTable ?? "—";
  const aggregation = config.aggregation ?? "count";
  const formula = config.formula;
  const convDef = getConversionMetricDef(metricName);

  const definition = convDef
    ? convDef.description
    : widget.description ||
      `Card "${widget.title}" lê da tabela ${source} e aplica agregação ${aggregation} sobre o campo ${metricName}.`;

  const calculation = formula
    ? `Fórmula custom configurada no widget:\n${formula}\n\nFonte de linhas: ${source}.`
    : convDef
      ? `${convDef.formula}\n\nFonte: ${source}.`
      : `${aggregation.toUpperCase()}(${metricName}) FROM ${source}${config.groupBy ? `\nAgrupado por ${config.groupBy}` : ""}`;

  const dataSources: string[] = [];
  if (source !== "—") dataSources.push(`Tabela/view: \`${source}\``);
  if (config.groupBy) dataSources.push(`Campo de agrupamento: \`${config.groupBy}\``);
  dataSources.push("Sincronização: snapshot do CRM no último sync da org.");

  const breakdown: MetricExplanation["breakdown"] = [];
  if (rawCount !== undefined) {
    breakdown.push({ label: "Linhas consideradas", value: rawCount.toLocaleString("pt-BR") });
  }
  breakdown.push({ label: "Agregação aplicada", value: aggregation });
  if (value !== undefined) {
    breakdown.push({ label: "Resultado", value: formatMetricValue(value, format), emphasis: true });
  }
  if (rawSample && rawSample.length > 0 && metricName && metricName !== widget.title) {
    const nums = rawSample.map((row) => Number(row[metricName])).filter((n) => Number.isFinite(n));
    if (nums.length > 0) {
      breakdown.push({
        label: "Amostra (média)",
        value: (nums.reduce((acc, n) => acc + n, 0) / nums.length).toFixed(2),
      });
      breakdown.push({ label: "Amostra (mínimo)", value: Math.min(...nums).toString() });
      breakdown.push({ label: "Amostra (máximo)", value: Math.max(...nums).toString() });
    }
  }

  const interpretation =
    value === undefined
      ? "Sem valor computado no recorte atual."
      : format === "percentage"
        ? value === 0
          ? "Taxa de zero indica nenhuma conversão registrada no recorte selecionado."
          : value >= 80
            ? "Taxa muito alta — verifique se há viés ou amostra pequena."
            : value >= 30
              ? "Taxa saudável dentro de um funil B2B típico."
              : value >= 10
                ? "Taxa dentro da faixa de mercado para vendas consultivas."
                : "Taxa baixa — investigar ponto de gargalo no funil."
        : format === "currency"
          ? value === 0
            ? "Sem valor monetário registrado no recorte."
            : "Valor monetário no recorte selecionado."
          : `${value.toLocaleString("pt-BR")} é o resultado da agregação no recorte atual.`;

  const action =
    convDef && convDef.canonical && value !== undefined && format === "percentage" && value < 10
      ? "Considere revisar os critérios de qualificação nas etapas iniciais do funil. Taxa baixa pode indicar leads desqualificados entrando."
      : value === 0
        ? "Verifique se o recorte temporal está adequado ou se a fonte está populando o campo correto."
        : "Compare com o período anterior usando o filtro temporal global para ver a tendência.";

  return {
    title: widget.title,
    subtitle: convDef ? convDef.label : undefined,
    definition,
    calculation,
    dataSources,
    breakdown,
    interpretation,
    action,
    refresh: "Atualizado a cada nova sincronização do CRM (ou refresh manual do widget).",
  };
}
