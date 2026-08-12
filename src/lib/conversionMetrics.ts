/**
 * Definições canônicas das métricas de conversão do Pinn BAI.
 *
 * Por que isto existe: o dashboard exibia "Taxa de Conversão" em múltiplos
 * widgets puxando de fontes diferentes, resultando em três valores conflitantes
 * na mesma tela (ex: 1,4% / 0,2% / 0%). Cada métrica agora tem ID único, label
 * explícito e fórmula documentada — usada como fonte única para tooltips,
 * relatórios da IA e auto-mapeamento.
 */

export type ConversionMetricId =
  | "conv_lead_to_meeting_30d"
  | "conv_lead_to_won_30d"
  | "conv_stage_avg_30d"
  | "conversion_rate";

export interface ConversionMetricDef {
  /** Label curto exibido no card. */
  label: string;
  /** Texto longo usado como tooltip e descrição. */
  description: string;
  /** Fórmula em linguagem natural (mostrada no tooltip). */
  formula: string;
  /** ID canônico que o produto considera "fonte de verdade" para esta família. */
  canonical: boolean;
  /** Se a métrica é deprecada, qual ID canônico substitui (usado para auto-mapeamento). */
  preferred?: ConversionMetricId;
}

export const CONVERSION_METRICS: Record<ConversionMetricId, ConversionMetricDef> = {
  conv_lead_to_meeting_30d: {
    label: "Conv. Lead → Reunião",
    description:
      "Leads que chegaram a reunião confirmada dividido pelo total de leads no período. Mede a qualidade da prospecção (SDR). É a métrica headline da operação Pinn.",
    formula: "reuniões confirmadas no período ÷ total de leads no período × 100",
    canonical: true,
  },
  conv_lead_to_won_30d: {
    label: "Conv. Lead → Fechamento",
    description:
      "Leads que viraram venda dividido pelo total de leads no período. Mede a performance full funnel — quanto da entrada se converte em receita.",
    formula: "leads ganhos no período ÷ total de leads no período × 100",
    canonical: true,
  },
  conv_stage_avg_30d: {
    label: "Conv. média por etapa",
    description:
      "Percentual médio de leads que avançam entre etapas consecutivas do funil. Identifica onde o funil vaza — quanto menor, mais estágios com perda de oportunidade.",
    formula: "média de (leads em N ÷ leads em N-1) para todas as etapas do funil",
    canonical: true,
  },
  conversion_rate: {
    label: "Taxa de Conversão",
    description:
      "Métrica genérica — verifique no admin qual conversão está sendo calculada (lead→reunião, lead→fechamento ou por etapa). Mantida por compatibilidade com dashboards antigos.",
    formula: "depende da configuração do widget",
    canonical: false,
    preferred: "conv_lead_to_meeting_30d",
  },
};

export function getConversionMetricDef(id: string | undefined | null): ConversionMetricDef | null {
  if (!id) return null;
  const key = id.toLowerCase().trim() as ConversionMetricId;
  return CONVERSION_METRICS[key] ?? null;
}

/**
 * Concatena label + fórmula no formato pronto para tooltip ℹ:
 * "Conv. Lead → Reunião — Como é calculado: ..."
 */
export function buildConversionTooltip(id: string | undefined | null, customDescription?: string): string {
  const def = getConversionMetricDef(id);
  if (!def) return customDescription ?? "";
  const desc = customDescription || def.description;
  return `${desc}\n\nComo é calculado: ${def.formula}.`;
}
