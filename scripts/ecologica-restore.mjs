/**
 * RESTORE (rollback) do estado de dashboard da Ecológica a partir de um backup
 * feito por scripts/ecologica-backup.mjs. Reverte EXATAMENTE: re-insere os
 * dashboard_widgets e data_mappings salvos, preservando ids/timestamps originais.
 *
 * Lê credenciais do BAI de backend/.env (não hardcoda). Opera na base do BAI
 * (onde vivem dashboards/widgets), NÃO na base externa de dados.
 *
 * SEGURANÇA: por padrão roda em DRY-RUN (só imprime o plano). Para efetivar:
 *   node scripts/ecologica-restore.mjs backups/ecologica/<timestamp> --commit
 *
 * O --commit é destrutivo: APAGA os widgets/mappings atuais do dashboard/org e
 * recoloca os do backup. É a operação de rollback — use só para reverter.
 */
import { readFileSync, existsSync } from 'node:fs';

const ORG_ID = 'f511e4f6-e94e-4581-a088-44377e67d5ba'; // Ecológica Turismo

const dirArg = process.argv[2];
const COMMIT = process.argv.includes('--commit');
if (!dirArg) {
  console.error('uso: node scripts/ecologica-restore.mjs <backup-dir> [--commit]');
  process.exit(1);
}
const dir = dirArg.replace(/\/?$/, '/');
if (!existsSync(`${dir}manifest.json`)) {
  console.error(`backup inválido: não achei ${dir}manifest.json`);
  process.exit(1);
}

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return env;
}
const env = loadEnv(new URL('../backend/.env', import.meta.url).pathname);
const BASE = (env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) {
  console.error('faltam SUPABASE_URL / SUPABASE_SERVICE_KEY em backend/.env');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(`${dir}manifest.json`, 'utf8'));
if (manifest.org_id !== ORG_ID) {
  console.error(`org_id do backup (${manifest.org_id}) ≠ Ecológica (${ORG_ID}) — abortando por segurança`);
  process.exit(1);
}
const readJson = (name) => (existsSync(`${dir}${name}.json`) ? JSON.parse(readFileSync(`${dir}${name}.json`, 'utf8')) : []);
const dashboards = readJson('dashboards');
const widgets = readJson('dashboard_widgets');
const mappings = readJson('data_mappings');
const dashIds = dashboards.map((d) => d.id);

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
async function del(path) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, { method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' } });
  if (!r.ok && r.status !== 404) throw new Error(`DELETE ${path} → ${r.status} ${await r.text()}`);
}
async function ins(table, rows) {
  if (!rows.length) return;
  const r = await fetch(`${BASE}/rest/v1/${table}`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(rows) });
  if (!r.ok) throw new Error(`INSERT ${table} → ${r.status} ${await r.text()}`);
}

console.log(`\nRESTORE Ecológica ${COMMIT ? '(--commit: EFETIVANDO)' : '(DRY-RUN — nada será escrito)'}`);
console.log(`origem: ${dir}`);
console.log(`alvo  : ${BASE}`);
console.log(`\nplano:`);
console.log(`  dashboards no backup : ${dashboards.length}  [${dashIds.join(', ') || '—'}]`);
console.log(`  widgets a restaurar  : ${widgets.length}`);
console.log(`  data_mappings a restaurar: ${mappings.length}`);

if (!COMMIT) {
  console.log('\n(DRY-RUN) para efetivar o rollback, repita com  --commit\n');
  process.exit(0);
}

if (!dashIds.length) {
  console.error('backup sem dashboards — nada para restaurar com segurança');
  process.exit(1);
}

console.log('\nexecutando rollback…');
// 1) widgets: apaga atuais do(s) dashboard(s) e recoloca os do backup (ids preservados)
await del(`dashboard_widgets?dashboard_id=in.(${dashIds.join(',')})`);
await ins('dashboard_widgets', widgets);
console.log(`  ✅ dashboard_widgets: ${widgets.length} linha(s) restauradas`);

// 2) data_mappings: apaga atuais da org e recoloca os do backup
await del(`data_mappings?org_id=eq.${ORG_ID}`);
await ins('data_mappings', mappings);
console.log(`  ✅ data_mappings: ${mappings.length} linha(s) restauradas`);

console.log('\n✅ rollback completo — estado do backup reposto.\n');
