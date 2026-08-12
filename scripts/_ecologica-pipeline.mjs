/**
 * SHARED (throwaway) — lógica do pipeline genérico de auto-build PORTADA VERBATIM
 * das 3 edge functions (caminho heurístico, já corrigidas). Fonte única de verdade
 * usada por:
 *   - scripts/validate-ecologica-pipeline.mjs   (fixture offline)
 *   - scripts/ecologica-realdata-validate.mjs   (introspecção real do Supabase externo)
 *
 * Funções:
 *   heuristicSuggestions     ← supabase/functions/suggest-tables/index.ts
 *   heuristicMappings(+helpers) ← supabase/functions/suggest-mappings/index.ts
 *   generateRecommendations(+helpers) ← supabase/functions/recommend-widgets/index.ts
 *   adaptMappings            ← aprox. da persistência do frontend (DROPA aggregation,
 *                              pois data_mappings não tem essa coluna)
 */

/* ── suggest-tables ─────────────────────────────────────────────────────── */
export function heuristicSuggestions(tables) {
  const scored = tables.map((table) => {
    let score = 50;
    const reasons = [];
    const suggestedColumns = [];
    const name = table.name.toLowerCase();

    if (name.startsWith('vw_')) { score += 15; reasons.push('View otimizada para relatórios'); }
    if (/lead|cliente|customer|sale|venda|order|pedido|conversion/i.test(name)) { score += 20; reasons.push('Dados de negócio relevantes'); }
    if (/kpi|dashboard|metrics|daily|weekly|monthly/i.test(name)) { score += 25; reasons.push('Métricas agregadas'); }
    if (/funnel|funil|stage|etapa/i.test(name)) { score += 15; reasons.push('Dados de funil'); }
    // penalidade de sistema por TOKEN inteiro — "ecoLOGica" NÃO casa "log"
    const nameTokens = name.split(/[^a-z0-9]+/i).filter(Boolean);
    const SYSTEM_TOKENS = ['migration', 'migrations', 'schema', 'log', 'logs', 'cache', 'temp', 'tmp', 'session', 'sessions', 'auth', 'token', 'tokens', 'audit'];
    if (nameTokens.some((tok) => SYSTEM_TOKENS.includes(tok))) { score -= 30; reasons.push('Tabela de sistema'); }

    for (const col of table.columns) {
      const colName = col.name.toLowerCase();
      if (/date|created|updated|timestamp/i.test(colName)) suggestedColumns.push(col.name);
      if (/value|amount|total|revenue|price|count/i.test(colName)) { suggestedColumns.push(col.name); score += 5; }
      if (/status|stage|source|type|category/i.test(colName)) { suggestedColumns.push(col.name); score += 3; }
    }

    if (table.rowCount > 10 && table.rowCount < 100000) score += 10;
    else if (table.rowCount === 0) score -= 20;

    return {
      tableName: table.name,
      score: Math.max(0, Math.min(100, score)),
      reason: reasons.length > 0 ? reasons.join('. ') : 'Tabela padrão',
      suggestedColumns: [...new Set(suggestedColumns)].slice(0, 5),
      rowCount: table.rowCount,
    };
  });

  // desempate por VOLUME: em score igual, mais linhas vence (1-linha view não ganha)
  return scored.filter((s) => s.score > 30).sort((a, b) => b.score - a.score || (b.rowCount ?? 0) - (a.rowCount ?? 0)).slice(0, 10);
}

/* ── suggest-mappings (heurística v2) ───────────────────────────────────── */
export function analyzeNumericValues(samples) {
  const nums = samples
    .map((v) => {
      if (typeof v === 'number') return v;
      if (typeof v === 'string') return parseFloat(v.replace(/[R$,\s%]/g, '.').replace(/\.(?=.*\.)/g, ''));
      return NaN;
    })
    .filter((n) => !isNaN(n));

  if (!nums.length) return { isNumeric: false, isCurrency: false, isPercentage: false, avg: 0, hasDecimals: false };

  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  const max = Math.max(...nums);
  const min = Math.min(...nums);
  const hasDecimals = nums.some((n) => n % 1 !== 0);

  const isCurrency = avg > 10 && (hasDecimals || avg > 100 || (avg > 50 && max > 200));
  const isPercentage = max <= 100 && min >= 0 && avg < 100 && (hasDecimals || avg < 50);

  return { isNumeric: true, isCurrency, isPercentage, avg, hasDecimals };
}

export function scoreTablePriority(table) {
  const n = table.name.toLowerCase();
  let score = Math.min(table.rowCount > 0 ? 10 : 0, 20);
  if (/^vw_|^view_|^v\d+_/i.test(n)) score += 50;
  if (/kpi|dashboard|summary|metrics/i.test(n)) score += 40;
  if (/funil|funnel|custos|costs/i.test(n)) score += 30;
  if (/daily|diario|dia/i.test(n)) score += 20;
  if (/_30d|_60d|_7d|_90d/i.test(n)) score += 15;
  if (/lead|cliente|customer/i.test(n)) score += 15;
  if (/sale|venda|revenue|pedido/i.test(n)) score += 15;
  if (/msg|message|kommo/i.test(n)) score += 10;
  if (/call|vapi|ligac/i.test(n)) score += 10;
  // penalidade de log/audit por TOKEN (não substring — "ecoLOGica" não é log)
  const tks = n.split(/[^a-z0-9]+/i).filter(Boolean);
  if (tks.some((t) => t === 'log' || t === 'logs' || t === 'audit')) score -= 20;
  const numericCols = table.columns.filter((c) => {
    const t = c.type.toLowerCase();
    return t.includes('int') || t.includes('numeric') || t.includes('decimal') || t.includes('float');
  }).length;
  score += Math.min(numericCols * 2, 20);
  return score;
}

export const isIdColumn = (name) => /^id$|^uuid$|^pk$|_id$|_uuid$/i.test(name);
export const isDateColumn = (name, type) =>
  type.toLowerCase().includes('date') ||
  type.toLowerCase().includes('timestamp') ||
  /^day$|^dia$|^date$|^data$|^created_at$|^updated_at$|_at$|_ts$|event_day|day_brt|started_at|ended_at|last_event_ts/i.test(name);

export function heuristicMappings(tables, selectedColumns) {
  const suggestions = [];
  const sortedTables = [...tables].sort((a, b) => scoreTablePriority(b) - scoreTablePriority(a));
  const primaryTable = sortedTables[0]?.name ?? '';

  for (const table of sortedTables) {
    const columnsToProcess = selectedColumns?.[table.name]
      ? table.columns.filter((c) => selectedColumns[table.name].includes(c.name))
      : table.columns;

    const tnl = table.name.toLowerCase();
    const tableIsAggregated = /^vw_|^view_|^v\d+_/i.test(tnl) ||
      /kpi|dashboard|summary|metrics|_30d|_60d|_7d|_90d|daily|diario/i.test(tnl);
    const tableLooksLikeLeads = /lead|cliente|customer|contato|contact|deal|oportunidad|prospect/i.test(tnl);

    for (const col of columnsToProcess) {
      const n = col.name.toLowerCase();
      const type = col.type.toLowerCase();
      const samples = col.sampleValues ?? [];
      const numStats = analyzeNumericValues(samples);

      if (isIdColumn(col.name)) continue;
      if (isDateColumn(col.name, col.type)) {
        if (!suggestions.some((s) => s.sourceTable === table.name && s.targetMetric === 'created_date')) {
          suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'created_date', transformation: 'date', confidence: 70, reason: `Coluna de data "${col.name}" → dimensão temporal (groupBy)` });
        }
        continue;
      }

      const isNumericType = type.includes('int') || type.includes('numeric') || type.includes('decimal') || type.includes('float') || type.includes('double');
      const isBooleanType = type.includes('bool') || (samples.length > 0 && samples.every((v) => typeof v === 'boolean'));

      // GUARD coluna VAZIA (só dimensão de TEXTO): texto ~100% nulo → gráfico
      // categórico vazio (ex.: origem_lead). NÃO aplica a bool/numérico (count/sum=0 é válido).
      const nonNullSamples = samples.filter((v) => v !== null && v !== undefined && v !== '');
      if (!isNumericType && !isBooleanType && samples.length >= 5 && nonNullSamples.length === 0) continue;

      if (isBooleanType) {
        let target = null;
        if (/realizad|conclu|done|compareceu/i.test(n)) target = 'meetings_done';
        else if (/agendad|marcad|scheduled|booked/i.test(n)) target = 'meetings_scheduled';
        else if (/reuni|meeting|call|ligac/i.test(n)) target = 'meetings_total';
        else if (/convert|ganho|won|fechad|cliente/i.test(n)) target = 'conversions';
        if (target) {
          suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: target, transformation: 'number', aggregation: 'count', confidence: 90, reason: `Flag boolean "${col.name}" → COUNT de positivos` });
        }
        continue;
      }

      const isNameCol = /^nome|_nome$|^name$|_name$|full_name|^razao|cliente$/i.test(n);
      if (tableLooksLikeLeads && isNameCol && !isNumericType) {
        suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'total_leads', transformation: 'number', aggregation: 'count', confidence: 80, reason: `Coluna de nome em tabela de leads → COUNT(linhas) = total de leads` });
        continue;
      }

      const isLeadCount = /leads_total|total_leads|lead_count|leads_new|new_leads|novos_leads|entrada_total/i.test(n) || (n.endsWith('_total') && /lead|entrada/i.test(n));
      if (isLeadCount && isNumericType) {
        const isNew = /new|novo|novos|recent|latest/i.test(n);
        const isEntrada = /entrada/i.test(n);
        suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: isNew ? 'new_leads' : isEntrada ? 'new_leads' : 'total_leads', transformation: 'number', confidence: 95, reason: `Contagem de leads "${col.name}"` });
        continue;
      }

      const isRevenue = /revenue|receita|faturamento|mrr|receita_mensal/i.test(n);
      const isSpend = /spend_total|spend_30d|custo_total|investimento|gasto_total/i.test(n);
      const isCpl = /^cpl$|cpl_30d|cpl_total|custo_por_lead|cost_per_lead/i.test(n);
      const isCpmMeeting = /cp_meeting|custo_por_reuniao|cost_per_meeting/i.test(n);
      const isTicket = /ticket_medio|avg_ticket|ticket/i.test(n);
      const isMrr = /^mrr$|mrr_total/i.test(n);

      if (isMrr && isNumericType) { suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'mrr', transformation: 'currency', confidence: 97, reason: 'MRR' }); continue; }
      if (isCpl && isNumericType) { suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'cpl', transformation: 'currency', confidence: 96, reason: 'CPL' }); continue; }
      if (isCpmMeeting && isNumericType) { suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'cpm_meeting', transformation: 'currency', confidence: 96, reason: 'Custo/reunião' }); continue; }
      if (isTicket && isNumericType) { suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'avg_ticket', transformation: 'currency', confidence: 93, reason: 'Ticket médio' }); continue; }
      if (isRevenue && isNumericType) { suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'revenue', transformation: 'currency', confidence: 95, reason: 'Receita' }); continue; }
      if (isSpend && isNumericType) { suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'investimento', transformation: 'currency', confidence: 94, reason: 'Investimento' }); continue; }

      if (isNumericType && numStats.isCurrency && numStats.avg > 10) {
        const isCostWord = /custo|cost|spend|gasto|invest/i.test(n);
        suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: isCostWord ? 'investimento' : 'revenue', transformation: 'currency', confidence: 88, reason: `Moeda detectada (média ${numStats.avg.toFixed(2)})` });
        continue;
      }

      const isRate = /rate|taxa|percent|conv_lead|conv_msg|ctr|churn|growth|crescimento|taxa_entrada|taxa_conv/i.test(n);
      if (isRate && isNumericType) {
        let target = 'conversion_rate';
        let conf = 90;
        if (/churn/i.test(n)) { target = 'churn_rate'; conf = 95; }
        else if (/growth|crescimento/i.test(n)) { target = 'growth_rate'; conf = 93; }
        else if (/ctr/i.test(n)) { target = 'ctr'; conf = 93; }
        else if (/conv_lead|taxa_conv|conversion_rate/i.test(n)) { target = 'conversion_rate'; conf = 96; }
        suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: target, transformation: 'percentage', confidence: conf, reason: `Taxa "${col.name}"` });
        continue;
      }

      if (isNumericType && numStats.isPercentage && numStats.hasDecimals && !numStats.isCurrency) {
        suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: n.replace(/[^a-z0-9]/g, '_'), transformation: 'percentage', confidence: 82, reason: `Percentual detectado (0-100 com decimais, média ${numStats.avg.toFixed(1)})` });
        continue;
      }

      if (/meetings_done|reuniao_realizada|realizada_total/i.test(n) && isNumericType) { suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'meetings_done', transformation: 'number', confidence: 95, reason: 'Reuniões realizadas' }); continue; }
      if (/meetings_booked|meetings_scheduled|reuniao_agendada|agendada_total/i.test(n) && isNumericType) { suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'meetings_scheduled', transformation: 'number', confidence: 95, reason: 'Reuniões agendadas' }); continue; }

      if (/msg_in|msg_out|mensagens|messages_total/i.test(n) && isNumericType) { suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'mensagens', transformation: 'number', confidence: 93, reason: 'Mensagens' }); continue; }

      if (/calls_done|calls_answered|ligacoes_realizadas/i.test(n) && isNumericType) { suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'calls_done', transformation: 'number', confidence: 94, reason: 'Ligações' }); continue; }
      if (/total_spent.*usd|calls.*spent|vapi.*cost/i.test(n) && isNumericType) { suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'total_spent_calls', transformation: 'currency', confidence: 92, reason: 'Custo ligações' }); continue; }

      if (/^status$|^stage$|stage_name|stage_key|^etapa$|^fase$/i.test(n)) { suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'funnel_stage', transformation: 'text', confidence: 88, reason: 'Estágio funil' }); continue; }
      if (/(^|_)(source|origem|canal|fonte|utm_source|anuncio|midia)(_|$)/i.test(n)) { suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'lead_source', transformation: 'text', confidence: 88, reason: 'Origem/canal' }); continue; }
      if (!isNumericType && /(^|_)(destino|interesse|categoria|category|segmento|produto|servico|tipo_|_tipo|grupo|regiao|interesse_)/i.test(n)) { suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'funnel_stage', transformation: 'text', confidence: 80, reason: `Dimensão categórica "${col.name}" → agrupamento` }); continue; }

      if (isNumericType && numStats.isNumeric && !numStats.isCurrency && !numStats.isPercentage && tableIsAggregated) {
        suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'total_leads', transformation: 'number', confidence: 72, reason: 'Numérico genérico em view agregada — provável contagem' });
      }
    }
  }

  const deduped = new Map();
  for (const s of suggestions) {
    const key = `${s.sourceTable}.${s.sourceField}`;
    if (!deduped.has(key) || deduped.get(key).confidence < s.confidence) deduped.set(key, s);
  }
  const priorityOrder = ['revenue', 'total_leads', 'conversions', 'conversion_rate', 'mrr', 'investimento', 'cpl', 'new_leads', 'meetings_total', 'meetings_scheduled', 'meetings_done', 'mensagens', 'calls_done'];
  const sorted = Array.from(deduped.values()).sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    const ai = priorityOrder.indexOf(a.targetMetric);
    const bi = priorityOrder.indexOf(b.targetMetric);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return 0;
  }).slice(0, 25);

  return { success: true, suggestions: sorted, primaryTable, method: 'heuristic' };
}

/* ── recommend-widgets ──────────────────────────────────────────────────── */
export const METRIC_SCORES = {
  total_leads: { widget: 'metric_card', baseScore: 95, format: 'number' },
  new_leads: { widget: 'metric_card', baseScore: 93, format: 'number' },
  conversions: { widget: 'metric_card', baseScore: 92, format: 'number' },
  conversion_rate: { widget: 'metric_card', baseScore: 91, format: 'percentage' },
  revenue: { widget: 'metric_card', baseScore: 94, format: 'currency' },
  mrr: { widget: 'metric_card', baseScore: 93, format: 'currency' },
  avg_ticket: { widget: 'metric_card', baseScore: 85, format: 'currency' },
  growth_rate: { widget: 'metric_card', baseScore: 84, format: 'percentage' },
  ltv: { widget: 'metric_card', baseScore: 82, format: 'currency' },
  cac: { widget: 'metric_card', baseScore: 81, format: 'currency' },
  churn_rate: { widget: 'metric_card', baseScore: 80, format: 'percentage' },
  meetings_total: { widget: 'metric_card', baseScore: 90, format: 'number' },
  meetings_scheduled: { widget: 'metric_card', baseScore: 90, format: 'number' },
  meetings_done: { widget: 'metric_card', baseScore: 89, format: 'number' },
  mensagens: { widget: 'metric_card', baseScore: 84, format: 'number' },
  calls_done: { widget: 'metric_card', baseScore: 84, format: 'number' },
  investimento: { widget: 'metric_card', baseScore: 90, format: 'currency' },
  cpl: { widget: 'metric_card', baseScore: 88, format: 'currency' },
  cpm_meeting: { widget: 'metric_card', baseScore: 86, format: 'currency' },
  lead_source: { widget: 'pie_chart', baseScore: 87 },
  funnel_stage: { widget: 'funnel', baseScore: 89 },
  created_date: { widget: 'area_chart', baseScore: 88 },
};

// data_mappings NÃO persiste `aggregation` → recommend-widgets INFERE por métrica.
export const COUNT_METRICS = new Set(['total_leads', 'new_leads', 'conversions', 'meetings_total', 'meetings_scheduled', 'meetings_done', 'mensagens', 'calls_done']);
export function inferAggregation(targetMetric, format, explicit) {
  if (explicit) return explicit;
  if (COUNT_METRICS.has(targetMetric)) return 'count';
  if (format === 'percentage') return 'avg';
  return 'sum';
}

export const WIDGET_DESCRIPTIONS = {
  total_leads: { title: 'Total de Leads', description: '...' },
  new_leads: { title: 'Novos Leads', description: '...' },
  conversions: { title: 'Conversões', description: '...' },
  conversion_rate: { title: 'Taxa de Conversão', description: '...' },
  revenue: { title: 'Receita Total', description: '...' },
  mrr: { title: 'Receita Recorrente Mensal', description: '...' },
  avg_ticket: { title: 'Ticket Médio', description: '...' },
  growth_rate: { title: 'Taxa de Crescimento', description: '...' },
  meetings_total: { title: 'Com Reunião', description: '...' },
  meetings_scheduled: { title: 'Reuniões Agendadas', description: '...' },
  meetings_done: { title: 'Reuniões Realizadas', description: '...' },
  mensagens: { title: 'Mensagens', description: '...' },
  calls_done: { title: 'Ligações Realizadas', description: '...' },
  investimento: { title: 'Investimento', description: '...' },
  cpl: { title: 'Custo por Lead', description: '...' },
  cpm_meeting: { title: 'Custo por Reunião', description: '...' },
};

export function calculateScore(baseScore, hasTemporalData, hasCategoricalData, mappingsCount) {
  let score = baseScore;
  if (mappingsCount >= 5) score += 2;
  if (hasTemporalData) score += 1;
  if (hasCategoricalData) score += 1;
  return Math.min(99, score);
}

export function detectDataPatterns(mappings) {
  const patterns = { hasTemporalData: false, hasCategoricalData: false, hasMonetaryData: false, hasPercentageData: false, hasFunnelData: false, metrics: new Set() };
  for (const m of mappings) {
    patterns.metrics.add(m.target_metric);
    if (m.target_metric === 'created_date' || m.source_column.toLowerCase().includes('date') || m.source_column.toLowerCase().includes('created') || m.source_column.toLowerCase().includes('updated') || m.transform_type === 'date') patterns.hasTemporalData = true;
    if (m.target_metric === 'lead_source' || m.source_column.toLowerCase().includes('source') || m.source_column.toLowerCase().includes('status') || m.source_column.toLowerCase().includes('type') || m.source_column.toLowerCase().includes('category')) patterns.hasCategoricalData = true;
    if (['revenue', 'mrr', 'avg_ticket', 'ltv', 'cac'].includes(m.target_metric) || m.format === 'currency' || m.transform_type === 'currency') patterns.hasMonetaryData = true;
    if (['conversion_rate', 'growth_rate', 'churn_rate'].includes(m.target_metric) || m.format === 'percentage' || m.transform_type === 'percentage') patterns.hasPercentageData = true;
    if (m.target_metric === 'funnel_stage' || m.source_column.toLowerCase().includes('stage') || m.source_column.toLowerCase().includes('funnel')) patterns.hasFunnelData = true;
  }
  return patterns;
}

export function generateRecommendations(mappings) {
  const recommendations = [];
  const patterns = detectDataPatterns(mappings);
  const addedTypes = new Set();
  const mappingByTarget = new Map();
  for (const m of mappings) if (!mappingByTarget.has(m.target_metric)) mappingByTarget.set(m.target_metric, m);

  const isAggregatedViewTable = (t) => /^vw_|^view_/i.test(t.toLowerCase()) || /kpi|_30d|_60d|_7d|summary|overview|dashboard/i.test(t.toLowerCase());

  const buildMetricCardConfig = (targetMetric, format) => {
    const m = mappingByTarget.get(targetMetric);
    if (m) return { metric: m.source_column, dataSource: m.source_table, sourceTable: m.source_table, targetMetric, aggregation: inferAggregation(targetMetric, format, m.aggregation), format, transformation: m.transform_type || format, isAggregatedView: isAggregatedViewTable(m.source_table), showTrend: true, showSparkline: true };
    return { metric: targetMetric, targetMetric, format, showTrend: true, showSparkline: true };
  };
  const buildTimeSeriesConfig = (targetMetric, format) => {
    const timeseriesMapping = mappings.find((m) => m.target_metric === targetMetric && /daily|diario|_60d|_90d/i.test(m.source_table.toLowerCase())) || mappingByTarget.get(targetMetric);
    const dateMapping = mappings.find((m) => m.target_metric === 'created_date' || /day|dia|date|data|created_at/i.test(m.source_column));
    const cfg = { showGrid: true, gradientFill: true, animate: true, curveType: 'smooth', showTooltip: true };
    if (timeseriesMapping) { cfg.metric = timeseriesMapping.source_column; cfg.dataSource = timeseriesMapping.source_table; cfg.sourceTable = timeseriesMapping.source_table; cfg.targetMetric = targetMetric; cfg.aggregation = inferAggregation(targetMetric, format, timeseriesMapping.aggregation); cfg.format = format; cfg.isAggregatedView = false; }
    cfg.groupBy = dateMapping ? dateMapping.source_column : 'day';
    return cfg;
  };
  const buildCategoricalConfig = (categoryMetric, valueMetric) => {
    const catMapping = mappingByTarget.get(categoryMetric);
    const valMapping = valueMetric ? mappingByTarget.get(valueMetric) : undefined;
    const cfg = { showLabels: true, showLegend: true, animate: true };
    if (catMapping) { cfg.dataSource = catMapping.source_table; cfg.sourceTable = catMapping.source_table; cfg.groupBy = catMapping.source_column; }
    if (valMapping) { cfg.metric = valMapping.source_column; cfg.aggregation = valMapping.aggregation || 'count'; } else cfg.aggregation = 'count';
    return cfg;
  };

  for (const mapping of mappings) {
    const metricConfig = METRIC_SCORES[mapping.target_metric];
    if (metricConfig && metricConfig.widget === 'metric_card') {
      const key = `metric_card_${mapping.target_metric}`;
      if (addedTypes.has(key)) continue;
      addedTypes.add(key);
      const widgetDesc = WIDGET_DESCRIPTIONS[mapping.target_metric] || { title: mapping.target_metric.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), description: '' };
      recommendations.push({ type: 'metric_card', title: widgetDesc.title, score: calculateScore(metricConfig.baseScore, patterns.hasTemporalData, patterns.hasCategoricalData, mappings.length), config: buildMetricCardConfig(mapping.target_metric, metricConfig.format || 'number'), basedOn: `${mapping.source_table}.${mapping.source_column} → ${mapping.target_metric}` });
    }
  }

  const mainMetric = patterns.metrics.has('total_leads') ? 'total_leads' : patterns.metrics.has('new_leads') ? 'new_leads' : patterns.metrics.has('revenue') ? 'revenue' : [...patterns.metrics][0];

  if (patterns.hasTemporalData || mappings.length > 0) recommendations.push({ type: 'area_chart', title: 'Evolução de Leads', score: calculateScore(88, patterns.hasTemporalData, patterns.hasCategoricalData, mappings.length), config: buildTimeSeriesConfig(mainMetric || 'total_leads', 'number'), basedOn: 'temporal/fallback' });
  if (patterns.hasTemporalData && (patterns.metrics.has('conversions') || patterns.metrics.has('conversion_rate'))) { const convMetric = patterns.metrics.has('conversion_rate') ? 'conversion_rate' : 'conversions'; recommendations.push({ type: 'line_chart', title: 'Tendência de Conversões', score: calculateScore(82, true, patterns.hasCategoricalData, mappings.length), config: buildTimeSeriesConfig(convMetric, convMetric === 'conversion_rate' ? 'percentage' : 'number'), basedOn: 'conv+temporal' }); }
  if (patterns.hasCategoricalData || patterns.metrics.has('lead_source')) recommendations.push({ type: 'pie_chart', title: 'Distribuição por Origem', score: calculateScore(87, patterns.hasTemporalData, patterns.hasCategoricalData, mappings.length), config: { ...buildCategoricalConfig('lead_source', mainMetric), innerRadius: 60 }, basedOn: 'categórico' });
  if (patterns.hasFunnelData || (patterns.metrics.has('total_leads') && patterns.metrics.has('conversions'))) { const funnelMapping = mappingByTarget.get('funnel_stage') || mappingByTarget.get('total_leads'); recommendations.push({ type: 'funnel', title: 'Funil de Vendas', score: calculateScore(89, patterns.hasTemporalData, patterns.hasCategoricalData, mappings.length), config: { dataSource: funnelMapping?.source_table, sourceTable: funnelMapping?.source_table, groupBy: funnelMapping?.source_column, aggregation: 'count' }, basedOn: 'funil' }); }
  if (patterns.hasCategoricalData || patterns.metrics.has('lead_source') || patterns.hasFunnelData || patterns.metrics.has('funnel_stage')) recommendations.push({ type: 'bar_chart', title: 'Leads por Status', score: calculateScore(83, patterns.hasTemporalData, patterns.hasCategoricalData, mappings.length), config: { ...buildCategoricalConfig('funnel_stage', mainMetric), stacked: false }, basedOn: 'categórico' });

  const leadsMapping = mappingByTarget.get('total_leads') || mappingByTarget.get('new_leads') || mappings[0];
  recommendations.push({ type: 'table', title: 'Últimos Leads', score: 80, config: { dataSource: leadsMapping?.source_table, sourceTable: leadsMapping?.source_table, pageSize: 10, sortable: true, searchable: true }, basedOn: `tabela ${leadsMapping?.source_table || '?'}` });
  recommendations.push({ type: 'insight_card', title: 'Insights IA', score: 75, config: {}, basedOn: 'IA' });

  return recommendations.sort((a, b) => b.score - a.score);
}

/* ── aproximação da persistência do frontend (DROPA aggregation de propósito) ── */
export function adaptMappings(suggestions) {
  return suggestions.map((s) => ({
    source_table: s.sourceTable,
    source_column: s.sourceField,
    target_metric: s.targetMetric,
    transform_type: s.transformation,
    format: s.transformation,
    // aggregation OMITIDO de propósito (data_mappings não persiste)
  }));
}
