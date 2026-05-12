/**
 * Popula customer_rfm_scores + customer_churn_scores pra org Arguto.
 *
 * Coerência com fixtures da Arguto:
 *  - sinal=churn   → churn_prob 0.70-0.92, band=alto, recency alta, freq baixa
 *  - sinal=mix     → churn_prob 0.30-0.45, band=medio, monetary baixo p/ ticket alto possível
 *  - sinal=upsell  → churn_prob 0.20-0.35, band=baixo→medio
 *  - sinal=recompra→ churn_prob 0.05-0.20, band=baixo
 *
 * Idempotente via upsert.
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-arguto-rfm-churn.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.SUPABASE_URL || 'https://bkgwzxrutzmmxmxzfhmw.supabase.co';
const SERVICE_ROLE  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ARGUTO_ORG_ID = 'b72718e7-6a54-4ff8-9bbf-24d1573ddb43';

if (!SERVICE_ROLE) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não definido.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* ─── 10 clientes do fixture Arguto + 20 inventados ─── */
const CLIENTS = [
  // ── Os 10 do fixture (devem casar com src/data/arguto-demo.ts) ──
  { key: 'cli-001', name: 'Mercado Central LTDA',  sinal: 'recompra' },
  { key: 'cli-002', name: 'Distrib. Bom Preço',    sinal: 'mix' },
  { key: 'cli-003', name: 'Atacarejo Triângulo',   sinal: 'upsell' },
  { key: 'cli-004', name: 'Mercado São José',      sinal: 'churn' },
  { key: 'cli-005', name: 'Padaria Vovó Maria',    sinal: 'upsell' },
  { key: 'cli-006', name: 'Distrib. Cerrado',      sinal: 'recompra' },
  { key: 'cli-007', name: 'Supermercados Aliança', sinal: 'mix' },
  { key: 'cli-008', name: 'Rede Bom Dia',          sinal: 'recompra' },
  { key: 'cli-009', name: 'Mercearia Boa Vista',   sinal: 'churn' },
  { key: 'cli-010', name: 'Atacado Sertão',        sinal: 'upsell' },
  // ── Mais 20 pra dar densidade ao módulo ──
  { key: 'cli-011', name: 'Padaria Pão Quente',    sinal: 'churn' },
  { key: 'cli-012', name: 'Mercadão do Povo',      sinal: 'recompra' },
  { key: 'cli-013', name: 'Supermerc. Vista Sul',  sinal: 'mix' },
  { key: 'cli-014', name: 'Atacado União',         sinal: 'churn' },
  { key: 'cli-015', name: 'Mercearia Bom Jesus',   sinal: 'upsell' },
  { key: 'cli-016', name: 'Empório do Bairro',     sinal: 'recompra' },
  { key: 'cli-017', name: 'Padaria Sabor Caseiro', sinal: 'churn' },
  { key: 'cli-018', name: 'Mercado Real',          sinal: 'mix' },
  { key: 'cli-019', name: 'Distrib. Pampulha',     sinal: 'upsell' },
  { key: 'cli-020', name: 'Supermerc. Estrela',    sinal: 'recompra' },
  { key: 'cli-021', name: 'Mercadinho Família',    sinal: 'churn' },
  { key: 'cli-022', name: 'Atacarejo Cerrado',     sinal: 'upsell' },
  { key: 'cli-023', name: 'Padaria Doce Sabor',    sinal: 'mix' },
  { key: 'cli-024', name: 'Mercado Bom Gosto',     sinal: 'recompra' },
  { key: 'cli-025', name: 'Supermerc. Aurora',     sinal: 'churn' },
  { key: 'cli-026', name: 'Mercearia Esperança',   sinal: 'upsell' },
  { key: 'cli-027', name: 'Distrib. Vale do Rio',  sinal: 'recompra' },
  { key: 'cli-028', name: 'Atacado Diamante',      sinal: 'mix' },
  { key: 'cli-029', name: 'Padaria Trigo de Ouro', sinal: 'churn' },
  { key: 'cli-030', name: 'Mercado Cidade Nova',   sinal: 'recompra' },
];

/* ─── deterministic-ish jitter por chave ─── */
function seededRand(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (((h >>> 0) % 10000) / 10000);
}

function buildScores(c) {
  const r = seededRand(c.key);
  switch (c.sinal) {
    case 'churn':    return makeChurnHigh(c, r);
    case 'mix':      return makeMidMix(c, r);
    case 'upsell':   return makeUpsell(c, r);
    case 'recompra': return makeRecompra(c, r);
  }
}

function makeChurnHigh(c, r) {
  return {
    recency: Math.round(45 + r * 35),         // 45-80 dias
    frequency: 1 + Math.floor(r * 3),         // 1-3
    monetary: Math.round(2_500 + r * 4_000),  // 2.5k-6.5k
    rScore: 1 + Math.floor(r * 2),            // 1-2
    fScore: 1 + Math.floor(r * 2),            // 1-2
    mScore: 2 + Math.floor(r * 2),            // 2-3
    rfmSegment: r < 0.5 ? 'Hibernando' : 'Em Risco',
    churnProb: +(0.70 + r * 0.22).toFixed(3),
    band: 'alto',
    reasons: [
      'Recência fora do padrão histórico do cluster',
      `Frequência caiu ${Math.round(25 + r * 20)}% nos últimos 60 dias`,
      'Ticket médio recente abaixo da mediana do segmento',
      r > 0.5 ? 'Mix concentrado nos top-3 SKUs (alta vulnerabilidade)' : 'Sem pedidos em janelas-padrão de recompra',
    ],
  };
}

function makeMidMix(c, r) {
  return {
    recency: Math.round(18 + r * 14),
    frequency: 4 + Math.floor(r * 3),
    monetary: Math.round(8_000 + r * 9_000),
    rScore: 3 + Math.floor(r * 2),
    fScore: 2 + Math.floor(r * 2),
    mScore: 3 + Math.floor(r * 2),
    rfmSegment: 'Regulares',
    churnProb: +(0.30 + r * 0.15).toFixed(3),
    band: 'medio',
    reasons: [
      'Mix de SKUs 40-55% abaixo do padrão de clientes similares',
      'Frequência estável mas ticket vulnerável à concorrência',
      r > 0.5 ? 'Não comprou categorias-âncora (HPC/bebidas)' : 'Cesta pouco diversificada',
    ],
  };
}

function makeUpsell(c, r) {
  return {
    recency: Math.round(8 + r * 9),
    frequency: 6 + Math.floor(r * 4),
    monetary: Math.round(12_000 + r * 8_000),
    rScore: 4 + Math.floor(r * 1.4),
    fScore: 3 + Math.floor(r * 2),
    mScore: 3 + Math.floor(r * 2),
    rfmSegment: 'Promissores',
    churnProb: +(0.18 + r * 0.17).toFixed(3),
    band: r > 0.6 ? 'medio' : 'baixo',
    reasons: [
      `Ticket médio ${Math.round(15 + r * 15)}% abaixo do potencial do cluster`,
      'Frequência saudável — janela de upsell aberta',
      r > 0.5 ? 'Histórico de receptividade a bundle premium' : 'Penetração de catálogo em crescimento',
    ],
  };
}

function makeRecompra(c, r) {
  return {
    recency: Math.round(4 + r * 8),
    frequency: 8 + Math.floor(r * 5),
    monetary: Math.round(15_000 + r * 12_000),
    rScore: 5,
    fScore: 4 + Math.floor(r * 2),
    mScore: 4 + Math.floor(r * 2),
    rfmSegment: 'Champions',
    churnProb: +(0.05 + r * 0.13).toFixed(3),
    band: 'baixo',
    reasons: [
      'Padrão de recompra estável e previsível',
      'Engagement alto em todos os canais',
      r > 0.5 ? 'Cliente fiel — janela de cross-sell aberta' : 'Recência dentro do ciclo natural do cluster',
    ],
  };
}

async function main() {
  console.log('▸ Gerando scores RFM + Churn pra Arguto...\n');

  const rfmRows = [];
  const churnRows = [];

  for (const c of CLIENTS) {
    const s = buildScores(c);
    rfmRows.push({
      org_id: ARGUTO_ORG_ID,
      customer_key: c.key,
      customer_name: c.name,
      customer_email: `${c.key}@arguto.demo`,
      source_table: 'arguto_fixtures',
      recency_days: s.recency,
      frequency: s.frequency,
      monetary: s.monetary,
      r_score: s.rScore,
      f_score: s.fScore,
      m_score: s.mScore,
      rfm_score: `${s.rScore}${s.fScore}${s.mScore}`,
      rfm_segment: s.rfmSegment,
    });
    churnRows.push({
      org_id: ARGUTO_ORG_ID,
      customer_key: c.key,
      source_table: 'arguto_fixtures',
      churn_probability: s.churnProb,
      churn_risk_band: s.band,
      churn_reasons: s.reasons,
    });
  }

  // Upsert RFM
  const { error: rfmErr } = await supabase
    .from('customer_rfm_scores')
    .upsert(rfmRows, { onConflict: 'org_id,customer_key' });
  if (rfmErr) throw rfmErr;
  console.log(`  ✓ ${rfmRows.length} linhas em customer_rfm_scores`);

  // Upsert Churn
  const { error: churnErr } = await supabase
    .from('customer_churn_scores')
    .upsert(churnRows, { onConflict: 'org_id,customer_key' });
  if (churnErr) throw churnErr;
  console.log(`  ✓ ${churnRows.length} linhas em customer_churn_scores`);

  // Diagnóstico
  const high = churnRows.filter(r => r.churn_risk_band === 'alto').length;
  const med  = churnRows.filter(r => r.churn_risk_band === 'medio').length;
  const low  = churnRows.filter(r => r.churn_risk_band === 'baixo').length;
  console.log('\n  Distribuição:');
  console.log(`    alto:  ${high}  (R$ ${churnRows.filter(r => r.churn_risk_band === 'alto')
    .reduce((s, r) => s + (rfmRows.find(x => x.customer_key === r.customer_key)?.monetary || 0), 0)
    .toLocaleString('pt-BR')} expostos)`);
  console.log(`    médio: ${med}`);
  console.log(`    baixo: ${low}`);
  console.log('\n✅ Pronto. Refresh em /client/' + ARGUTO_ORG_ID + '/rfm-churn');
}

main().catch((e) => {
  console.error('\n❌ Falhou:', e.message || e);
  process.exit(1);
});
