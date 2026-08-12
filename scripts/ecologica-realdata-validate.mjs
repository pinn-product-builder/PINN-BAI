/**
 * THROWAWAY VALIDATION — pipeline genérico vs DADOS REAIS da Ecológica.
 *
 * Fecha a lacuna entre a FIXTURE offline (scripts/validate-ecologica-pipeline.mjs)
 * e a realidade: introspecta o Supabase EXTERNO onde vive kommo_leads_ecologica,
 * roda a MESMA lógica genérica (importada de _ecologica-pipeline.mjs) contra os
 * tipos + amostras REAIS, e compara com o dashboard montado à mão.
 *
 * READ-ONLY no servidor externo. NÃO escreve nada, em lugar nenhum.
 * Credenciais lidas em runtime do backup integrations.json — NUNCA hardcoded, nunca impressas.
 * NUNCA imprime PII: colunas de texto/jsonb/uuid mostram só tipo + cardinalidade,
 * jamais os valores crus (nomes de leads, resumo, vendedor, destino).
 *
 *   node scripts/ecologica-realdata-validate.mjs
 */
import { readFileSync } from 'node:fs';
import {
  heuristicSuggestions,
  heuristicMappings,
  generateRecommendations,
  adaptMappings,
} from './_ecologica-pipeline.mjs';

/* ── 0. credenciais do backup (runtime, read-only) ──────────────────────── */
const BACKUP = new URL(
  '../backups/ecologica/2026-06-01T18-40-53-335Z/integrations.json',
  import.meta.url,
).pathname;

let URL_, KEY;
try {
  const integ = JSON.parse(readFileSync(BACKUP, 'utf8'));
  const supa = integ.find((i) => i.type === 'supabase');
  URL_ = (supa?.config?.projectUrl || '').replace(/\/$/, '');
  KEY = supa?.config?.anonKey; // (rotulado anonKey; é service_role no backup)
} catch (e) {
  console.error('Não consegui ler o backup integrations.json:', e.message);
  process.exit(1);
}
if (!URL_ || !KEY) {
  console.error('faltam projectUrl/anonKey no backup integrations.json');
  process.exit(1);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

/* ── 1. helpers de introspecção (PostgREST) ─────────────────────────────── */
async function openapi() {
  const r = await fetch(`${URL_}/rest/v1/`, { headers: H });
  if (!r.ok) throw new Error(`OpenAPI root → ${r.status} ${await r.text().catch(() => '')}`);
  return r.json();
}
async function rowCount(table) {
  const r = await fetch(`${URL_}/rest/v1/${encodeURIComponent(table)}?select=*&limit=1`, {
    headers: { ...H, Prefer: 'count=exact' },
  });
  const cr = r.headers.get('content-range') || '';
  const m = cr.match(/\/(\d+|\*)\s*$/);
  return m && m[1] !== '*' ? parseInt(m[1], 10) : 0;
}
async function sampleRows(table, n = 20) {
  const r = await fetch(`${URL_}/rest/v1/${encodeURIComponent(table)}?select=*&limit=${n}`, { headers: H });
  if (!r.ok) return [];
  return r.json().catch(() => []);
}

/* ── 2. redação anti-PII ────────────────────────────────────────────────── */
const TEXTY = (t) => /text|char|json|uuid|bytea/i.test(t);
function colSummary(col, rows) {
  const raw = rows.map((r) => r?.[col.name]).filter((v) => v !== null && v !== undefined);
  const nullPct = rows.length ? Math.round((1 - raw.length / rows.length) * 100) : 0;
  const distinct = new Set(raw.map((v) => (typeof v === 'object' ? JSON.stringify(v) : v))).size;
  if (TEXTY(col.type)) {
    // NUNCA mostra valores: só forma + cardinalidade
    return `${col.type.padEnd(26)} ‹${distinct} distintos / ${raw.length} não-nulos, ${nullPct}% null›`;
  }
  // bool / numérico / data — não-PII, amostra segura
  const show = [...new Set(raw)].slice(0, 4).map((v) => String(v).slice(0, 22));
  return `${col.type.padEnd(26)} [${show.join(', ')}${distinct > 4 ? ', …' : ''}] ${nullPct}% null`;
}

const line = (c = '─') => c.repeat(78);

/* ── 3. RUN ─────────────────────────────────────────────────────────────── */
console.log('\n' + line('═'));
console.log(' VALIDAÇÃO REAL-DATA — pipeline genérico vs DADOS REAIS da Ecológica');
console.log(` base externa: ${URL_}  (read-only, sem escrita)`);
console.log(line('═'));

let spec;
try {
  spec = await openapi();
} catch (e) {
  console.error('\n❌ não consegui introspectar a base externa:', e.message);
  console.error('   (a chave pode ter rotacionado ou a base estar offline)');
  console.error('   A prova OFFLINE permanece válida: node scripts/validate-ecologica-pipeline.mjs');
  process.exit(1);
}

const defs = spec.definitions || {};
const tableNames = Object.keys(defs);
console.log(`\n[0] tabelas visíveis na base externa: ${tableNames.length}`);

/* monta TableInfo[] (name + colunas/tipos + rowCount) p/ suggest-tables */
const tables = [];
for (const name of tableNames) {
  const props = defs[name].properties || {};
  const columns = Object.entries(props).map(([cn, p]) => ({
    name: cn,
    type: String(p.format || p.type || 'text'),
  }));
  let rc = 0;
  try {
    rc = await rowCount(name);
  } catch {
    /* ignora tabelas que recusam count */
  }
  tables.push({ name, rowCount: rc, columns });
}

console.log('\n[1] suggest-tables → ranking REAL (top 8):');
const sugs = heuristicSuggestions(tables);
for (const s of sugs.slice(0, 8)) {
  const t = tables.find((x) => x.name === s.tableName);
  console.log(`    ${String(s.score).padStart(3)}  ${s.tableName.padEnd(28)} ${String(t?.rowCount ?? '?').padStart(7)} linhas  (${s.reason})`);
}
const picked = sugs[0]?.tableName;
const target = 'kommo_leads_ecologica';
console.log(`    → escolhida: ${picked}  ${picked === target ? '✅ correta' : `⚠️  esperava ${target}`}`);

/* tabela-alvo p/ schema real (mesmo que o ranking escolha outra, mostramos a alvo) */
const pickedDef = tables.find((t) => t.name === picked);
const targetDef = tables.find((t) => t.name === target);

if (!targetDef) {
  console.log(`\n❌ ${target} NÃO existe na base externa. Schema disponível difere do esperado.`);
  process.exit(1);
}

/* amostras REAIS só da(s) tabela(s) relevante(s) — minimiza exposição */
const sampleForName = async (def) => {
  const rows = await sampleRows(def.name, 20);
  return {
    rows,
    table: {
      ...def,
      columns: def.columns.map((c) => ({
        ...c,
        sampleValues: rows.map((r) => r?.[c.name]).filter((v) => v !== undefined),
      })),
    },
  };
};

const { rows: targetRows } = await sampleForName(targetDef);
console.log(`\n[2] SCHEMA REAL de ${target} (${targetDef.columns.length} colunas, ${targetDef.rowCount} linhas) — PII redigida:`);
for (const c of targetDef.columns) console.log(`    ${c.name.padEnd(24)} ${colSummary(c, targetRows)}`);

/* fixture vs realidade — o ponto crítico: meus tipos inferidos batem? */
const FIXTURE_TYPES = {
  nome_lead: 'text',
  reuniao: 'boolean',
  reuniao_agendada: 'boolean',
  reuniao_realizada: 'boolean',
  destino_de_interesse: 'text',
  data_criacao: 'timestamp',
  quantidade_de_pessoas: 'integer',
  origem_lead: 'text',
  horario_reuniao: 'text',
  link_reuniao: 'text',
  vendedor: 'text',
  resumo: 'text',
};
console.log('\n[3] FIXTURE (inferida) × REALIDADE — colunas-chave:');
for (const [col, assumed] of Object.entries(FIXTURE_TYPES)) {
  const real = targetDef.columns.find((c) => c.name === col);
  if (!real) {
    console.log(`    ${col.padEnd(24)} inferido ${assumed.padEnd(10)} → REAL: ✗ NÃO EXISTE`);
    continue;
  }
  const norm = (t) => t.toLowerCase();
  const famMatch =
    (assumed === 'boolean' && /bool/.test(norm(real.type))) ||
    (assumed === 'text' && /text|char|uuid|json/.test(norm(real.type))) ||
    (assumed === 'timestamp' && /timestamp|date/.test(norm(real.type))) ||
    (assumed === 'integer' && /int|numeric|decimal|float|double/.test(norm(real.type)));
  console.log(`    ${col.padEnd(24)} inferido ${assumed.padEnd(10)} → REAL ${real.type.padEnd(26)} ${famMatch ? '✅' : '⚠️  DIVERGE'}`);
}

/* roda mapeamento + widgets na tabela-alvo com AMOSTRAS REAIS */
const { table: targetWithSamples } = await sampleForName(targetDef);
console.log('\n[4] suggest-mappings → mapeamentos REAIS (tabela-alvo):');
const mapRes = heuristicMappings([targetWithSamples]);
const gotMain = mapRes.suggestions.filter((s) => s.sourceTable === target);
if (!gotMain.length) console.log('    (nenhum mapeamento)');
for (const s of gotMain)
  console.log(`    ${s.sourceField.padEnd(24)} → ${String(s.targetMetric).padEnd(18)} [${s.transformation}${s.aggregation ? '/' + s.aggregation : ''}, conf ${s.confidence}]`);
const mappedCols = new Set(gotMain.map((s) => s.sourceField));
console.log('    colunas SEM mapeamento:');
console.log('      ' + targetDef.columns.map((c) => c.name).filter((c) => !mappedCols.has(c)).join(', '));

console.log('\n[5] recommend-widgets → widgets gerados (após round-trip data_mappings):');
const dataMappings = adaptMappings(mapRes.suggestions.filter((s) => s.sourceTable === target));
const widgets = generateRecommendations(dataMappings);
for (const w of widgets)
  console.log(`    ${String(w.score).padStart(3)}  ${w.type.padEnd(12)} ${w.title}`);

/* comparação com o dashboard real montado à mão */
const LIVE_DRIVER_COLS = ['nome_lead', 'reuniao', 'reuniao_agendada', 'reuniao_realizada', 'destino_de_interesse', 'data_criacao'];
const LIVE_DETAIL_COLS = ['horario_reuniao', 'link_reuniao', 'vendedor', 'quantidade_de_pessoas', 'resumo'];
const hit = (col, metric) => gotMain.some((s) => s.sourceField === col && (!metric || s.targetMetric === metric));

console.log('\n[6] SINAIS-CHAVE do dashboard real — o genérico capturou nos DADOS REAIS?');
const signals = [
  ['nome_lead → total_leads (count)', hit('nome_lead', 'total_leads')],
  ['reuniao → "Com Reunião"', hit('reuniao')],
  ['reuniao_agendada → meetings_scheduled', hit('reuniao_agendada', 'meetings_scheduled')],
  ['reuniao_realizada → meetings_done', hit('reuniao_realizada', 'meetings_done')],
  ['destino_de_interesse → categórica/funil', hit('destino_de_interesse')],
  ['data_criacao → created_date (groupBy)', hit('data_criacao', 'created_date')],
];
for (const [label, ok] of signals) console.log(`    ${label.padEnd(44, '.')} ${ok ? '✅' : '❌'}`);
const bonus = hit('origem_lead');
console.log(`    (bônus) origem_lead → lead_source${'.'.repeat(11)} ${bonus ? '✅ (não está no dashboard à mão)' : '— ausente/não mapeado'}`);
const passed = signals.filter(([, ok]) => ok).length;

const detailUnmapped = LIVE_DETAIL_COLS.filter((c) => targetDef.columns.some((x) => x.name === c) && !mappedCols.has(c));
console.log('\n[7] colunas de DETALHE (esperado: aparecem nas TABELAS, sem virar métrica):');
console.log('    corretamente NÃO mapeadas: ' + (detailUnmapped.join(', ') || '(nenhuma das esperadas existe)'));

console.log('\n' + line());
console.log(' VEREDITO (dados reais, caminho heurístico):');
console.log(`   tabela escolhida:            ${picked === target ? '✅ ' + target : '⚠️  ' + picked}`);
console.log(`   colunas de negócio mapeadas: ${gotMain.length}`);
console.log(`   sinais-chave capturados:     ${passed}/${signals.length}`);
console.log(`   widgets gerados:             ${widgets.length}`);
console.log(`   ${passed === signals.length ? '✅ PASSOU — pipeline genérico reproduz o dashboard à mão SOBRE OS DADOS REAIS' : '⚠️  PARCIAL — ver divergências de schema acima ([3]) e sinais faltantes ([6])'}`);
console.log(line() + '\n');
