/**
 * THROWAWAY VALIDATION HARNESS — não é código de produto.
 *
 * Objetivo: rodar a LÓGICA REAL do pipeline genérico de auto-build
 *   (suggest-tables → suggest-mappings → recommend-widgets, caminho heurístico)
 * contra uma reconstrução fiel do schema da Ecológica (`kommo_leads_ecologica`)
 * e checar se o pipeline GENÉRICO reproduz o dashboard montado à mão na
 * migration 20260219160345 — SEM nenhuma linha de código específica `_ecologica`.
 *
 * A lógica das 3 funções vive em scripts/_ecologica-pipeline.mjs (portada VERBATIM
 * das edge functions já corrigidas). Aqui só há FIXTURE + ALVO + relatório.
 *
 * Para validar contra os DADOS REAIS (Supabase externo), ver:
 *   node scripts/ecologica-realdata-validate.mjs
 *
 * Rodar:  node scripts/validate-ecologica-pipeline.mjs
 * Read-only. Sem rede, sem banco. Só checa o algoritmo.
 */

import {
  heuristicSuggestions,
  heuristicMappings,
  generateRecommendations,
  adaptMappings,
} from './_ecologica-pipeline.mjs';

/* ════════════════════════════════════════════════════════════════════════
 * 1. FIXTURE — schema reconstruído de kommo_leads_ecologica (+ tabelas irmãs)
 *    Colunas derivadas da migration 20260219160345 (nomes + uso).
 *    TIPOS são a melhor inferência: as flags de reunião como BOOLEAN
 *    (títulos "Com Reunião"/"Reuniões Agendadas" + count ⇒ flag bool;
 *     horario_reuniao/link_reuniao são colunas separadas de detalhe).
 * ════════════════════════════════════════════════════════════════════════ */

const FIXTURE_TABLES = [
  {
    name: 'kommo_leads_ecologica',
    rowCount: 540,
    columns: [
      { name: 'id', type: 'uuid', sampleValues: ['a1b2c3d4-...', 'e5f6...'] },
      { name: 'nome_lead', type: 'text', sampleValues: ['João Silva', 'Maria Souza', 'Pedro Santos'] },
      { name: 'reuniao', type: 'boolean', sampleValues: [true, false, true] },
      { name: 'reuniao_agendada', type: 'boolean', sampleValues: [true, false, false] },
      { name: 'reuniao_realizada', type: 'boolean', sampleValues: [false, true, false] },
      { name: 'destino_de_interesse', type: 'text', sampleValues: ['Cancún', 'Orlando', 'Maldivas'] },
      { name: 'data_criacao', type: 'timestamp', sampleValues: ['2026-01-15T10:00:00Z', '2026-01-16T11:30:00Z'] },
      { name: 'quantidade_de_pessoas', type: 'integer', sampleValues: [2, 4, 1] },
      { name: 'vendedor', type: 'text', sampleValues: ['Ana', 'Carlos', 'Ana'] },
      { name: 'resumo', type: 'text', sampleValues: ['Quer pacote família', 'Lua de mel'] },
      { name: 'horario_reuniao', type: 'text', sampleValues: ['14:00', '10:30'] },
      { name: 'link_reuniao', type: 'text', sampleValues: ['https://meet.google.com/x', 'https://zoom.us/y'] },
      { name: 'origem_lead', type: 'text', sampleValues: [null, null, 'Instagram'] },
    ],
  },
  // tabelas irmãs no mesmo Supabase externo — pra forçar suggest-tables a ESCOLHER
  {
    name: 'kommo_talks',
    rowCount: 12030,
    columns: [
      { name: 'id', type: 'uuid', sampleValues: ['...'] },
      { name: 'lead_id', type: 'uuid', sampleValues: ['...'] },
      { name: 'message', type: 'text', sampleValues: ['oi', 'tudo bem?'] },
      { name: 'direction', type: 'text', sampleValues: ['in', 'out'] },
      { name: 'created_at', type: 'timestamp', sampleValues: ['2026-01-15T10:00:00Z'] },
    ],
  },
  {
    name: 'kommo_accounts',
    rowCount: 3,
    columns: [
      { name: 'id', type: 'uuid', sampleValues: ['...'] },
      { name: 'name', type: 'text', sampleValues: ['Ecológica'] },
      { name: 'created_at', type: 'timestamp', sampleValues: ['2025-01-01T00:00:00Z'] },
    ],
  },
  {
    name: 'n8n_chat_histories',
    rowCount: 88210,
    columns: [
      { name: 'id', type: 'integer', sampleValues: [1, 2, 3] },
      { name: 'session_id', type: 'text', sampleValues: ['s1', 's2'] },
      { name: 'message', type: 'jsonb', sampleValues: ['{...}'] },
    ],
  },
  {
    name: 'catalogo_ecologica',
    rowCount: 210,
    columns: [
      { name: 'id', type: 'uuid', sampleValues: ['...'] },
      { name: 'item', type: 'text', sampleValues: ['Pacote Cancún'] },
      { name: 'preco', type: 'numeric', sampleValues: [4500.0, 8200.5, 3100.0] },
    ],
  },
];

/* ════════════════════════════════════════════════════════════════════════
 * 2. ALVO — dashboard real montado à mão (migration 20260219160345)
 * ════════════════════════════════════════════════════════════════════════ */

const LIVE_TARGET_WIDGETS = [
  { title: 'Total de Leads', col: 'nome_lead', agg: 'count' },
  { title: 'Com Reunião', col: 'reuniao', agg: 'count' },
  { title: 'Reuniões Agendadas', col: 'reuniao_agendada', agg: 'count' },
  { title: 'Reuniões Realizadas', col: 'reuniao_realizada', agg: 'count' },
  { title: 'Destinos', col: 'destino_de_interesse', agg: 'count' },
  { title: 'Conv. Lead → Reunião', col: 'reuniao', agg: 'count (%)' },
  { title: 'Evolução Diária', col: 'nome_lead', groupBy: 'data_criacao' },
  { title: 'Pipeline por Destino', groupBy: 'destino_de_interesse' },
  { title: 'Próximas Reuniões (tabela)', cols: ['nome_lead', 'destino_de_interesse', 'horario_reuniao', 'link_reuniao', 'vendedor'] },
  { title: 'Destinos Populares (pie)', groupBy: 'destino_de_interesse' },
  { title: 'Lista de Leads (tabela)', cols: ['nome_lead', 'data_criacao', 'destino_de_interesse', 'quantidade_de_pessoas', 'vendedor', 'resumo'] },
  { title: 'Insights IA', col: '—' },
];

/* ════════════════════════════════════════════════════════════════════════
 * 3. RUN + REPORT
 * ════════════════════════════════════════════════════════════════════════ */

const line = (c = '─') => c.repeat(78);
console.log('\n' + line('═'));
console.log(' VALIDAÇÃO DO PIPELINE GENÉRICO vs DASHBOARD HARDCODED DA ECOLÓGICA');
console.log(' (caminho heurístico — sem OPENAI_API_KEY / LOVABLE_API_KEY)');
console.log(line('═'));

console.log('\n[1] suggest-tables → ranking de tabelas:');
const tableSugs = heuristicSuggestions(FIXTURE_TABLES);
for (const s of tableSugs) console.log(`    ${String(s.score).padStart(3)}  ${s.tableName}  (${s.reason})`);
const picked = tableSugs[0]?.tableName;
console.log(`    → escolhida: ${picked}  ${picked === 'kommo_leads_ecologica' ? '✅ correta' : '❌ ERRADA'}`);

console.log('\n[2] suggest-mappings → mapeamentos coluna→métrica (só na tabela escolhida):');
const pickedTables = FIXTURE_TABLES.filter((t) => t.name === picked);
const mapRes = heuristicMappings(pickedTables);
const mainCols = FIXTURE_TABLES.find((t) => t.name === 'kommo_leads_ecologica').columns.map((c) => c.name);
const gotMain = mapRes.suggestions.filter((s) => s.sourceTable === 'kommo_leads_ecologica');
if (gotMain.length === 0) console.log('    (nenhum mapeamento na kommo_leads_ecologica)');
for (const s of gotMain) console.log(`    ${s.sourceField.padEnd(24)} → ${s.targetMetric.padEnd(18)} [${s.transformation}${s.aggregation ? '/' + s.aggregation : ''}, conf ${s.confidence}]`);
console.log(`    primaryTable: ${mapRes.primaryTable}`);
console.log('    colunas SEM mapeamento (esperado: id + colunas de detalhe):');
const mappedCols = new Set(gotMain.map((s) => s.sourceField));
console.log('      ' + mainCols.filter((c) => !mappedCols.has(c)).join(', '));

console.log('\n[3] recommend-widgets → widgets gerados (após round-trip data_mappings):');
const dataMappings = adaptMappings(mapRes.suggestions);
const widgets = generateRecommendations(dataMappings);
for (const w of widgets) console.log(`    ${String(w.score).padStart(3)}  ${w.type.padEnd(12)} ${w.title}  ${w.config?.metric ? `(${w.config.metric}/${w.config.aggregation || '?'}${w.config.groupBy ? ' by ' + w.config.groupBy : ''})` : w.config?.groupBy ? `(by ${w.config.groupBy})` : ''}`);

console.log('\n[4] COMPARAÇÃO com o dashboard real (migration 20260219160345):');
console.log(`    ALVO  : ${LIVE_TARGET_WIDGETS.length} widgets — ${LIVE_TARGET_WIDGETS.map((w) => w.title).join(', ')}`);
console.log(`    GERADO: ${widgets.length} widgets — ${widgets.map((w) => w.title).join(', ')}`);

const hit = (needleCol, metric) => gotMain.some((s) => s.sourceField === needleCol && (!metric || s.targetMetric === metric));
const signals = [
  ['nome_lead → total_leads (count rows)', hit('nome_lead', 'total_leads')],
  ['reuniao (bool) → "Com Reunião"', hit('reuniao')],
  ['reuniao_agendada → meetings_scheduled', hit('reuniao_agendada', 'meetings_scheduled')],
  ['reuniao_realizada → meetings_done', hit('reuniao_realizada', 'meetings_done')],
  ['destino_de_interesse → categoria/pipeline', hit('destino_de_interesse')],
  ['origem_lead → lead_source', hit('origem_lead', 'lead_source')],
];
console.log('\n[5] SINAIS-CHAVE que o dashboard real usa — o genérico capturou?');
for (const [label, ok] of signals) console.log(`    ${label.padEnd(44, '.')} ${ok ? '✅' : '❌'}`);
const signalsPassed = signals.filter(([, ok]) => ok).length;

console.log('\n' + line());
console.log(' VEREDITO (caminho heurístico):');
console.log(`   colunas de negócio mapeadas: ${gotMain.length}`);
console.log(`   sinais-chave capturados:     ${signalsPassed}/${signals.length}`);
console.log(`   widgets gerados:             ${widgets.length}/${LIVE_TARGET_WIDGETS.length}`);
console.log(`   ${signalsPassed === signals.length ? '✅ PASSOU — pipeline genérico reproduz o essencial do dashboard hardcoded' : '❌ FALHOU — ainda faltam sinais-chave (ver acima)'}`);
console.log(line() + '\n');
