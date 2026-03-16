/**
 * Pinn BAI — data-profiler.ts  (v2)
 *
 * Melhorias em relação à v1:
 *  - Detecção de views agregadas (vw_*, _30d, _60d, _7d) com scoring elevado
 *  - Contexto de negócio: distingue custo vs receita, taxa vs contagem
 *  - Relevância por semântica de nome (não só palavras-chave genéricas)
 *  - Suporte a padrões brasileiros: custo_total, reuniao_realizada, etc.
 *  - profileSchema: analisa schema remoto com stat de cardinalidade
 *  - recommendWidgets: usa as métricas identificadas para gerar widgets úteis
 */

import { WidgetType, WidgetConfig } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type ColumnSemantics =
  | 'metric_count'       // contagem: leads, registros, usuários
  | 'metric_currency'    // valor monetário: receita, custo, ticket
  | 'metric_percentage'  // taxa: conversão, churn, growth
  | 'metric_rate'        // cpl, cpm — moeda/unidade composta
  | 'dimension_date'     // coluna temporal para groupBy
  | 'dimension_category' // coluna categórica: status, source, stage
  | 'dimension_id'       // chave primária / foreign key
  | 'text_descriptive'   // nome, email, descrição — irrelevante para métricas
  | 'unknown';

export interface ProfiledColumn {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'email' | 'category';
  semantics: ColumnSemantics;
  relevance: number;    // 0..1
  suggestedAggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
  suggestedFormat: 'number' | 'currency' | 'percentage' | 'date' | 'text';
}

export interface ProfiledTable {
  name: string;
  isAggregatedView: boolean;  // vw_*, view_*, sufixo _30d/_60d/_7d
  priority: number;           // score de prioridade (views > tabelas brutas)
  columns: ProfiledColumn[];
}

export interface RecommendedWidget {
  type: WidgetType;
  title: string;
  description: string;
  config: WidgetConfig;
  width: number;
  height: number;
  priority: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// DataProfiler
// ─────────────────────────────────────────────────────────────────────────────

export class DataProfiler {

  // ── API pública ──────────────────────────────────────────────────────────

  /** Perfila dados reais (array de rows) */
  static profile(data: Record<string, unknown>[]): ProfiledColumn[] {
    if (!data?.length) return [];
    const columns = Object.keys(data[0]);
    return columns.map(col => {
      const values = data.map(r => r[col]).filter(v => v != null);
      const type = this.detectType(values);
      const semantics = this.detectSemantics(col, type, values);
      return {
        name: col,
        type,
        semantics,
        relevance: this.calculateRelevance(col, type, semantics),
        suggestedAggregation: this.suggestAggregation(semantics),
        suggestedFormat: this.suggestFormat(semantics),
      };
    });
  }

  /**
   * Perfila schema remoto (ex: Supabase information_schema).
   * Recebe lista de { name, type, sampleValues? }.
   */
  static profileRemoteSchema(
    schema: { name: string; type: string; sampleValues?: unknown[] }[]
  ): ProfiledColumn[] {
    return schema.map(col => {
      const type = this.mapRemoteType(col.type);
      const semantics = this.detectSemantics(col.name, type, col.sampleValues ?? []);
      return {
        name: col.name,
        type,
        semantics,
        relevance: this.calculateRelevance(col.name, type, semantics),
        suggestedAggregation: this.suggestAggregation(semantics),
        suggestedFormat: this.suggestFormat(semantics),
      };
    });
  }

  /**
   * Perfila múltiplas tabelas e retorna com scoring de prioridade.
   * Views agregadas recebem prioridade máxima.
   */
  static profileTables(
    tables: {
      name: string;
      schema: { name: string; type: string; sampleValues?: unknown[] }[];
    }[]
  ): ProfiledTable[] {
    return tables
      .map(t => {
        const isAggregated = this.isAggregatedView(t.name);
        const priority = this.scoreTable(t.name, t.schema.length);
        const columns = this.profileRemoteSchema(t.schema);
        return { name: t.name, isAggregatedView: isAggregated, priority, columns };
      })
      .sort((a, b) => b.priority - a.priority);
  }

  /** Gera recomendações de widgets a partir das colunas perfiladas */
  static recommendWidgets(
    profiledColumns: ProfiledColumn[],
    tableName: string = '',
    _plan: number = 1
  ): RecommendedWidget[] {
    const recommendations: RecommendedWidget[] = [];
    const sorted = [...profiledColumns].sort((a, b) => b.relevance - a.relevance);

    const metrics   = sorted.filter(c => c.semantics.startsWith('metric_'));
    const dateCol   = sorted.find(c => c.semantics === 'dimension_date');
    const catCol    = sorted.find(c => c.semantics === 'dimension_category');

    // 1. Metric Cards — KPIs mais relevantes (máx 6)
    metrics.slice(0, 6).forEach((m, idx) => {
      const label = this.humanLabel(m.name);
      recommendations.push({
        type: 'metric_card',
        title: label,
        description: `${m.suggestedAggregation.toUpperCase()} de ${m.name}`,
        config: {
          metric: m.name,
          dataSource: tableName,
          aggregation: m.suggestedAggregation,
          transformation: m.suggestedFormat,
          showTrend: true,
          showSparkline: true,
        },
        width: 2,
        height: 1,
        priority: 100 - idx,
      });
    });

    // 2. Gráficos temporais — se tem data + métrica
    if (dateCol && metrics[0]) {
      const mainMetric = metrics[0];
      recommendations.push({
        type: 'area_chart',
        title: `Evolução — ${this.humanLabel(mainMetric.name)}`,
        description: `Tendência temporal de ${mainMetric.name}`,
        config: {
          metric: mainMetric.name,
          dataSource: tableName,
          groupBy: dateCol.name,
          aggregation: mainMetric.suggestedAggregation,
          transformation: mainMetric.suggestedFormat,
          gradientFill: true,
          showGrid: true,
        },
        width: 6,
        height: 2,
        priority: 80,
      });

      if (metrics[1]) {
        recommendations.push({
          type: 'line_chart',
          title: `Tendência — ${this.humanLabel(metrics[1].name)}`,
          description: `Linha temporal de ${metrics[1].name}`,
          config: {
            metric: metrics[1].name,
            dataSource: tableName,
            groupBy: dateCol.name,
            aggregation: metrics[1].suggestedAggregation,
            transformation: metrics[1].suggestedFormat,
          },
          width: 6,
          height: 2,
          priority: 75,
        });
      }
    }

    // 3. Distribuição por categoria
    if (catCol && metrics[0]) {
      recommendations.push({
        type: 'bar_chart',
        title: `Por ${this.humanLabel(catCol.name)}`,
        description: `Distribuição de ${metrics[0].name} por ${catCol.name}`,
        config: {
          metric: metrics[0].name,
          dataSource: tableName,
          groupBy: catCol.name,
          aggregation: metrics[0].suggestedAggregation,
        },
        width: 6,
        height: 2,
        priority: 70,
      });

      recommendations.push({
        type: 'pie_chart',
        title: `Composição — ${this.humanLabel(catCol.name)}`,
        description: `Proporcionalidade por ${catCol.name}`,
        config: {
          metric: metrics[0].name,
          dataSource: tableName,
          groupBy: catCol.name,
          aggregation: 'count',
          showLegend: true,
        },
        width: 6,
        height: 2,
        priority: 65,
      });
    }

    // 4. Funil — se tem colunas de estágio/stage
    const stageCol = sorted.find(c => /stage|etapa|fase|funil|funnel/i.test(c.name));
    if (stageCol && metrics[0]) {
      recommendations.push({
        type: 'funnel',
        title: 'Funil de Conversão',
        description: `Progressão por ${stageCol.name}`,
        config: {
          metric: metrics[0].name,
          dataSource: tableName,
          groupBy: stageCol.name,
          aggregation: 'count',
        },
        width: 12,
        height: 2,
        priority: 60,
      });
    }

    // 5. Tabela de dados brutos
    if (sorted.length >= 3) {
      const tableCols = sorted.slice(0, 8).map(c => c.name);
      recommendations.push({
        type: 'table',
        title: 'Detalhamento',
        description: 'Visão tabular dos registros',
        config: {
          dataSource: tableName,
          columns: tableCols,
          pageSize: 10,
        },
        width: 12,
        height: 3,
        priority: 40,
      });
    }

    // 6. Insight IA — sempre
    recommendations.push({
      type: 'insight_card',
      title: 'Análise Inteligente',
      description: 'Insights automáticos gerados pela IA da plataforma',
      config: {},
      width: 12,
      height: 2,
      priority: 50,
    });

    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  // ── Métodos privados ─────────────────────────────────────────────────────

  private static isAggregatedView(name: string): boolean {
    return /^vw_|^view_|^v\d+_/i.test(name) ||
           /_30d|_60d|_7d|_90d/i.test(name) ||
           /kpi|dashboard|summary|metrics|agregad/i.test(name);
  }

  private static scoreTable(name: string, columnCount: number): number {
    let score = columnCount; // mais colunas = mais rico
    if (/^vw_|^view_|^v\d+_/i.test(name))         score += 50;
    if (/kpi|dashboard|summary|metrics/i.test(name)) score += 40;
    if (/funil|funnel|custos|costs/i.test(name))    score += 30;
    if (/daily|diario|dia/i.test(name))             score += 20;
    if (/_30d|_60d|_7d/i.test(name))               score += 15;
    if (/lead|cliente|customer/i.test(name))        score += 15;
    if (/sale|venda|revenue|pedido/i.test(name))    score += 15;
    if (/msg|message|kommo/i.test(name))            score += 10;
    if (/call|vapi|ligac/i.test(name))              score += 10;
    if (/log|audit|event/i.test(name))              score -= 20; // penaliza logs
    return score;
  }

  private static mapRemoteType(remoteType: string): ProfiledColumn['type'] {
    const t = remoteType.toLowerCase();
    if (t.includes('int') || t.includes('float') || t.includes('numeric') || t.includes('double') || t.includes('decimal')) return 'number';
    if (t.includes('date') || t.includes('timestamp') || t.includes('time')) return 'date';
    if (t.includes('bool')) return 'boolean';
    return 'string';
  }

  private static detectType(values: unknown[]): ProfiledColumn['type'] {
    if (!values.length) return 'string';
    const first = values[0];
    if (typeof first === 'number') return 'number';
    if (typeof first === 'boolean') return 'boolean';
    if (typeof first === 'string') {
      if (!isNaN(Date.parse(first)) && isNaN(Number(first))) return 'date';
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(first)) return 'email';
      const unique = new Set(values);
      if (unique.size < values.length * 0.15) return 'category';
    }
    return 'string';
  }

  private static detectSemantics(
    name: string,
    type: ProfiledColumn['type'],
    values: unknown[]
  ): ColumnSemantics {
    const n = name.toLowerCase();

    // IDs — nunca mapear como métrica
    if (/^id$|^uuid$|_id$|_uuid$|^pk$/i.test(name)) return 'dimension_id';

    // Datas
    if (type === 'date' || /^day$|^dia$|^date$|^data$|created_at|updated_at|_at$|_ts$|event_day|day_brt/i.test(name)) {
      return 'dimension_date';
    }

    // Categorias
    if (type === 'category' || /^status$|^stage$|^etapa$|^fase$|^source$|^origem$|^canal$|^tipo$|stage_name|stage_key/i.test(name)) {
      return 'dimension_category';
    }

    // Emails / texto longo
    if (type === 'email' || /email|nome|name|descr|observ|comment/i.test(n)) {
      return 'text_descriptive';
    }

    if (type !== 'number') return 'unknown';

    // A partir daqui: coluna numérica — classificar semântica

    // Taxa / percentual
    if (/rate|taxa|percent|conv_lead|conv_msg|ctr|churn|growth|crescimento/i.test(n)) {
      return 'metric_percentage';
    }

    // CPL / CPM — custo composto por unidade
    if (/^cpl$|cpl_|cp_meeting|custo_por_lead|cost_per_lead|custo_por_reuniao|cost_per_meeting/i.test(n)) {
      return 'metric_rate';
    }

    // Moeda — receita / custo / gasto
    if (/revenue|receita|faturamento|mrr|spend|gasto|custo_total|invest|ticket|price|preco|valor|amount|lucro|profit|spent_usd/i.test(n)) {
      return 'metric_currency';
    }

    // Valores numéricos altos sugerem moeda
    const nums = values
      .map(v => (typeof v === 'number' ? v : parseFloat(String(v).replace(/[R$,\s%]/g, '.'))))
      .filter(n => !isNaN(n));
    if (nums.length > 0) {
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      const hasDecimals = nums.some(v => v % 1 !== 0);
      if (avg > 100 && hasDecimals) return 'metric_currency';
      if (avg > 0 && avg <= 1 && hasDecimals) return 'metric_percentage';
    }

    // Contagem / total
    return 'metric_count';
  }

  private static calculateRelevance(
    name: string,
    type: ProfiledColumn['type'],
    semantics: ColumnSemantics
  ): number {
    const n = name.toLowerCase();

    // IDs e texto descritivo: irrelevantes
    if (semantics === 'dimension_id' || semantics === 'text_descriptive') return 0.05;

    // Datas e categorias: relevantes como dimensões (groupBy)
    if (semantics === 'dimension_date') return 0.70;
    if (semantics === 'dimension_category') return 0.55;

    // Métricas — base por semântica
    let score = 0.50;
    if (semantics === 'metric_currency')    score = 0.92;
    if (semantics === 'metric_percentage')  score = 0.88;
    if (semantics === 'metric_rate')        score = 0.90;
    if (semantics === 'metric_count')       score = 0.80;

    // Boost por palavras-chave de negócio de alto valor
    const highValue = [
      'receita', 'revenue', 'mrr', 'faturamento',
      'leads_total', 'total_leads', 'lead_count',
      'meetings_done', 'reuniao_realizada',
      'conv', 'conversion', 'conversao',
      'custo_total', 'spend_total', 'investimento',
      'cpl', 'cp_meeting',
    ];
    if (highValue.some(kw => n.includes(kw))) score = Math.min(0.98, score + 0.06);

    // Boost para sufixos de views agregadas (já pré-calculado)
    if (/_30d|_60d|_7d|_total$/i.test(name)) score = Math.min(0.97, score + 0.04);

    return score;
  }

  private static suggestAggregation(semantics: ColumnSemantics): 'sum' | 'avg' | 'count' | 'min' | 'max' {
    switch (semantics) {
      case 'metric_currency':   return 'sum';
      case 'metric_count':      return 'sum';
      case 'metric_percentage': return 'avg';
      case 'metric_rate':       return 'avg';
      case 'dimension_date':    return 'count';
      case 'dimension_category': return 'count';
      default:                  return 'count';
    }
  }

  private static suggestFormat(semantics: ColumnSemantics): 'number' | 'currency' | 'percentage' | 'date' | 'text' {
    switch (semantics) {
      case 'metric_currency':    return 'currency';
      case 'metric_percentage':  return 'percentage';
      case 'metric_rate':        return 'currency';
      case 'metric_count':       return 'number';
      case 'dimension_date':     return 'date';
      default:                   return 'text';
    }
  }

  /** Converte snake_case / camelCase para label humano */
  private static humanLabel(colName: string): string {
    const labels: Record<string, string> = {
      total_leads: 'Total de Leads',
      new_leads: 'Novos Leads',
      leads_total: 'Total de Leads',
      leads_total_30d: 'Leads (30d)',
      leads_30d: 'Leads (30d)',
      revenue: 'Receita Total',
      mrr: 'MRR',
      spend_total: 'Investimento Total',
      custo_total: 'Custo Total',
      meetings_done: 'Reuniões Realizadas',
      meetings_booked: 'Reuniões Agendadas',
      conversion_rate: 'Taxa de Conversão',
      conv_lead_to_meeting: 'Conv. Lead → Reunião',
      taxa_entrada: 'Taxa de Entrada',
      msg_in_30d: 'Mensagens (30d)',
      cpl: 'CPL',
      cpl_30d: 'CPL (30d)',
      cp_meeting_booked: 'Custo por Reunião',
      calls_done: 'Ligações Realizadas',
      active_users: 'Usuários Ativos',
    };
    if (labels[colName]) return labels[colName];

    return colName
      .replace(/_30d$/i, ' (30d)')
      .replace(/_60d$/i, ' (60d)')
      .replace(/_7d$/i, ' (7d)')
      .replace(/_total$/i, ' Total')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }
}
