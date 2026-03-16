/**
 * Pinn BAI — referenceMappings.ts  (v2 — genérico, desacoplado)
 *
 * Antes: hardcoded com views da Afonsina (vw_afonsina_*, vw_dashboard_*).
 * Agora: padrões semânticos reutilizáveis para qualquer cliente.
 *
 * Lógica de resolução (ordem de prioridade):
 *  1. View/tabela com nome explícito da métrica
 *  2. View agregada (vw_*, view_*) com sufixo _30d/_60d/_7d
 *  3. Tabela transacional com campo de contagem/soma
 *  4. Fallback genérico por tipo de coluna
 */

export interface ReferenceMapping {
  /** Identificador semântico da métrica (ex: 'total_leads') */
  targetMetric: string;
  /**
   * Padrões de nome de view/tabela (regex, case-insensitive).
   * Testados em ordem — primeiro que bater ganha.
   */
  viewPatterns: {
    tablePattern: RegExp;
    fieldPattern: RegExp;
    aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
  }[];
  /** Transformação padrão para display */
  defaultTransformation: 'number' | 'currency' | 'percentage' | 'date' | 'text';
}

/**
 * Mapeamentos semânticos genéricos.
 * NÃO dependem de nomes de views específicas de cliente.
 * O motor de mapeamento testa os padrões contra as tabelas/colunas reais do cliente.
 */
export const REFERENCE_MAPPINGS: ReferenceMapping[] = [
  // ── LEADS ──────────────────────────────────────────────────────────────
  {
    targetMetric: 'total_leads',
    viewPatterns: [
      { tablePattern: /kpi|dashboard|summary/i,  fieldPattern: /leads_total|total_leads|lead_count/i, aggregation: 'sum' },
      { tablePattern: /lead/i,                   fieldPattern: /^id$|^lead_id$/i,                      aggregation: 'count' },
      { tablePattern: /.*/,                      fieldPattern: /leads_total|total_leads|lead_count/i,  aggregation: 'sum' },
    ],
    defaultTransformation: 'number',
  },
  {
    targetMetric: 'new_leads',
    viewPatterns: [
      { tablePattern: /daily|diario|dia/i,  fieldPattern: /new_leads|leads_new|novos_leads/i, aggregation: 'sum' },
      { tablePattern: /kpi|dashboard/i,     fieldPattern: /leads_30d|leads_new|new_leads/i,   aggregation: 'sum' },
      { tablePattern: /.*/,                 fieldPattern: /new_leads|leads_new|novos/i,        aggregation: 'sum' },
    ],
    defaultTransformation: 'number',
  },

  // ── RECEITA / FINANCEIRO ───────────────────────────────────────────────
  {
    targetMetric: 'revenue',
    viewPatterns: [
      { tablePattern: /revenue|receita|financ/i, fieldPattern: /total|amount|valor/i,    aggregation: 'sum' },
      { tablePattern: /kpi|dashboard|summary/i,  fieldPattern: /revenue|receita|receita_total/i, aggregation: 'sum' },
      { tablePattern: /.*/,                      fieldPattern: /^revenue$|^receita$|^valor_total$|^faturamento$/i, aggregation: 'sum' },
    ],
    defaultTransformation: 'currency',
  },
  {
    targetMetric: 'mrr',
    viewPatterns: [
      { tablePattern: /.*/,  fieldPattern: /^mrr$|mrr_total|receita_mensal/i,  aggregation: 'sum' },
    ],
    defaultTransformation: 'currency',
  },
  {
    targetMetric: 'investimento',
    viewPatterns: [
      { tablePattern: /custo|funil|funnel|cost/i, fieldPattern: /custo_total|spend_total|investimento/i, aggregation: 'sum' },
      { tablePattern: /kpi|dashboard/i,           fieldPattern: /spend_30d|spend_total|custo/i,          aggregation: 'sum' },
      { tablePattern: /.*/,                       fieldPattern: /^spend$|^custo$|^investimento$|spend_total/i, aggregation: 'sum' },
    ],
    defaultTransformation: 'currency',
  },
  {
    targetMetric: 'avg_ticket',
    viewPatterns: [
      { tablePattern: /.*/,  fieldPattern: /ticket_medio|avg_ticket|ticket/i,  aggregation: 'avg' },
    ],
    defaultTransformation: 'currency',
  },
  {
    targetMetric: 'cpl',
    viewPatterns: [
      { tablePattern: /.*/,  fieldPattern: /^cpl$|cpl_30d|custo_por_lead|cost_per_lead/i, aggregation: 'avg' },
    ],
    defaultTransformation: 'currency',
  },
  {
    targetMetric: 'cpm_meeting',
    viewPatterns: [
      { tablePattern: /.*/,  fieldPattern: /cp_meeting|custo_por_reuniao|cost_per_meeting/i, aggregation: 'avg' },
    ],
    defaultTransformation: 'currency',
  },

  // ── CONVERSÕES ────────────────────────────────────────────────────────
  {
    targetMetric: 'conversions',
    viewPatterns: [
      { tablePattern: /custo|funil|funnel/i,  fieldPattern: /meetings_done|reuniao_realizada/i, aggregation: 'sum' },
      { tablePattern: /kpi|dashboard/i,       fieldPattern: /meetings_done|conversions|conv/i,   aggregation: 'sum' },
      { tablePattern: /.*/,                   fieldPattern: /conversions|convertidos|meetings_done/i, aggregation: 'sum' },
    ],
    defaultTransformation: 'number',
  },
  {
    targetMetric: 'meetings_scheduled',
    viewPatterns: [
      { tablePattern: /.*/,  fieldPattern: /meetings_booked|meetings_scheduled|reuniao_agendada|agendada_total/i, aggregation: 'sum' },
    ],
    defaultTransformation: 'number',
  },
  {
    targetMetric: 'meetings_done',
    viewPatterns: [
      { tablePattern: /.*/,  fieldPattern: /meetings_done|reuniao_realizada|realizada_total/i, aggregation: 'sum' },
    ],
    defaultTransformation: 'number',
  },

  // ── TAXAS ─────────────────────────────────────────────────────────────
  {
    targetMetric: 'conversion_rate',
    viewPatterns: [
      { tablePattern: /kpi|dashboard/i,  fieldPattern: /conv_lead|conversion_rate|taxa_conversao/i, aggregation: 'avg' },
      { tablePattern: /custo|funil/i,    fieldPattern: /taxa_entrada|conv_lead/i,                   aggregation: 'avg' },
      { tablePattern: /.*/,              fieldPattern: /conversion_rate|taxa_conversao|taxa_conv/i,  aggregation: 'avg' },
    ],
    defaultTransformation: 'percentage',
  },
  {
    targetMetric: 'churn_rate',
    viewPatterns: [
      { tablePattern: /.*/,  fieldPattern: /churn|churn_rate|taxa_churn/i,  aggregation: 'avg' },
    ],
    defaultTransformation: 'percentage',
  },
  {
    targetMetric: 'growth_rate',
    viewPatterns: [
      { tablePattern: /.*/,  fieldPattern: /growth|crescimento|growth_rate/i,  aggregation: 'avg' },
    ],
    defaultTransformation: 'percentage',
  },

  // ── MENSAGENS ─────────────────────────────────────────────────────────
  {
    targetMetric: 'mensagens',
    viewPatterns: [
      { tablePattern: /msg|mensagem|message|kommo/i,  fieldPattern: /msg_in|mensagens|messages/i, aggregation: 'sum' },
      { tablePattern: /kpi|dashboard/i,               fieldPattern: /msg_in_30d|msg_total/i,       aggregation: 'sum' },
      { tablePattern: /.*/,                           fieldPattern: /msg_in|mensagens_total/i,      aggregation: 'sum' },
    ],
    defaultTransformation: 'number',
  },

  // ── LIGAÇÕES / CALLS ──────────────────────────────────────────────────
  {
    targetMetric: 'calls_done',
    viewPatterns: [
      { tablePattern: /call|vapi|ligac/i,  fieldPattern: /calls_done|calls_answered|ligacoes/i, aggregation: 'sum' },
      { tablePattern: /.*/,                fieldPattern: /calls_done|calls_answered/i,           aggregation: 'sum' },
    ],
    defaultTransformation: 'number',
  },
  {
    targetMetric: 'total_spent_calls',
    viewPatterns: [
      { tablePattern: /call|vapi/i,  fieldPattern: /total_spent|spent_usd|custo_ligacao/i, aggregation: 'sum' },
    ],
    defaultTransformation: 'currency',
  },

  // ── USUÁRIOS ──────────────────────────────────────────────────────────
  {
    targetMetric: 'active_users',
    viewPatterns: [
      { tablePattern: /user|usuario/i,  fieldPattern: /active|ativo|active_users/i, aggregation: 'count' },
      { tablePattern: /.*/,             fieldPattern: /active_users|usuarios_ativos/i, aggregation: 'sum' },
    ],
    defaultTransformation: 'number',
  },

  // ── TEMPORAIS (groupBy) ───────────────────────────────────────────────
  {
    targetMetric: 'created_date',
    viewPatterns: [
      { tablePattern: /.*/,  fieldPattern: /^day$|^dia$|^date$|^data$|created_at|event_day/i, aggregation: 'count' },
    ],
    defaultTransformation: 'date',
  },

  // ── FUNIL / ESTÁGIO ───────────────────────────────────────────────────
  {
    targetMetric: 'funnel_stage',
    viewPatterns: [
      { tablePattern: /.*/,  fieldPattern: /stage|etapa|fase|status|stage_name|stage_key/i, aggregation: 'count' },
    ],
    defaultTransformation: 'text',
  },

  // ── ORIGEM ────────────────────────────────────────────────────────────
  {
    targetMetric: 'lead_source',
    viewPatterns: [
      { tablePattern: /.*/,  fieldPattern: /source|origem|canal|utm_source|anuncio|campaign/i, aggregation: 'count' },
    ],
    defaultTransformation: 'text',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Funções de resolução
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolvedMapping {
  viewName: string;
  fieldName: string;
  aggregation: string;
  transformation: string;
}

/**
 * Resolve o melhor mapeamento para uma métrica semântica dado o schema real.
 *
 * @param targetMetric  ex: 'total_leads'
 * @param availableTables  lista de { tableName, columns: string[] }
 */
export function resolveMapping(
  targetMetric: string,
  availableTables: { tableName: string; columns: string[] }[]
): ResolvedMapping | null {
  const metricLower = targetMetric.toLowerCase();

  // Busca exata primeiro, depois parcial
  let mapping = REFERENCE_MAPPINGS.find(m => m.targetMetric.toLowerCase() === metricLower);
  if (!mapping) {
    mapping = REFERENCE_MAPPINGS.find(
      m =>
        metricLower.includes(m.targetMetric.toLowerCase()) ||
        m.targetMetric.toLowerCase().includes(metricLower)
    );
  }
  if (!mapping) return null;

  // Prioriza views agregadas (vw_*, view_*, kpi, dashboard, summary)
  const sortedTables = [...availableTables].sort((a, b) => {
    const score = (name: string) => {
      let s = 0;
      if (/^vw_|^view_|^v\d+_/i.test(name)) s += 50;
      if (/kpi|dashboard|summary|metrics/i.test(name)) s += 30;
      if (/daily|diario|funil|funnel/i.test(name)) s += 20;
      if (/_30d|_60d|_7d/i.test(name)) s += 10;
      return s;
    };
    return score(b.tableName) - score(a.tableName);
  });

  for (const pattern of mapping.viewPatterns) {
    for (const table of sortedTables) {
      if (!pattern.tablePattern.test(table.tableName)) continue;
      const matchedField = table.columns.find(col => pattern.fieldPattern.test(col));
      if (matchedField) {
        return {
          viewName: table.tableName,
          fieldName: matchedField,
          aggregation: pattern.aggregation,
          transformation: mapping.defaultTransformation,
        };
      }
    }
  }

  return null;
}

/**
 * Resolve mapeamento a partir de um título de widget (heurística semântica).
 *
 * @param widgetTitle   ex: 'Total de Leads', 'Investimento (30d)'
 * @param availableTables  schema real do cliente
 */
export function resolveByWidgetTitle(
  widgetTitle: string,
  availableTables: { tableName: string; columns: string[] }[]
): ResolvedMapping | null {
  const title = widgetTitle.toLowerCase();

  const titleToMetric: [RegExp, string][] = [
    [/total.*lead|lead.*total/i,          'total_leads'],
    [/nov.*lead|lead.*nov/i,              'new_leads'],
    [/receita|revenue|faturamento/i,      'revenue'],
    [/mrr|recorrente/i,                   'mrr'],
    [/investimento|spend|gasto/i,         'investimento'],
    [/ticket.*médio|avg.*ticket/i,        'avg_ticket'],
    [/cpl|custo.*lead/i,                  'cpl'],
    [/custo.*reunião|cp.*meeting/i,       'cpm_meeting'],
    [/convers[aã]o.*taxa|taxa.*conv/i,    'conversion_rate'],
    [/convers[oõ]es|reuniões.*realiz/i,   'conversions'],
    [/reuni.*agend|agend.*reuni/i,        'meetings_scheduled'],
    [/reuni.*realiz|realiz.*reuni/i,      'meetings_done'],
    [/mensagens?/i,                        'mensagens'],
    [/ligaç|calls?/i,                      'calls_done'],
    [/usuário.*ativo|ativo.*usuário/i,    'active_users'],
    [/churn/i,                             'churn_rate'],
    [/crescimento|growth/i,               'growth_rate'],
    [/origem|source/i,                    'lead_source'],
    [/estágio|funil|funnel/i,             'funnel_stage'],
  ];

  for (const [pattern, metric] of titleToMetric) {
    if (pattern.test(title)) {
      return resolveMapping(metric, availableTables);
    }
  }

  return null;
}

/**
 * Compatibilidade retroativa: interface antiga usada em useDashboard.ts e outros hooks.
 * @deprecated Use resolveMapping() com availableTables.
 */
export function findReferenceMapping(
  targetMetric: string,
  availableViews: string[]
): { viewName: string; fieldName: string; aggregation: string } | null {
  // Converte lista plana de nomes em estrutura esperada pelo novo motor
  // sem colunas — vai cair no fallback de tabela se disponível
  const tables = availableViews.map(name => ({ tableName: name, columns: [] }));
  const result = resolveMapping(targetMetric, tables);
  if (!result) return null;
  return {
    viewName: result.viewName,
    fieldName: result.fieldName,
    aggregation: result.aggregation,
  };
}

/**
 * Compatibilidade retroativa: findFieldByWidgetTitle.
 * @deprecated Use resolveByWidgetTitle()
 */
export function findFieldByWidgetTitle(
  widgetTitle: string,
  availableViews: string[],
  _availableFields: string[]
): { viewName: string; fieldName: string; aggregation: string } | null {
  const tables = availableViews.map(name => ({ tableName: name, columns: _availableFields }));
  const result = resolveByWidgetTitle(widgetTitle, tables);
  if (!result) return null;
  return {
    viewName: result.viewName,
    fieldName: result.fieldName,
    aggregation: result.aggregation,
  };
}
