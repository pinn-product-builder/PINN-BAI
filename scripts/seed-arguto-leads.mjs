/**
 * Popula public.leads pra org Arguto com os 10 clientes do fixture.
 * Permite que o BAI Copilot responda nominalmente sobre clientes
 * (a edge function ai-data-chat lê de leads, não dos fixtures do frontend).
 *
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-arguto-leads.mjs
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

/** Status válidos no enum lead_status: new, qualified, in_analysis, proposal, converted, lost */
const LEADS = [
  { external_id: 'cli-001', name: 'Mercado Central LTDA',  status: 'qualified',  value:  8400, company: 'Mercado Central · Uberlândia' },
  { external_id: 'cli-002', name: 'Distrib. Bom Preço',    status: 'in_analysis',value: 12200, company: 'Distrib. Bom Preço · Uberlândia' },
  { external_id: 'cli-003', name: 'Atacarejo Triângulo',   status: 'proposal',   value: 19800, company: 'Atacarejo Triângulo · Uberlândia' },
  { external_id: 'cli-004', name: 'Mercado São José',      status: 'lost',       value:  6100, company: 'Mercado São José · Araguari' },
  { external_id: 'cli-005', name: 'Padaria Vovó Maria',    status: 'qualified',  value:  3300, company: 'Padaria Vovó Maria · Uberlândia' },
  { external_id: 'cli-006', name: 'Distrib. Cerrado',      status: 'converted',  value:  9700, company: 'Distrib. Cerrado · Patos de Minas' },
  { external_id: 'cli-007', name: 'Supermercados Aliança', status: 'in_analysis',value: 15400, company: 'Supermercados Aliança · Uberaba' },
  { external_id: 'cli-008', name: 'Rede Bom Dia',          status: 'converted',  value:  7900, company: 'Rede Bom Dia · Ituiutaba' },
  { external_id: 'cli-009', name: 'Mercearia Boa Vista',   status: 'lost',       value:  2800, company: 'Mercearia Boa Vista · Araguari' },
  { external_id: 'cli-010', name: 'Atacado Sertão',        status: 'proposal',   value: 11300, company: 'Atacado Sertão · Patrocínio' },
];

async function main() {
  console.log('▸ Populando public.leads pra Arguto...');

  const rows = LEADS.map((l) => ({
    org_id: ARGUTO_ORG_ID,
    external_id: l.external_id,
    name: l.name,
    email: `${l.external_id}@arguto.demo`,
    company: l.company,
    status: l.status,
    source: 'referral',
    value: l.value,
    metadata: { sinal_bai: 'demo', cidade: l.company.split('·')[1]?.trim() },
  }));

  // UPSERT por (org_id, external_id) — schema tem UNIQUE(org_id, external_id)
  const { error } = await supabase
    .from('leads')
    .upsert(rows, { onConflict: 'org_id,external_id' });

  if (error) throw error;
  console.log(`  ✓ ${rows.length} leads upsertados`);
  console.log('\n  Distribuição de status:');
  const byStatus = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  Object.entries(byStatus).forEach(([s, n]) => console.log(`    ${s.padEnd(14)}: ${n}`));

  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  console.log(`\n  Receita total atrelada: R$ ${totalValue.toLocaleString('pt-BR')}`);
  console.log('\n✅ Pronto. BAI Copilot agora pode responder sobre clientes nominalmente.');
}

main().catch((e) => {
  console.error('\n❌ Falhou:', e.message || e);
  if (e.details) console.error('  details:', e.details);
  process.exit(1);
});
