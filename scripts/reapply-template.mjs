/**
 * Script para re-aplicar o template "Visão Executiva Premium" no dashboard existente
 * Uso: node scripts/reapply-template.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bkgwzxrutzmmxmxzfhmw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZ3d6eHJ1dHptbXhteHpmaG13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMjc2ODUsImV4cCI6MjA4NTcwMzY4NX0.QlOjmLhKmpiOYr_qm-IDLoSjhE7Z18YKlmin5SFht90';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('=== Re-aplicar Template Visão Executiva Premium ===\n');

  // 1. Buscar o template premium (listar todos para debug)
  const { data: allTemplates, error: listErr } = await supabase
    .from('dashboard_templates')
    .select('id, name, is_active, category');
  
  console.log('Templates disponíveis:', allTemplates?.map(t => `${t.name} (active=${t.is_active}, cat=${t.category})`) || listErr?.message);

  const { data: templates, error: tplErr } = await supabase
    .from('dashboard_templates')
    .select('*')
    .eq('category', 'executive')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  if (tplErr || !templates?.length) {
    console.error('Template não encontrado:', tplErr?.message);
    process.exit(1);
  }
  const template = templates[0];
  console.log(`Template: ${template.name} (${template.id})`);
  console.log(`Widgets no template: ${template.widgets.length}\n`);

  // 2. Buscar dashboards default
  const { data: dashboards, error: dashErr } = await supabase
    .from('dashboards')
    .select('id, name, org_id')
    .eq('is_default', true);

  if (dashErr || !dashboards?.length) {
    console.error('Nenhum dashboard encontrado:', dashErr?.message);
    process.exit(1);
  }

  for (const dash of dashboards) {
    console.log(`\nDashboard: "${dash.name}" (${dash.id})`);
    console.log(`Org: ${dash.org_id}`);

    // 3. Contar widgets atuais
    const { count: currentCount } = await supabase
      .from('dashboard_widgets')
      .select('*', { count: 'exact', head: true })
      .eq('dashboard_id', dash.id);
    
    console.log(`Widgets atuais: ${currentCount}`);

    // 4. Remover widgets existentes
    const { error: delErr } = await supabase
      .from('dashboard_widgets')
      .delete()
      .eq('dashboard_id', dash.id);

    if (delErr) {
      console.error(`Erro ao remover widgets: ${delErr.message}`);
      continue;
    }
    console.log('Widgets antigos removidos.');

    // 5. Criar novos widgets a partir do template
    const templateWidgets = template.widgets;
    const newWidgets = templateWidgets.map((tw, index) => ({
      dashboard_id: dash.id,
      title: tw.title,
      type: tw.type,
      position: tw.position || index,
      size: tw.size,
      config: tw.config,
      description: tw.description || null,
      is_visible: true,
    }));

    const { error: insErr, data: inserted } = await supabase
      .from('dashboard_widgets')
      .insert(newWidgets)
      .select('id, title, type');

    if (insErr) {
      console.error(`Erro ao inserir widgets: ${insErr.message}`);
      continue;
    }

    console.log(`\n${inserted.length} widgets criados:`);
    inserted.forEach((w, i) => {
      console.log(`  ${i + 1}. [${w.type}] ${w.title}`);
    });
  }

  console.log('\n=== Concluído! Recarregue o dashboard no navegador. ===');
}

main().catch(console.error);
