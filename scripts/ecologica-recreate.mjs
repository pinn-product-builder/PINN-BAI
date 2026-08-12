/**
 * RECREATE — substitui os widgets MONTADOS À MÃO da Ecológica pelos widgets do
 * PIPELINE GENÉRICO (zero código _ecologica). Prova viva de que o genérico
 * reproduz o dashboard hardcoded.
 *
 * Lê dados REAIS da base externa (zlmkkrwngtknyqemgccy) READ-ONLY p/ computar os
 * widgets, e ESCREVE só na base do BAI (backend/.env). Credenciais nunca hardcoded.
 *
 * SEGURANÇA: DRY-RUN por padrão (mostra exatamente o que escreveria). Para efetivar:
 *   node scripts/ecologica-recreate.mjs --commit
 *
 * Reversível 100%:
 *   node scripts/ecologica-restore.mjs backups/ecologica/2026-06-01T18-40-53-335Z --commit
 */
import { readFileSync } from 'node:fs';
import {
  heuristicSuggestions,
  heuristicMappings,
  generateRecommendations,
  adaptMappings,
} from './_ecologica-pipeline.mjs';

const ORG_ID = 'f511e4f6-e94e-4581-a088-44377e67d5ba';
const COMMIT = process.argv.includes('--commit');
const TARGET = 'kommo_leads_ecologica';

/* ── creds externas (introspecção real, read-only) do backup ────────────── */
const integ = JSON.parse(
  readFileSync(new URL('../backups/ecologica/2026-06-01T18-40-53-335Z/integrations.json', import.meta.url).pathname, 'utf8'),
);
const ext = integ.find((i) => i.type === 'supabase');
const EXT_URL = (ext?.config?.projectUrl || '').replace(/\/$/, '');
const EXT_KEY = ext?.config?.anonKey;
const EH = { apikey: EXT_KEY, Authorization: `Bearer ${EXT_KEY}` };

/* ── creds BAI (escrita) de backend/.env ────────────────────────────────── */
function loadEnv(p) {
  const e = {};
  for (const l of readFileSync(p, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) e[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return e;
}
const env = loadEnv(new URL('../backend/.env', import.meta.url).pathname);
const BAI_URL = (env.SUPABASE_URL || '').replace(/\/$/, '');
const BAI_KEY = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const BH = { apikey: BAI_KEY, Authorization: `Bearer ${BAI_KEY}`, 'Content-Type': 'application/json' };

if (!EXT_URL || !EXT_KEY || !BAI_URL || !BAI_KEY) {
  console.error('faltam credenciais (externa no backup / BAI em backend/.env)');
  process.exit(1);
}

/* ── introspecção externa (read-only) ───────────────────────────────────── */
async function openapi() {
  const r = await fetch(`${EXT_URL}/rest/v1/`, { headers: EH });
  if (!r.ok) throw new Error(`OpenAPI ${r.status}`);
  return r.json();
}
async function rowCount(t) {
  const r = await fetch(`${EXT_URL}/rest/v1/${encodeURIComponent(t)}?select=*&limit=1`, { headers: { ...EH, Prefer: 'count=exact' } });
  const m = (r.headers.get('content-range') || '').match(/\/(\d+|\*)\s*$/);
  return m && m[1] !== '*' ? parseInt(m[1], 10) : 0;
}
async function sampleRows(t, n = 20) {
  const r = await fetch(`${EXT_URL}/rest/v1/${encodeURIComponent(t)}?select=*&limit=${n}`, { headers: EH });
  return r.ok ? r.json().catch(() => []) : [];
}

const line = (c = '─') => c.repeat(78);
console.log(`\nRECREATE Ecológica ${COMMIT ? '(--commit: EFETIVANDO)' : '(DRY-RUN — nada será escrito)'}`);
console.log(`dados (read-only): ${EXT_URL}`);
console.log(`escrita          : ${BAI_URL}`);

/* 1) computa widgets pelo pipeline genérico sobre dados REAIS */
const spec = await openapi();
const defs = spec.definitions || {};
const tables = [];
for (const name of Object.keys(defs)) {
  const props = defs[name].properties || {};
  const columns = Object.entries(props).map(([cn, p]) => ({ name: cn, type: String(p.format || p.type || 'text') }));
  let rc = 0;
  try { rc = await rowCount(name); } catch { /* ignore */ }
  tables.push({ name, rowCount: rc, columns });
}
const picked = heuristicSuggestions(tables)[0]?.tableName;
if (picked !== TARGET) {
  console.error(`\n❌ pipeline escolheu "${picked}" (esperava ${TARGET}) — abortando por segurança`);
  process.exit(1);
}
const def = tables.find((t) => t.name === TARGET);
const rows = await sampleRows(TARGET, 20);
const withSamples = {
  ...def,
  columns: def.columns.map((c) => ({ ...c, sampleValues: rows.map((r) => r?.[c.name]).filter((v) => v !== undefined) })),
};
const mapRes = heuristicMappings([withSamples]);
const dataMappings = adaptMappings(mapRes.suggestions.filter((s) => s.sourceTable === TARGET));
const widgets = generateRecommendations(dataMappings);

/* 2) descobre o dashboard alvo (live) na base do BAI */
const dRes = await fetch(`${BAI_URL}/rest/v1/dashboards?select=id,name&org_id=eq.${ORG_ID}`, { headers: BH });
const dashboards = await dRes.json();
const DASH_ID = dashboards?.[0]?.id;
if (!DASH_ID) { console.error('\n❌ não achei dashboard da org no BAI'); process.exit(1); }
const curRes = await fetch(`${BAI_URL}/rest/v1/dashboard_widgets?select=id&dashboard_id=eq.${DASH_ID}`, { headers: BH });
const current = await curRes.json();

/* 3) mapeia recomendações → linhas dashboard_widgets */
const SIZE = { metric_card: 'small', area_chart: 'large', line_chart: 'large', table: 'large', funnel: 'medium', bar_chart: 'medium', pie_chart: 'medium', insight_card: 'medium' };
const widgetRows = widgets.map((w, i) => ({
  dashboard_id: DASH_ID,
  type: w.type,
  title: w.title,
  description: w.description || '',
  config: { format: 'number', ...(w.config || {}) },
  position: i,
  size: SIZE[w.type] || 'medium',
  is_visible: true,
}));

console.log(`\ndashboard alvo: ${DASH_ID} (${dashboards[0].name})`);
console.log(`widgets atuais (serão substituídos): ${current.length}`);
console.log(`widgets novos (do genérico):         ${widgetRows.length}\n`);
console.log(line());
for (const w of widgetRows) {
  const cfg = w.config;
  const detail = cfg.metric ? `${cfg.metric}/${cfg.aggregation || '?'}${cfg.groupBy ? ' by ' + cfg.groupBy : ''}` : cfg.groupBy ? `by ${cfg.groupBy}` : '';
  console.log(`  [${w.position}] ${w.size.padEnd(6)} ${w.type.padEnd(12)} ${w.title.padEnd(22)} ${detail ? '(' + detail + ')' : ''}`);
  console.log(`      src=${cfg.sourceTable || '—'}  ${JSON.stringify(cfg)}`);
}
console.log(line());

if (!COMMIT) {
  console.log('\n(DRY-RUN) revise os widgets acima. Para efetivar:  node scripts/ecologica-recreate.mjs --commit');
  console.log('Reverter depois:  node scripts/ecologica-restore.mjs backups/ecologica/2026-06-01T18-40-53-335Z --commit\n');
  process.exit(0);
}

/* 4) EFETIVA: apaga widgets atuais e insere os novos (reversível via restore) */
console.log('\nefetivando…');
const del = await fetch(`${BAI_URL}/rest/v1/dashboard_widgets?dashboard_id=eq.${DASH_ID}`, { method: 'DELETE', headers: { ...BH, Prefer: 'return=minimal' } });
if (!del.ok && del.status !== 404) { console.error(`DELETE falhou: ${del.status} ${await del.text()}`); process.exit(1); }
const ins = await fetch(`${BAI_URL}/rest/v1/dashboard_widgets`, { method: 'POST', headers: { ...BH, Prefer: 'return=minimal' }, body: JSON.stringify(widgetRows) });
if (!ins.ok) { console.error(`INSERT falhou: ${ins.status} ${await ins.text()}`); console.error('⚠️  rode o restore p/ reverter!'); process.exit(1); }
console.log(`✅ ${widgetRows.length} widgets do pipeline genérico gravados no dashboard ${DASH_ID}`);
console.log('   reverter:  node scripts/ecologica-restore.mjs backups/ecologica/2026-06-01T18-40-53-335Z --commit\n');
