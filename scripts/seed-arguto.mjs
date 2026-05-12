/**
 * Cria conta de demo Arguto:
 *  1. user (email_confirm=true, sem confirmação por email)
 *  2. organização "Arguto"
 *  3. profile.org_id setado
 *  4. user_roles → client_admin
 *
 * Uso:
 *   node scripts/seed-arguto.mjs
 *
 * Precisa de SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no env.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bkgwzxrutzmmxmxzfhmw.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não definido no env.');
  process.exit(1);
}

const ARGUTO_EMAIL = 'arguto@pinn.com';
const ARGUTO_PASS  = '123456';
const ARGUTO_ORG   = 'Arguto';
const ARGUTO_SLUG  = 'arguto';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('▸ Seeding Arguto demo account...');

  // ─── 1. Tentar criar user (idempotente) ───────────────────────────
  let userId;
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: ARGUTO_EMAIL,
    password: ARGUTO_PASS,
    email_confirm: true,
    user_metadata: { full_name: 'Arguto · Demo' },
  });

  if (createErr) {
    if (/already (registered|been registered)|exists/i.test(createErr.message)) {
      console.log('  · user já existe — buscando…');
      // Busca via listUsers (limit alto pq SDK não tem filter direto)
      const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 200 });
      if (listErr) throw listErr;
      const found = list.users.find((u) => u.email?.toLowerCase() === ARGUTO_EMAIL);
      if (!found) throw new Error('User dito existente mas não encontrado em listUsers.');
      userId = found.id;
      // Reset password idempotente
      await supabase.auth.admin.updateUserById(userId, {
        password: ARGUTO_PASS,
        email_confirm: true,
      });
      console.log(`  · user existente, password reset → ${userId}`);
    } else {
      throw createErr;
    }
  } else {
    userId = created.user.id;
    console.log(`  · user criado → ${userId}`);
  }

  // ─── 2. Garantir profile (trigger handle_new_user cria, mas pode falhar p/ existente) ───
  const { data: prof, error: profErr } = await supabase
    .from('profiles')
    .select('id, org_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (profErr) throw profErr;
  if (!prof) {
    const { error: insProfErr } = await supabase.from('profiles').insert({
      user_id: userId,
      email: ARGUTO_EMAIL,
      full_name: 'Arguto · Demo',
    });
    if (insProfErr) throw insProfErr;
    console.log('  · profile inserido manualmente');
  } else {
    console.log('  · profile já existe');
  }

  // ─── 3. Upsert organization ───────────────────────────────────────
  const { data: existingOrg } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('slug', ARGUTO_SLUG)
    .maybeSingle();

  let orgId;
  if (existingOrg) {
    orgId = existingOrg.id;
    console.log(`  · org já existe → ${orgId}`);
  } else {
    // Tenta inserir só campos garantidos pela schema cache atual.
    // Schema produção pode ter dropado várias colunas DS-related; mantém mínimo.
    const orgPayload = {
      name: ARGUTO_ORG,
      slug: ARGUTO_SLUG,
      plan: 2,
      status: 'active',
      admin_email: ARGUTO_EMAIL,
      admin_name: 'Arguto · Demo',
    };
    const { data: newOrg, error: orgErr } = await supabase
      .from('organizations')
      .insert(orgPayload)
      .select('id')
      .single();
    if (orgErr) throw orgErr;
    orgId = newOrg.id;
    console.log(`  · org criada → ${orgId}`);
  }

  // ─── 4. Linka profile à org ───────────────────────────────────────
  const { error: updProfErr } = await supabase
    .from('profiles')
    .update({ org_id: orgId })
    .eq('user_id', userId);
  if (updProfErr) throw updProfErr;
  console.log('  · profile.org_id setado');

  // ─── 5. Role client_admin (UNIQUE user_id, role → idempotente via upsert) ──
  const { error: roleErr } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role: 'client_admin' }, { onConflict: 'user_id,role' });
  if (roleErr) throw roleErr;
  console.log('  · user_role=client_admin garantido');

  // ─── 6. Cria dashboard default (caso DashboardEngine espere algo) ─────────
  const { data: dash } = await supabase
    .from('dashboards')
    .select('id')
    .eq('org_id', orgId)
    .maybeSingle();
  if (!dash) {
    await supabase.from('dashboards').insert({
      org_id: orgId,
      name: 'Executivo',
      description: 'Dashboard inicial · Arguto',
      is_default: true,
    });
    console.log('  · dashboard default criado');
  } else {
    console.log('  · dashboard já existe');
  }

  console.log('\n✅ Tudo pronto.');
  console.log('────────────────────────────────────────');
  console.log(`  Email:    ${ARGUTO_EMAIL}`);
  console.log(`  Senha:    ${ARGUTO_PASS}`);
  console.log(`  user_id:  ${userId}`);
  console.log(`  org_id:   ${orgId}`);
  console.log(`  Demo URL: http://localhost:8081/client/${orgId}/arguto`);
  console.log('────────────────────────────────────────');
}

main().catch((e) => {
  console.error('\n❌ Falhou:', e.message || e);
  if (e.cause) console.error('  cause:', e.cause);
  process.exit(1);
});
