/**
 * THROWAWAY — descoberta read-only do schema do BAI p/ planejar o backup da Ecológica.
 * Lê credenciais de backend/.env (NUNCA hardcoda segredo). Só SELECT/HEAD.
 *   node scripts/ecologica-discover.mjs
 */
import { readFileSync } from 'node:fs';

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
if (!BASE || !KEY) { console.error('faltam SUPABASE_URL / SUPABASE_SERVICE_KEY em backend/.env'); process.exit(1); }

// confirma projeto pelo ref no JWT
const ref = JSON.parse(Buffer.from(KEY.split('.')[1], 'base64').toString()).ref;
console.log('PROJETO (ref do service_role):', ref);
console.log('SUPABASE_URL aponta p/ ref:', BASE.includes(ref) ? '✅ mesmo projeto' : `⚠️ ${BASE}`);

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const rest = (path) => fetch(`${BASE}/rest/v1/${path}`, { headers: H });

// 1) tabelas expostas (OpenAPI root)
const root = await rest('').then((r) => r.json());
const defs = root.definitions || root.components?.schemas || {};
const tables = Object.keys(defs).sort();
console.log(`\nTABELAS EXPOSTAS (${tables.length}):`);
console.log('  ' + tables.join(', '));

const interest = ['organizations', 'dashboards', 'dashboard_widgets', 'data_mappings', 'integrations', 'tenants'].filter((t) => tables.includes(t));
console.log('\nTABELAS-ALVO presentes:', interest.join(', ') || '(nenhuma!)');

// 2) achar a org da Ecológica
async function findOrg() {
  for (const col of ['name', 'nome', 'slug', 'display_name']) {
    if (!defs.organizations?.properties?.[col]) continue;
    const r = await rest(`organizations?select=*&${col}=ilike.*ecol*`);
    if (r.ok) {
      const rows = await r.json();
      if (rows.length) return { col, rows };
    }
  }
  // fallback: lista todas as orgs (id + colunas de nome)
  const r = await rest('organizations?select=*');
  const rows = r.ok ? await r.json() : [];
  return { col: null, rows };
}

if (interest.includes('organizations')) {
  console.log('\nCOLUNAS de organizations:', Object.keys(defs.organizations.properties || {}).join(', '));
  const { col, rows } = await findOrg();
  console.log(`\nORGS encontradas (match por ${col || 'listagem geral'}): ${rows.length}`);
  for (const o of rows.slice(0, 20)) {
    const nameKey = ['name', 'nome', 'display_name', 'slug'].find((k) => o[k]);
    console.log(`  id=${o.id}  ${nameKey}=${o[nameKey]}`);
  }
}

// 3) colunas das tabelas de dashboard
for (const t of ['dashboards', 'dashboard_widgets', 'data_mappings', 'integrations']) {
  if (defs[t]) console.log(`\nCOLUNAS de ${t}:`, Object.keys(defs[t].properties || {}).join(', '));
}
