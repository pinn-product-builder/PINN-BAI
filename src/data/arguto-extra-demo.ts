/**
 * Pinn BAI — Arguto Demo Fixtures (extras)
 * Mock data for screens fora do hub /arguto (Saúde do Cliente, CAC+LTV,
 * Insights, Metas & Alertas, Integrações, Auditoria CRM).
 * Não plugar em produção. Usado só quando slug === "arguto".
 */

import type {
  CustomerAlert,
  CustomerHealthScore,
  HealthBand,
  AlertSeverity,
  Integration,
} from '@/lib/types';
import type { UnitEconomicsSummary } from '@/hooks/useUnitEconomics';
import type { KpiAlertRule, KpiGoal, KpiTrigger } from '@/hooks/useKpiGoals';

const ORG_ID = 'b72718e7-6a54-4ff8-9bbf-24d1573ddb43';
const NOW = new Date();
const iso = (offsetDays: number, h = 0) =>
  new Date(NOW.getTime() - offsetDays * 86_400_000 + h * 3_600_000).toISOString();

/** Date-only (YYYY-MM-DD) — Goals.tsx concatena 'T12:00:00' antes de parsear. */
const dateOnly = (offsetDays: number) =>
  new Date(NOW.getTime() - offsetDays * 86_400_000).toISOString().substring(0, 10);

/* ═══════════════════════════ SAÚDE DO CLIENTE ═══════════════════════════ */

const CUSTOMER_NAMES: Array<{ name: string; email: string }> = [
  { name: 'Mercado Central LTDA',     email: 'compras@mercadocentral.com.br' },
  { name: 'Distrib. Bom Preço',        email: 'pedidos@bompreco.com.br' },
  { name: 'Atacarejo Triângulo',       email: 'atacarejotriangulo@hotmail.com' },
  { name: 'Mercado São José',          email: 'contato@msaojose.com.br' },
  { name: 'Padaria Vovó Maria',        email: 'vovomaria@gmail.com' },
  { name: 'Distrib. Cerrado',          email: 'cerrado@distribcerrado.com' },
  { name: 'Supermercados Aliança',     email: 'compras@redealianca.com.br' },
  { name: 'Rede Bom Dia',              email: 'compras@bomdia.com.br' },
  { name: 'Mercearia Boa Vista',       email: 'boavista.merc@outlook.com' },
  { name: 'Atacado Sertão',            email: 'sertao@atacadosertao.com' },
  { name: 'Supermercado Família',      email: 'familia@supfamilia.com.br' },
  { name: 'Mercado Esperança',         email: 'esperanca@hotmail.com' },
  { name: 'Distrib. Real',             email: 'real@distribreal.com.br' },
  { name: 'Atacado Vale do Sol',       email: 'valedosol@yahoo.com.br' },
  { name: 'Padaria Pão Quente',        email: 'paoquente@gmail.com' },
  { name: 'Mercado Popular',           email: 'popular@mercadopopular.com' },
];

const SIGNAL_OPTIONS: Array<{ type: string; label: string; severity: AlertSeverity }> = [
  { type: 'ciclo_atrasado',    label: 'Ciclo de recompra atrasado',  severity: 'warning' },
  { type: 'mix_caindo',        label: 'Mix caiu 28% em 60 dias',     severity: 'warning' },
  { type: 'ticket_subindo',    label: 'Ticket subindo 18% no tri.',  severity: 'info' },
  { type: 'recompra_iminente', label: 'Recompra iminente (P=84%)',   severity: 'info' },
  { type: 'sem_pedido_30d',    label: 'Sem pedido há 41 dias',       severity: 'critical' },
  { type: 'concorrente',       label: 'Sinal de concorrente ativo',  severity: 'critical' },
  { type: 'queda_freq',        label: 'Frequência -32% no tri.',     severity: 'warning' },
];

function bandFor(score: number): HealthBand {
  if (score >= 70) return 'saudavel';
  if (score >= 50) return 'atencao';
  if (score >= 30) return 'risco';
  return 'critico';
}

const HEALTH_SCORE_SEED = [
  92, 88, 84, 79, 76, 74, 71, 68, 64, 58, 52, 47, 38, 31, 22, 18,
];

export const DEMO_HEALTH_SCORES: CustomerHealthScore[] = HEALTH_SCORE_SEED.map((score, i) => {
  const cust = CUSTOMER_NAMES[i];
  const band = bandFor(score);
  const sigCount = band === 'saudavel' ? 1 : band === 'atencao' ? 2 : 3;
  const signals = SIGNAL_OPTIONS
    .filter((s) => {
      if (band === 'saudavel') return s.severity === 'info';
      if (band === 'atencao')  return s.severity !== 'critical';
      return true;
    })
    .slice(0, sigCount);
  return {
    id: `health-${i + 1}`,
    org_id: ORG_ID,
    customer_key: `cust-${i + 1}`,
    customer_name: cust.name,
    customer_email: cust.email,
    health_score: score,
    health_band: band,
    engagement_score: Math.max(10, Math.min(100, score + (i % 5) * 2 - 4)),
    revenue_score:    Math.max(10, Math.min(100, score + (i % 3) * 5 - 2)),
    momentum_score:   Math.max(10, Math.min(100, score - (i % 4) * 6 + 3)),
    loyalty_score:    Math.max(10, Math.min(100, score + (i % 6) * 3 - 6)),
    health_delta: i % 3 === 0 ? +4 : i % 3 === 1 ? -3 : 0,
    trend: i % 3 === 0 ? 'up' : i % 3 === 1 ? 'down' : 'stable',
    signals,
    calculated_at: iso(0, -2),
  };
});

const _byBand: Record<string, number> = {
  saudavel: DEMO_HEALTH_SCORES.filter((s) => s.health_band === 'saudavel').length,
  atencao:  DEMO_HEALTH_SCORES.filter((s) => s.health_band === 'atencao').length,
  risco:    DEMO_HEALTH_SCORES.filter((s) => s.health_band === 'risco').length,
  critico:  DEMO_HEALTH_SCORES.filter((s) => s.health_band === 'critico').length,
};

export const DEMO_HEALTH_SUMMARY = {
  total: DEMO_HEALTH_SCORES.length,
  avgScore: Math.round(
    DEMO_HEALTH_SCORES.reduce((s, r) => s + r.health_score, 0) / DEMO_HEALTH_SCORES.length,
  ),
  byBand: _byBand,
  improving: DEMO_HEALTH_SCORES.filter((s) => s.trend === 'up').length,
  declining: DEMO_HEALTH_SCORES.filter((s) => s.trend === 'down').length,
  critico:  _byBand['critico']  ?? 0,
  risco:    _byBand['risco']    ?? 0,
  atencao:  _byBand['atencao']  ?? 0,
  saudavel: _byBand['saudavel'] ?? 0,
};

export const DEMO_CUSTOMER_ALERTS: CustomerAlert[] = [
  {
    id: 'alert-1', org_id: ORG_ID, customer_key: 'cust-15', customer_name: 'Padaria Pão Quente',
    alert_type: 'churn_iminente', severity: 'critical',
    title: 'Padaria Pão Quente está prestes a sair',
    description: 'Sem pedidos há 41 dias (padrão 22d). Receita 12m atrelada: R$ 89k. Visita de retenção urgente.',
    metadata: null as any, acknowledged: false, resolved: false, created_at: iso(0, -3),
  },
  {
    id: 'alert-2', org_id: ORG_ID, customer_key: 'cust-16', customer_name: 'Mercado Popular',
    alert_type: 'churn_critico', severity: 'critical',
    title: 'Mercado Popular — sinal de concorrente',
    description: 'Frequência caiu 47% no último trimestre. CRM registra menção a fornecedor concorrente.',
    metadata: null as any, acknowledged: false, resolved: false, created_at: iso(1, 4),
  },
  {
    id: 'alert-3', org_id: ORG_ID, customer_key: 'cust-13', customer_name: 'Distrib. Real',
    alert_type: 'queda_mix', severity: 'critical',
    title: 'Distrib. Real reduziu mix em 38%',
    description: 'Saiu de 14 SKUs ativos pra 9 em 60d. Receita exposta: R$ 47k/mês.',
    metadata: null as any, acknowledged: true, resolved: false, created_at: iso(2, 1),
  },
  {
    id: 'alert-4', org_id: ORG_ID, customer_key: 'cust-9', customer_name: 'Mercearia Boa Vista',
    alert_type: 'ciclo_atrasado', severity: 'warning',
    title: 'Mercearia Boa Vista — ciclo atrasado',
    description: 'Cliente previsível (CV 14%) sem pedido há 18 dias contra padrão de 12. Visita amanhã.',
    metadata: null as any, acknowledged: false, resolved: false, created_at: iso(0, -6),
  },
  {
    id: 'alert-5', org_id: ORG_ID, customer_key: 'cust-12', customer_name: 'Mercado Esperança',
    alert_type: 'queda_freq', severity: 'warning',
    title: 'Mercado Esperança — frequência caindo',
    description: 'Pedidos no mês: 3 contra média de 5 nos últimos 6 meses. Atenção comercial.',
    metadata: null as any, acknowledged: false, resolved: false, created_at: iso(1, -2),
  },
  {
    id: 'alert-6', org_id: ORG_ID, customer_key: 'cust-14', customer_name: 'Atacado Vale do Sol',
    alert_type: 'mix_subexplorado', severity: 'warning',
    title: 'Atacado Vale do Sol — mix subexplorado',
    description: 'Compra 38% do mix que similares carregam. Potencial de R$ 12k/mês em HPC + bebidas.',
    metadata: null as any, acknowledged: false, resolved: false, created_at: iso(3, 0),
  },
  {
    id: 'alert-7', org_id: ORG_ID, customer_key: 'cust-2', customer_name: 'Distrib. Bom Preço',
    alert_type: 'recompra_iminente', severity: 'info',
    title: 'Distrib. Bom Preço — recompra iminente',
    description: 'P=87% de pedido nos próximos 7 dias. Pré-pedido sugerido com 6 SKUs HPC.',
    metadata: null as any, acknowledged: false, resolved: false, created_at: iso(0, -1),
  },
];

/* ═══════════════════════════ CAC + LTV ═══════════════════════════ */

export const DEMO_UNIT_ECONOMICS: UnitEconomicsSummary = {
  totalSpend: 184_500,
  organicConversions: 42,
  paidConversions: 168,
  totalConversions: 210,
  totalRevenue: 4_410_000,
  avgTicket: 21_000,
  cac: 1_098,
  ltv: 18_900,
  ltvCacRatio: 17.21,
  paybackMonths: 1.4,
  avgRetentionMonths: 18,
  byChannel: [
    {
      channel: 'meta_ads',
      spend: 84_500,
      conversions: 71,
      revenue: 1_491_000,
      cac: 1_190,
      ltv: 18_900,
      ltvCacRatio: 15.88,
      paybackMonths: 1.5,
    },
    {
      channel: 'google_ads',
      spend: 78_000,
      conversions: 64,
      revenue: 1_344_000,
      cac: 1_218,
      ltv: 18_900,
      ltvCacRatio: 15.52,
      paybackMonths: 1.6,
    },
    {
      channel: 'linkedin_ads',
      spend: 22_000,
      conversions: 33,
      revenue: 693_000,
      cac: 667,
      ltv: 18_900,
      ltvCacRatio: 28.34,
      paybackMonths: 0.8,
    },
    {
      channel: 'organic',
      spend: 0,
      conversions: 42,
      revenue: 882_000,
      cac: 0,
      ltv: 18_900,
      ltvCacRatio: Infinity,
      paybackMonths: 0,
    },
  ],
};

/* ═══════════════════════════ INTELIGÊNCIA IA ═══════════════════════════ */

export const DEMO_INSIGHTS = [
  {
    type: 'recommendation' as const,
    priority: 'high' as const,
    title: 'Re-priorizar 318 visitas da semana',
    content:
      '318 visitas planejadas têm probabilidade < 20% de conversão (R$ 67k/semana desperdiçados). O modelo BAI já ranqueou substitutos prob ≥ 60% — economia projetada de R$ 230k/mês mantendo o time intacto.',
    evidence: 'Modelo Conversão Predictor (LightGBM) · 12.500 visitas/mês baseline · Erro médio 7,2pp',
    metric: '+R$ 230k/mês',
  },
  {
    type: 'alert' as const,
    priority: 'high' as const,
    title: '89 clientes em risco alto de churn',
    content:
      '89 clientes com prob churn 12m ≥ 70%. Receita atrelada: R$ 1,8M. Janela ideal de ação: próximas 2 semanas. Top razão: recência > 2× ciclo (43% dos casos).',
    evidence: 'Pipeline predict-churn · LightGBM em 22 features · AUC 0,87 em validação',
    metric: 'R$ 1,8M em risco',
  },
  {
    type: 'trend' as const,
    priority: 'medium' as const,
    title: 'Conversão por visita acelerando em 3 vendedores',
    content:
      'Carlos M., Ana P. e Roberto S. subiram a conversão em +18pp no trimestre. Mapear o que esses três fizeram diferente e replicar pro restante do time (média atual 38%).',
    evidence: 'CRM Arguto · 90 dias rolling · Cohort vendedores ativos',
    metric: '+18pp em 3 vendedores',
  },
  {
    type: 'recommendation' as const,
    priority: 'medium' as const,
    title: '247 clientes prontos pra comprar mas sem contato',
    content:
      'Clientes com prob recompra ≥ 80% em 14d e zero contato nos últimos 7d. Receita exposta: R$ 4,2M. Top-12 já estão na rota da aba Operação ranqueados por distância.',
    evidence: 'Pipeline Signal Detection · Ciclo médio por cliente (CV < 20%)',
    metric: '247 clientes / R$ 4,2M',
  },
  {
    type: 'trend' as const,
    priority: 'low' as const,
    title: 'Mix HPC cresce 11% trimestre vs trimestre',
    content:
      'Categoria higiene pessoal teve crescimento orgânico de 11% no Q em 612 clientes. Sinaliza apetite de catálogo — vale priorizar essa categoria nas próximas campanhas comerciais.',
    evidence: 'ERP fiscal · histórico SKU-level · 3 trimestres',
    metric: '+11% Q/Q',
  },
  {
    type: 'alert' as const,
    priority: 'low' as const,
    title: 'Concentração de mix top 3 em 68% da receita',
    content:
      'Top 3 SKUs respondem por 68% da receita. Cliente médio carrega 5,3 SKUs ativos vs 9,2 do potencial. Vulnerabilidade: shock em qualquer top-SKU derruba 22% do P&L.',
    evidence: 'Análise de cesta · 12 meses · Cluster de similares',
    metric: '68% concentração',
  },
];

/* ═══════════════════════════ METAS & ALERTAS ═══════════════════════════ */

const PERIOD_START = dateOnly(15);
const PERIOD_END = dateOnly(-15);

export const DEMO_KPI_GOALS: KpiGoal[] = [
  {
    id: 'goal-1', org_id: ORG_ID,
    name: 'Conversão por visita 50%+',
    metric_key: 'conversion_rate',
    target_value: 50, current_value: 38,
    unit: 'percent', period_type: 'quarter',
    period_start: PERIOD_START, period_end: PERIOD_END,
    icon: 'target', color: '#FF6B35', created_at: iso(45),
  },
  {
    id: 'goal-2', org_id: ORG_ID,
    name: 'Receita trimestre R$ 32M',
    metric_key: 'total_revenue',
    target_value: 32_400_000, current_value: 27_800_000,
    unit: 'currency', period_type: 'quarter',
    period_start: PERIOD_START, period_end: PERIOD_END,
    icon: 'dollar', color: '#2E7D32', created_at: iso(40),
  },
  {
    id: 'goal-3', org_id: ORG_ID,
    name: 'LTV:CAC mínimo 15x',
    metric_key: 'ltv_cac_ratio',
    target_value: 15, current_value: 17.2,
    unit: 'number', period_type: 'quarter',
    period_start: PERIOD_START, period_end: PERIOD_END,
    icon: 'trending-up', color: '#1D4ED8', created_at: iso(60),
  },
  {
    id: 'goal-4', org_id: ORG_ID,
    name: 'Health Score médio ≥ 65',
    metric_key: 'health_score_avg',
    target_value: 65, current_value: 58,
    unit: 'number', period_type: 'month',
    period_start: PERIOD_START, period_end: PERIOD_END,
    icon: 'heart', color: '#E55A2B', created_at: iso(20),
  },
  {
    id: 'goal-5', org_id: ORG_ID,
    name: 'Churn rate < 6%',
    metric_key: 'churn_rate',
    target_value: 6, current_value: 4.2,
    unit: 'percent', period_type: 'quarter',
    period_start: PERIOD_START, period_end: PERIOD_END,
    icon: 'shield', color: '#C62828', created_at: iso(30),
  },
  {
    id: 'goal-6', org_id: ORG_ID,
    name: 'Ticket médio R$ 2.500',
    metric_key: 'avg_ticket',
    target_value: 2_500, current_value: 2_100,
    unit: 'currency', period_type: 'month',
    period_start: PERIOD_START, period_end: PERIOD_END,
    icon: 'dollar', color: '#F57C00', created_at: iso(25),
  },
];

export const DEMO_KPI_ALERT_RULES: KpiAlertRule[] = [
  {
    id: 'rule-1', org_id: ORG_ID,
    name: 'CAC > R$ 1.500', metric_key: 'cac',
    operator: 'gt', threshold: 1500, severity: 'warning',
    channel: 'in_app', enabled: true,
    last_triggered_at: null, created_at: iso(60),
  },
  {
    id: 'rule-2', org_id: ORG_ID,
    name: 'Churn rate > 8%', metric_key: 'churn_rate',
    operator: 'gt', threshold: 8, severity: 'critical',
    channel: 'email', enabled: true,
    last_triggered_at: null, created_at: iso(50),
  },
  {
    id: 'rule-3', org_id: ORG_ID,
    name: 'Conversão < 35%', metric_key: 'conversion_rate',
    operator: 'lt', threshold: 35, severity: 'warning',
    channel: 'in_app', enabled: true,
    last_triggered_at: iso(2), created_at: iso(45),
  },
  {
    id: 'rule-4', org_id: ORG_ID,
    name: 'LTV:CAC < 12x', metric_key: 'ltv_cac_ratio',
    operator: 'lt', threshold: 12, severity: 'critical',
    channel: 'email', enabled: false,
    last_triggered_at: null, created_at: iso(30),
  },
  {
    id: 'rule-5', org_id: ORG_ID,
    name: 'Health médio < 50', metric_key: 'health_score_avg',
    operator: 'lt', threshold: 50, severity: 'warning',
    channel: 'in_app', enabled: true,
    last_triggered_at: iso(7), created_at: iso(25),
  },
];

export const DEMO_KPI_TRIGGERS: KpiTrigger[] = [
  {
    id: 'trigger-1', rule_id: 'rule-3', org_id: ORG_ID,
    metric_key: 'conversion_rate',
    actual_value: 33.4, threshold: 35, operator: 'lt',
    resolved: false, created_at: iso(2),
    kpi_alert_rules: { name: 'Conversão < 35%', severity: 'warning', metric_key: 'conversion_rate' },
  },
  {
    id: 'trigger-2', rule_id: 'rule-5', org_id: ORG_ID,
    metric_key: 'health_score_avg',
    actual_value: 48.1, threshold: 50, operator: 'lt',
    resolved: false, created_at: iso(7),
    kpi_alert_rules: { name: 'Health médio < 50', severity: 'warning', metric_key: 'health_score_avg' },
  },
];

/* ═══════════════════════════ INTEGRAÇÕES ═══════════════════════════ */

export const DEMO_INTEGRATIONS: Integration[] = [
  {
    id: 'int-1', org_id: ORG_ID,
    name: 'ERP Fiscal Arguto', type: 'api',
    status: 'connected',
    config: { endpoint: 'https://erp.arguto.local/api/v1', authType: 'bearer' } as any,
    last_sync_at: iso(0, -1), sync_error: null,
    created_at: iso(120), updated_at: iso(0, -1),
  },
  {
    id: 'int-2', org_id: ORG_ID,
    name: 'Ploomes CRM (Arguto)', type: 'ploomes',
    status: 'connected',
    config: { account: 'arguto' } as any,
    last_sync_at: iso(0, -3), sync_error: null,
    created_at: iso(95), updated_at: iso(0, -3),
  },
  {
    id: 'int-3', org_id: ORG_ID,
    name: 'Google Sheets — Metas Comerciais', type: 'google_sheets',
    status: 'connected',
    config: { spreadsheetId: '1abc...meta-comercial-2026' } as any,
    last_sync_at: iso(1, 4), sync_error: null,
    created_at: iso(60), updated_at: iso(1, 4),
  },
  {
    id: 'int-4', org_id: ORG_ID,
    name: 'Catálogo SKU (CSV nightly)', type: 'csv',
    status: 'syncing',
    config: { source: 'sftp://arguto/catalog/' } as any,
    last_sync_at: iso(0, -2), sync_error: null,
    created_at: iso(45), updated_at: iso(0, 0),
  },
  {
    id: 'int-5', org_id: ORG_ID,
    name: 'Smartlead — Outbound B2B', type: 'smartlead',
    status: 'error',
    config: { campaignId: 'arguto-q2' } as any,
    last_sync_at: iso(3, 2), sync_error: 'Token expirado · reconectar OAuth',
    created_at: iso(30), updated_at: iso(3, 2),
  },
  {
    id: 'int-6', org_id: ORG_ID,
    name: 'Supabase — DW analítico', type: 'supabase',
    status: 'connected',
    config: { projectRef: 'arguto-dw' } as any,
    last_sync_at: iso(0, -0.5), sync_error: null,
    created_at: iso(150), updated_at: iso(0, -0.5),
  },
  {
    id: 'int-7', org_id: ORG_ID,
    name: 'Cold Mail Hackers (LinkedIn)', type: 'coldmail',
    status: 'pending',
    config: { } as any,
    last_sync_at: null, sync_error: null,
    created_at: iso(2), updated_at: iso(2),
  },
];

/* ═══════════════════════════ RFM + CHURN ═══════════════════════════ */
/* Shape do hook useRfmChurnAnalysis quando há scores persistidos. */

const RFM_SEGMENTS = [
  'Champions', 'Leais', 'Potenciais Leais', 'Recentes',
  'Promissores', 'Atenção', 'Em Risco', 'Hibernando',
] as const;

const rfmCustomerSeed: Array<{ name: string; email: string; mon: number; freq: number; rec: number; churn: number }> = [
  { name: 'Mercado Central LTDA',     email: 'compras@mercadocentral.com.br',  mon: 184_000, freq: 22, rec: 9,  churn: 0.08 },
  { name: 'Distrib. Bom Preço',        email: 'pedidos@bompreco.com.br',         mon: 142_000, freq: 17, rec: 14, churn: 0.12 },
  { name: 'Atacarejo Triângulo',       email: 'atacarejotriangulo@hotmail.com',  mon: 198_000, freq: 25, rec: 6,  churn: 0.05 },
  { name: 'Supermercados Aliança',     email: 'compras@redealianca.com.br',      mon: 167_000, freq: 19, rec: 11, churn: 0.10 },
  { name: 'Distrib. Cerrado',          email: 'cerrado@distribcerrado.com',      mon:  98_000, freq: 14, rec: 16, churn: 0.18 },
  { name: 'Rede Bom Dia',              email: 'compras@bomdia.com.br',           mon:  84_000, freq: 11, rec: 22, churn: 0.27 },
  { name: 'Atacado Sertão',            email: 'sertao@atacadosertao.com',        mon: 113_000, freq: 13, rec: 18, churn: 0.21 },
  { name: 'Supermercado Família',      email: 'familia@supfamilia.com.br',       mon:  72_000, freq:  9, rec: 28, churn: 0.34 },
  { name: 'Mercado Esperança',         email: 'esperanca@hotmail.com',           mon:  61_000, freq:  7, rec: 35, churn: 0.44 },
  { name: 'Atacado Vale do Sol',       email: 'valedosol@yahoo.com.br',          mon:  54_000, freq:  6, rec: 38, churn: 0.48 },
  { name: 'Mercado São José',          email: 'contato@msaojose.com.br',         mon:  47_000, freq:  5, rec: 41, churn: 0.58 },
  { name: 'Distrib. Real',             email: 'real@distribreal.com.br',         mon:  41_000, freq:  4, rec: 46, churn: 0.64 },
  { name: 'Padaria Vovó Maria',        email: 'vovomaria@gmail.com',             mon:  18_000, freq:  3, rec: 54, churn: 0.71 },
  { name: 'Mercearia Boa Vista',       email: 'boavista.merc@outlook.com',       mon:   9_400, freq:  2, rec: 62, churn: 0.78 },
  { name: 'Padaria Pão Quente',        email: 'paoquente@gmail.com',             mon:   6_800, freq:  2, rec: 71, churn: 0.84 },
  { name: 'Mercado Popular',           email: 'popular@mercadopopular.com',      mon:   4_200, freq:  1, rec: 82, churn: 0.89 },
];

function rfmSegmentFor(rec: number, freq: number, mon: number): string {
  if (freq >= 15 && rec <= 14)            return 'Champions';
  if (freq >= 10 && rec <= 21)            return 'Leais';
  if (freq >= 8 && rec <= 28)             return 'Potenciais Leais';
  if (rec <= 14)                          return 'Recentes';
  if (rec <= 28 && freq <= 6)             return 'Promissores';
  if (rec >= 30 && rec <= 50 && freq>= 4) return 'Atenção';
  if (rec >= 35 && freq >= 5)             return 'Em Risco';
  return 'Hibernando';
}

function rfmScoreBucket(value: number, max: number, higherIsBetter = true): number {
  const ratio = Math.min(1, value / max);
  return higherIsBetter
    ? 1 + Math.round(ratio * 4)
    : Math.max(1, 5 - Math.round(ratio * 4));
}

export const DEMO_RFM_PERSISTED_LEADS = rfmCustomerSeed.map((c, i) => {
  const calculatedAt = iso(0, -1);
  const rScore = rfmScoreBucket(c.rec, 90, false);
  const fScore = rfmScoreBucket(c.freq, 25, true);
  const mScore = rfmScoreBucket(c.mon, 200_000, true);
  const segment = rfmSegmentFor(c.rec, c.freq, c.mon);
  const band = c.churn >= 0.6 ? 'alto' : c.churn >= 0.3 ? 'medio' : 'baixo';
  return {
    id: `rfm-${i + 1}`,
    name: c.name,
    email: c.email,
    status: 'new',
    value: c.mon,
    created_at: calculatedAt,
    updated_at: calculatedAt,
    converted_at: null,
    _rfm: {
      customer_key:   `cust-${i + 1}`,
      customer_name:  c.name,
      customer_email: c.email,
      recency_days:   c.rec,
      frequency:      c.freq,
      monetary:       c.mon,
      r_score:        rScore,
      f_score:        fScore,
      m_score:        mScore,
      rfm_score:      `${rScore}${fScore}${mScore}`,
      rfm_segment:    segment,
      calculated_at:  calculatedAt,
    },
    _churn: {
      customer_key:      `cust-${i + 1}`,
      churn_probability: c.churn,
      churn_risk_band:   band,
    },
  };
});

/* ═══════════════════════════ AUDITORIA CRM ═══════════════════════════ */
/* Payload modela o shape esperado por CrmAuditDashboard.tsx (Kommo audit). */

export const DEMO_CRM_AUDIT_DASHBOARD: Record<string, unknown> = {
  tenant_id: ORG_ID,
  last_sync_at: iso(0, -2),
  overview: {
    total_leads_all_status: 412,
    total_active_leads:     286,
    total_won_leads:         84,
    total_lost_leads:        42,
    total_open_pipeline_value: 8_240_000,
  },
  scores: {
    general_0_100:           72,
    hygiene_0_100:           81,
    discipline_0_100:        64,
    risk_commercial_0_100:   58,
    forecast_0_100:          76,
    engagement_0_100:        69,
    crm_data_quality_0_100:  81,
    operation_0_100:         67,
  },
  data_quality_breakdown: {
    contacts_without_email: 224,
    contacts_without_phone: 87,
    duplicate_email_keys:    19,
  },
  gaps_and_risks: [
    { category: 'higiene',     title: '47 deals sem atividade há > 21 dias',           detail: 'R$ 1,1M parado · risco de queda automática.', severity: 'high' },
    { category: 'disciplina',  title: 'Campo "Próximo passo" vazio em 32% dos abertos', detail: '132 de 412 sem next-step preenchido.',         severity: 'high' },
    { category: 'forecast',    title: 'Negociação com idade média de 28 dias',          detail: 'Benchmark do setor: 14 dias.',                 severity: 'medium' },
    { category: 'higiene',     title: 'Origem vazia em 18% das contas',                 detail: '224 contas sem source → CAC por canal cego.',   severity: 'medium' },
    { category: 'engagement',  title: '38 propostas enviadas há > 14d sem follow-up',   detail: 'Conversão histórica cai 47%→12% após 14d.',     severity: 'high' },
    { category: 'higiene',     title: 'Tags inconsistentes em 22% dos contatos',        detail: '"Industria B2B" vs "industria-b2b" misturado.', severity: 'low' },
  ],
  strengths: [
    { title: 'Win rate acima do benchmark',     detail: '20,4% vs 14% benchmark B2B distribuição.' },
    { title: 'Valor estimado preenchido em 91%', detail: 'Forecast tem base sólida pra projeção.' },
    { title: 'Cadência de notas saudável',       detail: 'Média de 4,2 notas por deal aberto.' },
  ],
  stage_distribution: [
    { stage_name: 'Prospecção',       lead_count: 142, pct_of_open_pipeline: 49.7 },
    { stage_name: 'Qualificação',     lead_count:  96, pct_of_open_pipeline: 33.6 },
    { stage_name: 'Proposta enviada', lead_count:  78, pct_of_open_pipeline: 27.3 },
    { stage_name: 'Negociação',       lead_count:  54, pct_of_open_pipeline: 18.9 },
    { stage_name: 'Fechamento',       lead_count:  26, pct_of_open_pipeline:  9.1 },
    { stage_name: 'Won',              lead_count:  16, pct_of_open_pipeline:  5.6 },
  ],
  lost_reasons: [
    { lost_reason: 'Preço',               cnt: 14 },
    { lost_reason: 'Sem retorno',          cnt: 11 },
    { lost_reason: 'Concorrente',           cnt: 8 },
    { lost_reason: 'Timing',                cnt: 5 },
    { lost_reason: '(não informado)',       cnt: 4 },
  ],
  owners: [
    { owner_name: 'Carlos M.',  open_leads: 62, open_value: 1_984_000 },
    { owner_name: 'Ana P.',     open_leads: 54, open_value: 1_512_000 },
    { owner_name: 'Roberto S.', open_leads: 41, open_value: 1_230_000 },
    { owner_name: 'Juliana F.', open_leads: 38, open_value:   972_000 },
    { owner_name: 'Marcos T.',  open_leads: 31, open_value:   744_000 },
  ],
  pipeline_health: [
    { stage_name: 'Prospecção',       open_leads: 142, lost_leads:  4, open_pipeline_value: 2_840_000 },
    { stage_name: 'Qualificação',     open_leads:  96, lost_leads:  8, open_pipeline_value: 1_920_000 },
    { stage_name: 'Proposta enviada', open_leads:  78, lost_leads: 15, open_pipeline_value: 1_794_000 },
    { stage_name: 'Negociação',       open_leads:  54, lost_leads: 11, open_pipeline_value: 1_350_000 },
    { stage_name: 'Fechamento',       open_leads:  26, lost_leads:  4, open_pipeline_value:   336_000 },
  ],
  samples: {
    counts: { stuck_leads: 47, no_next_action_leads: 132, overdue_tasks: 38 },
    stuck_leads: [],
    no_next_action_leads: [],
    overdue_tasks: [],
  },
  engagement: {
    counts: { notes: 1_842, events: 526, calls: 297, emails: 1_104 },
  },
  sync_stats: { contacts: 1_247, leads: 412, tasks: 318 },
  extended_catalog: { loss_reasons: [] },
};

/* ═══════════════════════════ PARECER IA (Auditoria CRM) ═══════════════════════════ */
/* Payload modela o shape esperado pela aba "Parecer IA" do CrmAuditDashboard. */

export const DEMO_CRM_AI_REPORT: Record<string, unknown> = {
  overall_verdict: 'warning',
  operation_score: 67,
  model_used: 'claude-opus-4-7 · auditoria deterministica + camada generativa',
  executive_summary:
    'A operação comercial da Arguto opera com pipeline saudável em volume (412 deals · R$ 8,24M em aberto) e win rate acima do benchmark do setor (20,4% vs 14%), porém com disciplina de cadência abaixo do necessário pra sustentar o crescimento previsto.\n\n' +
    'O gargalo central é o estágio "Proposta enviada": 38 propostas (R$ 720k em volume) estão há mais de 14 dias sem follow-up. A conversão histórica do estágio cai de 47% pra 12% após esse threshold — ou seja, dois terços desses deals estão em risco evitável de queda. Some-se a isso 47 deals sem atividade há > 21 dias (R$ 1,1M expostos) e o quadro de fricção operacional fica claro.\n\n' +
    'A qualidade do dado é o ponto mais forte da operação (81/100): valor estimado preenchido em 91% dos deals, cadência média de 4,2 notas por deal aberto. O atrito vem da falta de validação no momento da criação — origem vazia em 18% das contas (224 ao todo) cega completamente a análise de CAC por canal, e 32% dos deals abertos não têm "próximo passo" preenchido, transformando o forecast em chutômetro.\n\n' +
    'Recomendação principal: implementar cadência automática D+3/D+7/D+14 no estágio "Proposta enviada" com escalada pro gestor, e validation rules no Ploomes pra "Próximo passo" e "Origem". Impacto estimado: recuperação de ~R$ 540k em pipeline atualmente em risco + ganho de visibilidade de CAC por canal.',

  main_bottlenecks: [
    {
      title: 'Propostas enviadas sem follow-up em > 14 dias',
      severity: 'critical',
      metric: '38 deals · R$ 720k em volume',
      detail: 'Maior gargalo do funil. A conversão histórica do estágio "Proposta enviada" cai de 47% pra 12% quando passa de 14d sem contato. Esses 38 deals representam pipeline em queda livre.',
      root_cause: 'Ausência de cadência automatizada no estágio "Proposta enviada". Vendedor depende de memória/agenda manual pra fazer o follow-up no timing certo.',
      financial_impact: '~R$ 540k em risco evitável (75% × R$ 720k baseado em diferença de conversão)',
    },
    {
      title: 'Deals sem atividade há mais de 21 dias',
      severity: 'high',
      metric: '47 deals · R$ 1,1M expostos',
      detail: '11% do pipeline ativo sem qualquer registro de interação (visita, ligação, e-mail, nota) há ≥ 21 dias. Em B2B distribuição esse threshold é vermelho: cliente já decidiu (com ou sem você).',
      root_cause: 'Falta de workflow automático de reativação. Vendedor não recebe alerta quando deal "esfria".',
      financial_impact: 'R$ 1,1M em volume aberto · estimativa de perda: 60-70% sem ação imediata',
    },
    {
      title: 'Tempo médio em "Negociação" 2x acima do benchmark',
      severity: 'high',
      metric: '28 dias médio (benchmark setor: 14 dias)',
      detail: '54 deals em "Negociação" com idade média de 28 dias indica falta de habilidade de fechamento ou propostas mal estruturadas que geram volta-pra-revisão.',
      root_cause: 'Hipótese 1: propostas comerciais com gaps de informação. Hipótese 2: gestor não tem ritual de coaching nas negociações longas.',
      financial_impact: 'R$ 810k presos no estágio com risco de erosão de margem por concessão',
    },
    {
      title: 'Origem vazia em 18% das contas',
      severity: 'medium',
      metric: '224 contas sem campo "Origem"',
      detail: 'Impossível medir CAC por canal. Investimento em prospecção/mídia paga vira caixa-preta — não se sabe o que está gerando os deals que fecham.',
      root_cause: 'Campo não-obrigatório no formulário de criação. Ausência de UTM auto-fill na captação via formulário web.',
      financial_impact: '—',
    },
  ],

  funnel_analysis: [
    {
      pipeline_name: 'Pipeline Principal · Distribuição B2B',
      leads_open: 286,
      total_value: 6_240_000,
      conversion_rate: 20.4,
      bottleneck_stage: 'Proposta enviada',
      severity: 'high',
      problems: [
        'Conversão "Qualificação → Proposta" caiu de 64% pra 51% no último trimestre.',
        '78 deals em "Proposta enviada" — 38 deles em risco (> 14 dias sem contato).',
        'Volume entrando em "Negociação" cresce, mas tempo médio dobrou em 6 meses.',
      ],
      recommendation: 'Cadência automática D+3/D+7/D+14 em "Proposta enviada" + revisão semanal das negociações longas no rito comercial.',
    },
    {
      pipeline_name: 'Pipeline Inbound · Pré-vendas',
      leads_open: 86,
      total_value: 1_290_000,
      conversion_rate: 14.8,
      bottleneck_stage: 'Qualificação',
      severity: 'medium',
      problems: [
        '63 leads em "Qualificação" sem next-step preenchido.',
        'Lead time médio até primeiro contato: 38h (target: < 4h).',
      ],
      recommendation: 'SLA de 4h pra primeiro contato + obrigatoriedade de next-step antes de avançar etapa.',
    },
    {
      pipeline_name: 'Pipeline Renovação · Carteira ativa',
      leads_open: 40,
      total_value: 710_000,
      conversion_rate: 76.0,
      bottleneck_stage: null,
      severity: 'low',
      problems: [
        'Volume baixo — só 40 contas em renovação ativa no Q.',
        'Sem fricção identificada nesse fluxo.',
      ],
      recommendation: 'Aumentar volume puxando renovações com 90 dias de antecedência. Hoje o time só ativa em 60d.',
    },
  ],

  task_discipline: {
    overdue_tasks: 38,
    no_next_action: 132,
    stuck_leads: 47,
    stuck_threshold_days: 21,
    severity: 'high',
    assessment:
      '47 deals parados há > 21 dias, 132 sem próximo passo preenchido e 38 tarefas vencidas indicam quebra de cadência sistemática — não é falha de pessoa específica, é falha de processo. A operação está rodando no "modo bombeiro" (resolver o que grita) em vez de cadência preventiva.',
    pattern: 'Disciplina alta nos primeiros 10 dias do deal e cai progressivamente após semana 2.',
  },

  data_hygiene: {
    score_0_100: 81,
    diagnosis:
      'Higiene de dado está acima da média (81/100), com 91% de preenchimento em "Valor estimado" e 88% em CNPJ. Os pontos fracos são "Próximo passo" (68%) e "Decisor identificado" (54%) — campos diretamente ligados à execução comercial. Tags inconsistentes em 22% dos contatos comprometem segmentação de campanhas.',
    issues: [
      {
        title: 'Campo "Próximo passo" vazio em 32% dos deals abertos',
        severity: 'high',
        qty: 132, pct: 32.0,
        detail: 'Sem next-step, o forecast vira chutômetro e o handoff entre vendedores em férias quebra.',
        impact: 'Forecast com erro médio > 25%',
        fix: 'Validation rule no Ploomes: impedir avanço de etapa sem next-step preenchido. Treino de 15min com vendedores.',
      },
      {
        title: 'Origem vazia em 18% das contas',
        severity: 'high',
        qty: 224, pct: 18.0,
        detail: '224 contas sem campo source. Impossível atribuir CAC por canal.',
        impact: 'Decisões de investimento em mídia cegas',
        fix: 'Required field + UTM auto-fill no formulário web. Backfill manual das 50 contas top.',
      },
      {
        title: 'Decisor identificado preenchido em apenas 54%',
        severity: 'medium',
        qty: 189, pct: 46.0,
        detail: 'Em quase metade dos deals abertos não se sabe quem decide. Cycle stretching e perda de poder de fogo na negociação.',
        impact: 'Negociações se arrastam · risco de proposta apresentada pro stakeholder errado',
        fix: 'Adicionar etapa de qualificação obrigatória com 3 perguntas (decisor / orçamento / timing).',
      },
      {
        title: 'Tags inconsistentes em 22% dos contatos',
        severity: 'low',
        qty: 274, pct: 22.0,
        detail: 'Mistura de "Industria B2B", "industria-b2b", "Indústria-B2B" no mesmo workspace.',
        impact: 'Segmentação de campanha imprecisa',
        fix: 'Migration script + lista controlada de tags (controlled vocabulary).',
      },
    ],
  },

  commercial_risks: [
    {
      title: 'Receita do trimestre depende de 12 deals (38% do volume)',
      urgency: 'immediate',
      detail: 'Top 12 deals abertos representam R$ 3,13M de um total de R$ 8,24M. Se 2 deles caem, o trimestre vira amarelo. Vendedores estão sub-priorizando os outros 274 deals.',
      financial_impact: 'R$ 3,13M concentrados · risco de queda > 25% do forecast',
    },
    {
      title: 'Vendedor top concentra 24% do pipeline',
      urgency: 'short_term',
      detail: 'Carlos M. carrega 62 deals (R$ 1,98M). Se sair de férias, licença médica ou pedir desligamento, o trimestre desestabiliza.',
      financial_impact: 'R$ 1,98M sem backup definido',
    },
    {
      title: 'Concentração geográfica em Uberlândia (61% do pipeline)',
      urgency: 'structural',
      detail: 'Operação dependente de uma única praça. Shock regional (greve de transporte, evento de cliente âncora) afeta resultado do mês.',
      financial_impact: 'Vulnerabilidade estrutural · revisar plano de expansão pra Patos/Patrocínio',
    },
  ],

  owner_analysis: [
    {
      owner: 'Carlos M.',
      open_leads: 62, open_value: 1_984_000,
      risk_level: 'high',
      assessment: 'Top performer em volume e qualidade, mas concentra 24% do pipeline da operação.',
      concerns: 'Risco de concentração. Sem backup formal se sair temporariamente.',
    },
    {
      owner: 'Ana P.',
      open_leads: 54, open_value: 1_512_000,
      risk_level: 'medium',
      assessment: 'Disciplina alta em next-step e tags. Conversão acima da média.',
      concerns: '5 deals em "Proposta enviada" > 14 dias sem contato.',
    },
    {
      owner: 'Roberto S.',
      open_leads: 41, open_value: 1_230_000,
      risk_level: 'medium',
      assessment: 'Ramp-up bom, evoluindo. Tem dificuldade em deals > R$ 80k.',
      concerns: 'Coaching estruturado em fechamento de tickets altos.',
    },
    {
      owner: 'Juliana F.',
      open_leads: 38, open_value: 972_000,
      risk_level: 'medium',
      assessment: 'Volume saudável, mas conversão abaixo dos pares (15% vs 22% média).',
      concerns: '8 deals sem atividade há > 21 dias. Avaliar cadência da rotina.',
    },
    {
      owner: 'Marcos T.',
      open_leads: 31, open_value: 744_000,
      risk_level: 'low',
      assessment: 'Sem preocupações críticas identificadas.',
      concerns: 'Sem preocupações críticas identificadas.',
    },
  ],

  lost_reason_analysis: {
    total_lost: 42,
    without_reason_pct: 9.5,
    insight:
      'Das 42 perdas do trimestre, 14 (33%) vão pra "Preço" como motivo principal. Mas o cruzamento com tempo em "Negociação" mostra que metade dessas perdas-por-preço tem > 28 dias no estágio — sinal forte de que o problema real é proposta mal estruturada ou apresentada pro decisor errado, e o cliente usa "preço" como justificativa de saída fácil.',
    top_reasons: [
      { reason: 'Preço', count: 14, pct: 33.3, suggestion: 'Cruzar com tempo em negociação · revisar propostas de deals > 21d no estágio.' },
      { reason: 'Sem retorno do cliente', count: 11, pct: 26.2, suggestion: 'Cadência obrigatória após "Proposta enviada" · ativar fluxo de win-back em 60d.' },
      { reason: 'Concorrente', count: 8, pct: 19.0, suggestion: 'Treino de battle card · entender qual concorrente está ganhando esses deals.' },
      { reason: 'Timing', count: 5, pct: 11.9, suggestion: 'Cadastrar em fluxo de nurturing — esses voltam em 6-12 meses.' },
      { reason: '(não informado)', count: 4, pct: 9.5, suggestion: 'Validation rule: motivo de perda obrigatório antes de mover pra Lost.' },
    ],
    recommendation:
      'Implementar Loss Review semanal de 30min cobrindo as perdas da semana. Validação cruzada do motivo informado pelo vendedor vs. dados objetivos do deal (tempo em estágio, propostas anteriores, decisor mapeado).',
  },

  action_plan: {
    immediate_7d: [
      'Ativar cadência automática D+3/D+7/D+14 em "Proposta enviada" via Ploomes workflows.',
      'Mutirão de reativação: vendedores ligam pros 47 deals parados > 21 dias até sexta.',
      'Bloquear avanço de etapa sem "Próximo passo" preenchido (validation rule).',
      'Reunião 1:1 dos 12 deals top com gestor — destravar bloqueios concretos.',
    ],
    short_term_15d: [
      'Implementar campo obrigatório "Origem" no formulário de criação + UTM auto-fill no site.',
      'Adicionar etapa de qualificação obrigatória (decisor/orçamento/timing) antes de avançar pra "Proposta".',
      'Ritual semanal de Loss Review (30min · gestor + vendedores · 1× por semana).',
      'Onboarding de Roberto S. com Carlos M. em deals > R$ 80k (peer coaching).',
    ],
    structural_30d: [
      'Migration script + controlled vocabulary de tags pra eliminar inconsistências.',
      'Battle cards por concorrente principal (treino + repositório no Ploomes).',
      'Plano de expansão pra Patos de Minas e Patrocínio reduzindo dependência de Uberlândia.',
      'Definir backup formal pros top performers (rotina de shadow + repasse documentado).',
      'Forecast probabilístico no Ploomes (cada etapa com taxa de conversão histórica · não chute do vendedor).',
    ],
  },
};
