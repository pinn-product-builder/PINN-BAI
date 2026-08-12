/**
 * Pinn BAI — Desafio Arguto (Distribuição B2B)
 * Mock fixtures para demo comercial — não plugar em produção.
 */

export type SignalType = 'recompra' | 'churn' | 'mix' | 'upsell';

export const SIGNAL_STYLE: Record<
  SignalType,
  { label: string; bg: string; fg: string; border: string }
> = {
  recompra: {
    label: 'Recompra',
    bg: 'rgba(255,107,53,0.10)',
    fg: '#B8431F',
    border: 'rgba(255,107,53,0.30)',
  },
  churn: {
    label: 'Churn',
    bg: 'rgba(198,40,40,0.10)',
    fg: '#C62828',
    border: 'rgba(198,40,40,0.30)',
  },
  mix: {
    label: 'Mix',
    bg: 'rgba(37,99,235,0.10)',
    fg: '#1D4ED8',
    border: 'rgba(37,99,235,0.30)',
  },
  upsell: {
    label: 'Upsell',
    bg: 'rgba(46,125,50,0.10)',
    fg: '#2E7D32',
    border: 'rgba(46,125,50,0.30)',
  },
};

/* ═══════════════════════════ TELA 1 ═══════════════════════════ */

export const HERO_KPIS = [
  {
    key: 'conversao_visita',
    title: 'Conversão por visita',
    hoje: 38,
    predita: 58,
    delta: 52,
    deltaLabel: '+52% vs hoje',
    subtitle: '−52% de receita perdida hoje',
    format: 'percentage' as const,
    accent: 'orange' as const,
  },
  {
    key: 'receita_90d',
    title: 'Receita prevista 90 dias',
    value: 32_400_000,
    ci: 8,
    subtitle: 'Intervalo de confiança ±8%',
    format: 'currency' as const,
    accent: 'orange' as const,
  },
  {
    key: 'health_score',
    title: 'Health Score da carteira',
    bands: [
      { label: 'Saudável', pct: 41, color: '#2E7D32' },
      { label: 'Atenção',  pct: 28, color: '#F57C00' },
      { label: 'Risco',    pct: 19, color: '#E55A2B' },
      { label: 'Crítico',  pct: 12, color: '#C62828' },
    ],
    subtitle: 'Distribuição de 1.247 clientes ativos',
  },
  {
    key: 'receita_incremental',
    title: 'Receita incremental projetada',
    valueMin: 28_000_000,
    valueMax: 38_000_000,
    subtitle: '12 meses · Pinn BAI vs status quo',
    format: 'currency-range' as const,
    accent: 'orange' as const,
  },
] as const;

export const SECONDARY_ALERTS = [
  {
    key: 'recompra_iminente',
    title: 'Sinal de recompra iminente',
    metric: 247,
    metricLabel: 'clientes',
    money: 4_200_000,
    moneyLabel: 'expostos',
    description: 'Clientes prontos pra comprar nos próximos 14 dias mas que ninguém ainda contatou',
    signal: 'recompra' as SignalType,
  },
  {
    key: 'risco_churn',
    title: 'Risco de churn',
    metric: 89,
    metricLabel: 'clientes',
    money: 1_800_000,
    moneyLabel: 'em risco',
    description: 'Clientes com tendência de queda nos últimos 90 dias',
    signal: 'churn' as SignalType,
  },
  {
    key: 'mix_subexplorado',
    title: 'Mix subexplorado',
    metric: 612,
    metricLabel: 'clientes',
    money: 3_100_000,
    moneyLabel: 'potencial',
    description: 'Clientes comprando <40% do mix que similares compram',
    signal: 'mix' as SignalType,
  },
  {
    key: 'visitas_baixo_retorno',
    title: 'Visitas com baixo retorno',
    metric: 318,
    metricLabel: 'visitas',
    money: 67_000,
    moneyLabel: 'desperdiçado',
    description: 'Visitas planejadas pra essa semana com prob. conversão <20%',
    signal: 'churn' as SignalType,
  },
] as const;

/* ═══════════════════════════ TELA 2 ═══════════════════════════ */

export type ArgutoClient = {
  id: string;
  cliente: string;
  cidade: string;
  scoreICP: number;
  sinal: SignalType;
  sinalDetalhe: string;
  receitaEsperada: number;
  probConversao: number;
  acaoRecomendada: string;
  /* Coords em Uberlândia / Triângulo Mineiro */
  lat: number;
  lng: number;
};

export const ARGUTO_CLIENTS: ArgutoClient[] = [
  {
    id: 'cli-001',
    cliente: 'Mercado Central LTDA',
    cidade: 'Uberlândia',
    scoreICP: 91,
    sinal: 'recompra',
    sinalDetalhe: 'Recompra prevista (23 dias sem compra, padrão 18d)',
    receitaEsperada: 8_400,
    probConversao: 84,
    acaoRecomendada: 'Visitar hoje 14h–16h',
    lat: -18.9186,
    lng: -48.2772,
  },
  {
    id: 'cli-002',
    cliente: 'Distrib. Bom Preço',
    cidade: 'Uberlândia',
    scoreICP: 87,
    sinal: 'mix',
    sinalDetalhe: 'Mix expansion (não compra HPC, similares compram +35%)',
    receitaEsperada: 12_200,
    probConversao: 67,
    acaoRecomendada: 'Apresentar 6 SKUs HPC',
    lat: -18.9300,
    lng: -48.2450,
  },
  {
    id: 'cli-003',
    cliente: 'Atacarejo Triângulo',
    cidade: 'Uberlândia',
    scoreICP: 84,
    sinal: 'upsell',
    sinalDetalhe: 'Recompra + cross-sell (cesta crescendo 18% em 60d)',
    receitaEsperada: 19_800,
    probConversao: 79,
    acaoRecomendada: 'Pré-pedido sugerido (anexo)',
    lat: -18.9050,
    lng: -48.2900,
  },
  {
    id: 'cli-004',
    cliente: 'Mercado São José',
    cidade: 'Araguari',
    scoreICP: 73,
    sinal: 'churn',
    sinalDetalhe: 'Risco churn (queda 32% em 60d)',
    receitaEsperada: 6_100,
    probConversao: 41,
    acaoRecomendada: 'Visita de retenção urgente',
    lat: -18.6450,
    lng: -48.1870,
  },
  {
    id: 'cli-005',
    cliente: 'Padaria Vovó Maria',
    cidade: 'Uberlândia',
    scoreICP: 68,
    sinal: 'upsell',
    sinalDetalhe: 'Upsell (ticket abaixo do potencial 22%)',
    receitaEsperada: 3_300,
    probConversao: 56,
    acaoRecomendada: 'WhatsApp + catálogo premium',
    lat: -18.9420,
    lng: -48.2600,
  },
  {
    id: 'cli-006',
    cliente: 'Distrib. Cerrado',
    cidade: 'Patos de Minas',
    scoreICP: 81,
    sinal: 'recompra',
    sinalDetalhe: 'Recompra prevista (16 dias sem compra, padrão 13d)',
    receitaEsperada: 9_700,
    probConversao: 78,
    acaoRecomendada: 'Ligação comercial amanhã 9h',
    lat: -18.5780,
    lng: -46.5180,
  },
  {
    id: 'cli-007',
    cliente: 'Supermercados Aliança',
    cidade: 'Uberaba',
    scoreICP: 88,
    sinal: 'mix',
    sinalDetalhe: 'Mix gap (4 SKUs HPC, similares carregam 11)',
    receitaEsperada: 15_400,
    probConversao: 71,
    acaoRecomendada: 'Apresentar catálogo HPC + bebidas',
    lat: -19.7470,
    lng: -47.9320,
  },
  {
    id: 'cli-008',
    cliente: 'Rede Bom Dia',
    cidade: 'Ituiutaba',
    scoreICP: 76,
    sinal: 'recompra',
    sinalDetalhe: 'Recompra antecipada (consumo 12% acima)',
    receitaEsperada: 7_900,
    probConversao: 73,
    acaoRecomendada: 'Pré-pedido sugerido',
    lat: -18.9740,
    lng: -49.4630,
  },
  {
    id: 'cli-009',
    cliente: 'Mercearia Boa Vista',
    cidade: 'Araguari',
    scoreICP: 64,
    sinal: 'churn',
    sinalDetalhe: 'Sem pedidos há 41 dias (padrão 22d)',
    receitaEsperada: 2_800,
    probConversao: 38,
    acaoRecomendada: 'Reativação WhatsApp',
    lat: -18.6520,
    lng: -48.1950,
  },
  {
    id: 'cli-010',
    cliente: 'Atacado Sertão',
    cidade: 'Patrocínio',
    scoreICP: 79,
    sinal: 'upsell',
    sinalDetalhe: 'Ticket 28% abaixo do cluster',
    receitaEsperada: 11_300,
    probConversao: 62,
    acaoRecomendada: 'Bundle premium + condição 30/60',
    lat: -18.9430,
    lng: -46.9930,
  },
];

/* ═══════════════════════════ TELA 3 — ROI Sim ═══════════════════════════ */

export const ROI_BASELINE = {
  conversaoHoje: 38,
  conversaoMax: 58,
  ticketHoje: 2_100,
  ticketMax: 2_580,
  mixHoje: 5.3,
  mixMax: 9.2,
  cicloHoje: 27,
  cicloMin: 19,
  custoVisitaHoje: 187,
  custoVisitaMin: 127,
  visitasMesHoje: 12_500,
  visitasMesMin: 8_700,
  receitaIncrementalAnualMin: 28_000_000,
  receitaIncrementalAnualMax: 38_000_000,
};

/* ═══════════════════════════ DRILLDOWN — visualizações prontas ═══════════════════════════ */

/** Tendência 90 dias (line) — pedidos semanais */
export const TENDENCIA_90D = [
  { semana: 'S1',  valor: 7800 }, { semana: 'S2',  valor: 8200 },
  { semana: 'S3',  valor: 7600 }, { semana: 'S4',  valor: 8400 },
  { semana: 'S5',  valor: 8900 }, { semana: 'S6',  valor: 9100 },
  { semana: 'S7',  valor: 8700 }, { semana: 'S8',  valor: 9400 },
  { semana: 'S9',  valor: 9800 }, { semana: 'S10', valor: 10200 },
  { semana: 'S11', valor: 10500 }, { semana: 'S12', valor: 11100 },
  { semana: 'S13', valor: 11400 },
];

/** Concentração de mix top 3 (donut) — vulnerabilidade */
export const CONCENTRACAO_MIX = [
  { sku: 'Top 3 SKUs', pct: 68, color: '#FF6B35' },
  { sku: 'Restante',   pct: 32, color: '#E6E4E0' },
];

/** Performance por vendedor (bar) */
export const PERFORMANCE_VENDEDOR = [
  { nome: 'Carlos M.',  conversao: 62, ticket: 2840, mix: 9.4 },
  { nome: 'Ana P.',     conversao: 54, ticket: 2310, mix: 7.1 },
  { nome: 'Roberto S.', conversao: 47, ticket: 2050, mix: 6.2 },
  { nome: 'Juliana F.', conversao: 41, ticket: 1880, mix: 5.4 },
  { nome: 'Time média', conversao: 38, ticket: 2100, mix: 5.3 },
];

/** Anomalia de pedido — timeline (pedidos vs padrão) */
export const ANOMALIA_PEDIDO = [
  { dia: '01', pedido: 4200, padrao: 4100 },
  { dia: '05', pedido: 4400, padrao: 4200 },
  { dia: '10', pedido: 4100, padrao: 4150 },
  { dia: '15', pedido: 3900, padrao: 4200 },
  { dia: '20', pedido: 4300, padrao: 4250 },
  { dia: '25', pedido: 8900, padrao: 4300, anomaly: true },
  { dia: '30', pedido: 4400, padrao: 4350 },
];

/** Penetração do catálogo por cliente (radial) */
export const PENETRACAO_CATALOGO = {
  pct: 34,
  label: 'SKUs experimentados',
  total: 142,
  experimentados: 48,
};

/* ═══════════════════════ EXPLICAÇÕES DOS CARDS (TELA 1) ═══════════════════════ */

export type MetricExplanation = {
  title: string;
  subtitle: string;
  definition: string;
  calculation: string;
  dataSources: string[];
  breakdown: { label: string; value: string; emphasis?: boolean }[];
  interpretation: string;
  action: string;
  /** Frequência de update */
  refresh: string;
};

export const KPI_EXPLANATIONS: Record<string, MetricExplanation> = {
  conversao_visita: {
    title: 'Conversão por visita',
    subtitle: 'Hoje 38% → predita com BAI 58%',
    definition:
      'Percentual de visitas presenciais ou ligações de prospecção/manutenção que resultam em pedido fechado dentro de 72h após o contato.',
    calculation:
      'pedidos_fechados_72h ÷ (visitas_realizadas + ligações_qualificadas)\nJanela rolling 90 dias, deduplicado por cliente.',
    dataSources: [
      'ERP fiscal Arguto — pedidos com nota emitida',
      'Calendário do vendedor — visitas check-in/out',
      'CRM Arguto — ligações registradas com outcome',
    ],
    breakdown: [
      { label: 'Visitas/mês hoje',          value: '12.500' },
      { label: 'Conversão atual (média time)', value: '38%' },
      { label: 'Conversão com BAI (predita)',  value: '58%', emphasis: true },
      { label: 'Custo médio por visita',     value: 'R$ 187' },
      { label: 'Receita perdida hoje',       value: 'R$ 67k/mês', emphasis: true },
      { label: 'Drivers do lift (decomposição)', value: 'rota +12pp · timing +8pp' },
    ],
    interpretation:
      'A operação tá visitando muito, mas no momento errado e ordem errada. 62% das visitas terminam sem pedido — isso é R$ 805k de custo direto/ano só em deslocamento desperdiçado. O BAI não aumenta o número de visitas, ele substitui visitas-baixo-retorno por visitas-alto-retorno.',
    action:
      'Re-priorizar agenda do vendedor pelas próximas 24h via tabela da aba Operação. Os 5 destinos top já estão ranqueados por receita esperada × tempo de deslocamento.',
    refresh: 'Recalculado a cada 4h durante horário comercial · pipeline incremental',
  },
  receita_90d: {
    title: 'Receita prevista 90 dias',
    subtitle: 'R$ 32,4M ± 8% (intervalo de confiança)',
    definition:
      'Projeção de receita líquida que a Arguto deve faturar nos próximos 90 dias considerando comportamento atual da carteira e sazonalidade histórica.',
    calculation:
      'Σ ( cliente_i × P(recompra_i, 90d) × ticket_esperado_i )\nModelo: time-series por cliente (Prophet) + LightGBM regressor pra ticket, ajustado por sazonalidade mensal.',
    dataSources: [
      'ERP fiscal — 36 meses de histórico de pedidos',
      'ERP — calendário comercial (feriados, campanhas)',
      'Cluster de similares (mesmo canal/porte/região)',
    ],
    breakdown: [
      { label: 'Carteira ativa (recorrência estável)', value: 'R$ 13,6M (42%)' },
      { label: 'Recompra prevista próximos 90d',       value: 'R$ 10,0M (31%)' },
      { label: 'Upsell + mix expansion',               value: 'R$ 5,8M (18%)' },
      { label: 'Novos clientes (ICP score ≥ 80)',      value: 'R$ 3,0M (9%)' },
      { label: 'Total projetado',                      value: 'R$ 32,4M', emphasis: true },
      { label: 'Intervalo de confiança',               value: '± R$ 2,6M (±8%)' },
    ],
    interpretation:
      'O IC de ±8% reflete a variância empírica dos resíduos do modelo nos últimos 12 trimestres. Cenários de stress (perda de 10 clientes top): a projeção cai pra R$ 28,1M. Cenário otimista (adoção plena BAI): R$ 35,7M.',
    action:
      'Use essa previsão como baseline pra Forecast da diretoria comercial. O simulador da aba ROI permite ajustar adoção e cobertura pra ver o impacto.',
    refresh: 'Recalculado diariamente · 03h da madrugada · histórico salvo p/ comparação',
  },
  health_score: {
    title: 'Health Score da carteira',
    subtitle: '1.247 clientes ativos · 4 bandas',
    definition:
      'Classificação da saúde de cada cliente em 4 bandas baseada em recência, frequência, ticket e mix vs cluster de similares.',
    calculation:
      'Score = 0.35·R + 0.25·F + 0.20·M + 0.20·MixVsCluster\nBandas:\n  Saudável  → score ≥ 0.70\n  Atenção   → 0.50 ≤ score < 0.70\n  Risco     → 0.30 ≤ score < 0.50\n  Crítico   → score < 0.30',
    dataSources: [
      'ERP fiscal — pedidos últimos 12 meses',
      'Tabela customer_rfm_scores (calculada nightly)',
      'Cluster de similares por canal/porte/região',
    ],
    breakdown: [
      { label: 'Saudável (recompra estável)', value: '511 clientes (41%)',  emphasis: true },
      { label: 'Atenção (sinal leve)',         value: '349 clientes (28%)' },
      { label: 'Risco (queda perceptível)',    value: '237 clientes (19%)' },
      { label: 'Crítico (perda iminente)',     value: '150 clientes (12%)', emphasis: true },
      { label: 'Receita 12m atrelada Risco+Crítico', value: 'R$ 11,4M' },
      { label: '% de receita em risco',        value: '21% do total' },
    ],
    interpretation:
      '1 a cada 3 clientes (387 ao todo) está em zona vermelha ou amarela. Concentração de receita: os 12% críticos representam R$ 4,8M anuais de exposição. Sem ação, esses caem do funil em 60–90 dias.',
    action:
      'A aba Predição de Churn lista nominalmente os 89 clientes em risco alto com razões detectadas (recência, mix, ticket). Cada um tem ação recomendada e janela ideal de contato.',
    refresh: 'Recalculado nightly · job calculate-rfm + predict-churn',
  },
  receita_incremental: {
    title: 'Receita incremental projetada (12 meses)',
    subtitle: 'R$ +28-38M · Pinn BAI vs status quo',
    definition:
      'Lift de receita acumulado em 12 meses comparado a manter a operação como hoje, sem o BAI rodando.',
    calculation:
      'ΔReceita = Σ ( visitas_otimizadas × Δconversão × ticket ) + (Δticket × pedidos_mantidos) + (Δmix × cesta) + economia_visitas\nFaixa min-max: cenário conservador (adoção 60%) → otimista (adoção 95%).',
    dataSources: [
      'Baseline 12m: ERP fiscal da Arguto',
      'Benchmark de 7 operações B2B distribuição similares',
      'Premissas validáveis durante MVP 90d',
    ],
    breakdown: [
      { label: 'Lift por conversão (+52%)',  value: '+R$ 14-19M' },
      { label: 'Lift por ticket (+23%)',     value: '+R$ 7-9M' },
      { label: 'Lift por mix expansion',     value: '+R$ 5-7M' },
      { label: 'Economia rota (-32% custo)', value: '+R$ 2-3M' },
      { label: 'Total incremental',          value: 'R$ +28-38M', emphasis: true },
      { label: 'ROI sobre investimento Pinn',value: '18-24×', emphasis: true },
      { label: 'Payback médio',              value: '4 meses' },
    ],
    interpretation:
      'A faixa min-max NÃO é projeção otimista — é a banda empírica de operações similares no primeiro ano. Cenário conservador (adoção 60%) já paga o investimento Pinn em 4 meses. Os deltas viram metas contratuais durante o MVP.',
    action:
      'Use o simulador da aba ROI pra ajustar premissas (adoção, cobertura, período) e visualizar a faixa em tempo real com cliente. Define-se os pontos de aferição contratuais a partir daí.',
    refresh: 'Estático no card · simulador interativo na aba ROI',
  },
};

export const ALERT_EXPLANATIONS: Record<string, MetricExplanation> = {
  recompra_iminente: {
    title: 'Sinal de recompra iminente',
    subtitle: '247 clientes / R$ 4,2M expostos',
    definition:
      'Clientes cujo ciclo de recompra histórico indica probabilidade ≥ 80% de pedido nos próximos 14 dias, mas que NÃO receberam contato (visita ou ligação) nos últimos 7 dias.',
    calculation:
      'Detecção: dias_sem_pedido ≥ (ciclo_padrão_cliente × 0.85)\n  AND ciclo_padrão.cv < 0.20 (cliente previsível)\n  AND contatos_7d = 0',
    dataSources: [
      'ERP fiscal — datas exatas de pedidos por cliente',
      'CRM — log de visitas e ligações',
      'Pipeline Signal Detection do BAI',
    ],
    breakdown: [
      { label: 'Clientes sinalizados',          value: '247',   emphasis: true },
      { label: 'Ticket médio do grupo',          value: 'R$ 17.000' },
      { label: 'Receita exposta (14d)',         value: 'R$ 4,2M', emphasis: true },
      { label: 'Probabilidade média conversão', value: '82%' },
      { label: 'Risco de o cliente comprar do concorrente', value: 'Alto · janela 7-14d' },
    ],
    interpretation:
      'Esses 247 clientes vão comprar. A questão é só "de quem". Se ninguém da Arguto contatar nas próximas 72h, parte vai pro concorrente — o cliente busca conveniência de quem aparecer primeiro com a oferta certa.',
    action:
      'Rota da aba Operação já tem esses clientes ranqueados. Top-12 vão pro mapa otimizado por tempo de deslocamento. Pré-pedido sugerido com base na cesta-padrão de cada cliente.',
    refresh: 'Recalculado a cada 4h · pipeline incremental',
  },
  risco_churn: {
    title: 'Risco de churn',
    subtitle: '89 clientes / R$ 1,8M em risco',
    definition:
      'Clientes com tendência clara de queda de engajamento nos últimos 90 dias — combinação de recência alta, frequência caindo e/ou redução de ticket vs baseline.',
    calculation:
      'Modelo: Gradient Boosting (LightGBM) treinado em 22 features comportamentais.\nLabel "alto": probabilidade churn 12m ≥ 0.70\nFeatures principais: recência, Δfreq_90d, Δticket_90d, mix_concentration, cluster_lag',
    dataSources: [
      'Tabela customer_churn_scores (calculada nightly)',
      'ERP fiscal — 12m de histórico',
      'Razões detectadas em jsonb por cliente',
    ],
    breakdown: [
      { label: 'Clientes em risco alto',     value: '89',     emphasis: true },
      { label: 'Receita atrelada (12m)',     value: 'R$ 1,8M', emphasis: true },
      { label: 'Top razão dominante',         value: 'Recência > 2× ciclo (43%)' },
      { label: 'Segunda razão',               value: 'Frequência caindo > 25% (29%)' },
      { label: 'Terceira razão',              value: 'Ticket caindo > 20% (18%)' },
      { label: 'Janela ideal de retenção',    value: 'Próximas 2 semanas' },
    ],
    interpretation:
      'A modelagem distingue cliente naturalmente cíclico (ex.: empresa sazonal) de cliente perdendo confiança. Os 89 sinalizados são os "perdendo confiança" — janela de reação é curta. Cliente em churn dificilmente volta após 90 dias sem contato.',
    action:
      'Aba Predição de Churn lista cada um com razões específicas. Recomendação por cliente: visita de retenção urgente, condição comercial pontual, ou apresentação de portfolio gap.',
    refresh: 'Nightly · pipeline predict-churn no Supabase',
  },
  mix_subexplorado: {
    title: 'Mix subexplorado',
    subtitle: '612 clientes / +R$ 3,1M potencial',
    definition:
      'Clientes que compram menos de 40% do mix de SKUs que clientes similares (mesmo canal, porte e região) compram regularmente.',
    calculation:
      'mix_gap = mediana_skus_cluster − skus_ativos_cliente\nFiltro: skus_ativos_cliente < (0.40 × mediana_cluster)\nPotencial = mix_gap × ticket_médio_categoria × frequência_cluster',
    dataSources: [
      'ERP fiscal — histórico SKU-level',
      'Catálogo Arguto (categorias e bundles)',
      'Cluster comportamental de similares',
    ],
    breakdown: [
      { label: 'Clientes com mix gap',         value: '612',   emphasis: true },
      { label: 'Receita adicional possível',    value: 'R$ 3,1M', emphasis: true },
      { label: 'Categoria gap #1',              value: 'HPC (higiene pessoal)' },
      { label: 'Categoria gap #2',              value: 'Bebidas premium' },
      { label: 'Categoria gap #3',              value: 'Padaria fina / panificação' },
      { label: 'Lift esperado de mix expansion',value: '+74% SKUs ativos/cliente' },
    ],
    interpretation:
      'Os mesmos clientes que já compram outras categorias deixam de comprar HPC/bebidas premium/panificação não por falta de demanda — geralmente é gap de apresentação do catálogo durante a visita ou ausência da categoria no e-catálogo enviado por WhatsApp.',
    action:
      'BAI gera pré-pedido sugerido com os SKUs gap pra cada cliente. Catálogo personalizado por WhatsApp pra clientes onde visita não compensa.',
    refresh: 'Recalculado semanalmente · job mix-gap-detector',
  },
  visitas_baixo_retorno: {
    title: 'Visitas com baixo retorno',
    subtitle: '318 visitas / R$ 67k desperdiçado',
    definition:
      'Visitas presenciais já planejadas pra esta semana com probabilidade de conversão (modelo BAI) abaixo de 20% — alto custo, baixo retorno esperado.',
    calculation:
      'Modelo Conversão Predictor (LightGBM) → P(conversão | visita) < 0.20\nCusto desperdiçado = visitas × (custo_direto + custo_oportunidade)\nCusto direto: deslocamento + tempo vendedor + commission allocation',
    dataSources: [
      'Calendário do vendedor (visitas planejadas)',
      'Modelo Conversão Predictor (real-time scoring)',
      'Tabela de custo unitário de visita por região',
    ],
    breakdown: [
      { label: 'Visitas com prob < 20%',  value: '318', emphasis: true },
      { label: 'Custo médio por visita',  value: 'R$ 187' },
      { label: 'Custo direto semana',     value: 'R$ 59,5k' },
      { label: 'Custo oportunidade',      value: 'R$ 7,5k' },
      { label: 'Total desperdiçado',      value: 'R$ 67k/semana', emphasis: true },
      { label: 'Realocação possível',     value: '~70% pra clientes prob ≥ 50%' },
    ],
    interpretation:
      'Não é problema de capacidade — é problema de roteamento. As 318 visitas baixo-retorno equivalem a 12.500 visitas/mês × 25% taxa de desperdício. Substituir essas 70% por visitas de alto retorno mantém o quadro de vendedores intacto e adiciona ~R$ 230k/mês em conversão esperada.',
    action:
      'Aba Operação reordena automaticamente: substitui visitas <20% prob por clientes top do ranking. Pras 20-50% prob, troca canal pra WhatsApp/ligação (custo 1/10).',
    refresh: 'Real-time durante o planejamento semanal · re-score sempre que rota muda',
  },
};

/* Placeholders (drilldowns "ver detalhes" não-visualizados) */
export const DRILLDOWN_PLACEHOLDERS = [
  { key: 'tempo_recompra',     title: 'Tempo desde última compra vs padrão histórico', detail: 'Compara janela do cliente com mediana dos similares.' },
  { key: 'sazonalidade',       title: 'Sazonalidade detectada por cliente',            detail: 'Curva mensal com picos e vales individuais.' },
  { key: 'score_canal',        title: 'Score de propensão por canal',                   detail: 'Visita vs ligação vs WhatsApp por cliente.' },
  { key: 'heatmap_geo',        title: 'Heatmap geográfico de oportunidade',             detail: 'Cidades e bairros sub-atendidos.' },
  { key: 'cohort_comparativo', title: 'Comparativo cohort (mesmo trimestre)',           detail: 'Curvas de retenção e LTV por safra.' },
];
