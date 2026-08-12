/**
 * BACKUP reversível do estado de dashboard da Ecológica (org viva) ANTES do recreate.
 * READ-only no servidor + WRITE local. Lê credenciais de backend/.env (não hardcoda).
 *
 *   node scripts/ecologica-backup.mjs
 *
 * Gera: backups/ecologica/<timestamp>/<tabela>.json  +  manifest.json
 * Restaurar:  node scripts/ecologica-restore.mjs backups/ecologica/<timestamp>
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const ORG_ID = 'f511e4f6-e94e-4581-a088-44377e67d5ba'; // Ecológica Turismo

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
if (!BASE || !KEY) { console.error('faltam SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
async function sel(path) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error(`${path} → ${r.status} ${await r.text()}`);
  return r.json();
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dir = new URL(`../backups/ecologica/${stamp}/`, import.meta.url).pathname;
mkdirSync(dir, { recursive: true });

const manifest = { org_id: ORG_ID, project: 'bkgwzxrutzmmxmxzfhmw', created_at: new Date().toISOString(), tables: {} };
function save(name, rows) {
  writeFileSync(`${dir}${name}.json`, JSON.stringify(rows, null, 2));
  manifest.tables[name] = rows.length;
  console.log(`  ${name.padEnd(20)} ${rows.length} linha(s)`);
}

console.log(`\nBACKUP Ecológica (org ${ORG_ID})`);
console.log(`destino: ${dir}\n`);

// 1) org + integrations (contexto / snapshot, não serão modificados)
save('organizations', await sel(`organizations?select=*&id=eq.${ORG_ID}`));
save('integrations', await sel(`integrations?select=*&org_id=eq.${ORG_ID}`));

// 2) dashboards (serão afetados) → pega ids p/ widgets/shares
const dashboards = await sel(`dashboards?select=*&org_id=eq.${ORG_ID}`);
save('dashboards', dashboards);
const dashIds = dashboards.map((d) => d.id);

// 3) widgets ligam por dashboard_id
let widgets = [];
if (dashIds.length) widgets = await sel(`dashboard_widgets?select=*&dashboard_id=in.(${dashIds.join(',')})`);
save('dashboard_widgets', widgets);

// 4) shares (ligam por dashboard_id) — best-effort
try {
  let shares = [];
  if (dashIds.length) shares = await sel(`dashboard_shares?select=*&dashboard_id=in.(${dashIds.join(',')})`);
  save('dashboard_shares', shares);
} catch (e) { console.log('  dashboard_shares: pulado (', String(e.message).slice(0, 60), ')'); }

// 5) data_mappings (serão afetados)
save('data_mappings', await sel(`data_mappings?select=*&org_id=eq.${ORG_ID}`));

// 6) selected_tables / dashboard_data_sources (best-effort por org_id)
for (const t of ['selected_tables', 'dashboard_data_sources', 'dashboard_uploaded_datasets']) {
  try { save(t, await sel(`${t}?select=*&org_id=eq.${ORG_ID}`)); }
  catch (e) { console.log(`  ${t}: pulado (`, String(e.message).slice(0, 60), ')'); }
}

writeFileSync(`${dir}manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`\n✅ backup completo. manifest: ${dir}manifest.json`);
console.log(`   widgets atuais: ${manifest.tables.dashboard_widgets} | dashboards: ${manifest.tables.dashboards} | mappings: ${manifest.tables.data_mappings}`);
