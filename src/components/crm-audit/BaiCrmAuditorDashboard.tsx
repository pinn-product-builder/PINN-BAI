/**
 * BAI CRM Auditor — painel principal em 5 camadas de leitura (executivo → recomendação).
 * Dados: GET /api/dashboard e POST /api/analyze (inalterados). Campos extras: executive_scoreboard, audit_enrichment.
 */
import type { ReactNode } from "react";
import { useDashboardTheme } from "@/hooks/useDashboardTheme";
import { useSectionSpy } from "@/hooks/useSectionSpy";
import { buildExecutiveBrief, fmtMoney, fmtNum, fmtPct, splitActionHorizons } from "@/bai/helpers";
import { resolveExecutiveScoreboard } from "@/bai/executiveScores";
import { resolveEvidenceTables } from "@/bai/evidenceFallback";
import { DashboardChartsPanel } from "./dashboardCharts";
import { DashboardHeader } from "./bai/DashboardHeader";
import { EvidenceDataTable, type EvidenceRow } from "./bai/EvidenceDataTable";
import { ExecutiveScoreboard } from "./bai/ExecutiveScoreboard";
import { SectionCard } from "./bai/SectionCard";

export type DashboardData = Record<string, unknown>;

type Props = {
  data: DashboardData | null;
  analysis: Record<string, unknown> | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onAnalyze: () => void;
  apiBase: string;
};

/** Ordem das tabelas de evidência (chaves = `evidence_tables.rows` no backend). */
const EVIDENCE_BLOCKS: {
  key:
    | "no_next_action"
    | "no_owner"
    | "no_value"
    | "no_source"
    | "overdue_tasks"
    | "stuck_leads"
    | "lost_without_reason"
    | "incomplete_contacts"
    | "duplicate_email_groups"
    | "stage_bottlenecks";
  jumpLabel: string;
  title: string;
  subtitle: string;
  emptyHint: string;
}[] = [
  {
    key: "no_next_action",
    jumpLabel: "Sem próxima ação",
    title: "Oportunidades sem próxima ação",
    subtitle: "Abertas sem nenhuma tarefa pendente no Kommo (próximo passo explícito).",
    emptyHint: "Não há oportunidades neste diagnóstico no snapshot, ou a contagem está zerada.",
  },
  {
    key: "no_owner",
    jumpLabel: "Sem responsável",
    title: "Oportunidades sem responsável",
    subtitle: "Abertas sem usuário responsável atribuído.",
    emptyHint: "Todas as abertas têm responsável — ou não há oportunidades abertas.",
  },
  {
    key: "no_value",
    jumpLabel: "Sem valor",
    title: "Oportunidades sem valor",
    subtitle: "Abertas com valor monetário zerado (forecast incompleto).",
    emptyHint: "Sem registros com valor zerado neste recorte.",
  },
  {
    key: "no_source",
    jumpLabel: "Sem origem",
    title: "Oportunidades sem origem",
    subtitle: "Abertas sem origem do lead (canal/campanha) quando o campo existe no Kommo.",
    emptyHint: "Origem preenchida nas abertas — ou não há abertas.",
  },
  {
    key: "overdue_tasks",
    jumpLabel: "Tarefas vencidas",
    title: "Tarefas vencidas",
    subtitle: "Tarefas em aberto com data de conclusão no passado.",
    emptyHint: "Nenhuma tarefa vencida pendente no snapshot.",
  },
  {
    key: "stuck_leads",
    jumpLabel: "Parados",
    title: "Leads parados",
    subtitle: "Abertas sem atualização há pelo menos o limiar configurado no servidor (padrão 7 dias).",
    emptyHint: "Nenhuma oportunidade parada acima do limiar — ou não há abertas.",
  },
  {
    key: "lost_without_reason",
    jumpLabel: "Perdas sem motivo",
    title: "Perdas sem motivo",
    subtitle: "Oportunidades fechadas como perdidas sem motivo de perda informado.",
    emptyHint: "Todas as perdas têm motivo — ou não há perdas no snapshot.",
  },
  {
    key: "incomplete_contacts",
    jumpLabel: "Contatos incompletos",
    title: "Contatos incompletos",
    subtitle: "Contatos sem e-mail ou sem telefone (campos extraídos da API Kommo).",
    emptyHint: "Todos os contatos têm e-mail e telefone preenchidos — ou não há contatos.",
  },
  {
    key: "duplicate_email_groups",
    jumpLabel: "Duplicidade e-mail",
    title: "Possíveis duplicidades (e-mail)",
    subtitle: "Grupos que compartilham o mesmo endereço de e-mail (contagem ≥2).",
    emptyHint: "Nenhum e-mail duplicado entre contatos neste snapshot.",
  },
  {
    key: "stage_bottlenecks",
    jumpLabel: "Gargalo por etapa",
    title: "Etapas com maior concentração (gargalo relativo)",
    subtitle: "Estágios com maior % do total de oportunidades abertas — leitura de concentração, não de tempo de ciclo.",
    emptyHint: "Sem distribuição por estágio disponível.",
  },
];

const NAV = [
  { id: "sec-scoreboard", label: "Scoreboard" },
  { id: "sec-resumo-exec", label: "Resumo executivo" },
  { id: "sec-visao", label: "Operação" },
  { id: "sec-graficos", label: "Gráficos" },
  { id: "sec-funil", label: "Funil" },
  { id: "sec-higiene", label: "Higiene" },
  { id: "sec-tarefas", label: "Tarefas" },
  { id: "sec-time", label: "Equipe" },
  { id: "sec-perdas", label: "Perdas" },
  { id: "sec-forecast", label: "Forecast" },
  { id: "sec-inventario", label: "Inventário" },
  { id: "sec-diagnostico", label: "Diagnóstico" },
  { id: "sec-plano", label: "Plano de ação" },
  { id: "sec-parecer", label: "Parecer IA" },
  { id: "sec-evidencias", label: "Evidências" },
];

const NAV_SECTION_IDS = NAV.map((n) => n.id);

export function BaiCrmAuditorDashboard({ data, analysis, loading, error, onRefresh, onAnalyze, apiBase }: Props) {
  const { theme, toggleTheme } = useDashboardTheme();
  const activeNavId = useSectionSpy(NAV_SECTION_IDS);
  const productName = String((data?.product_meta as { name?: string })?.name ?? "BAI CRM Auditor");
  const snapshot =
    data && typeof data.fetched_at === "string" ? `${(data.fetched_at as string).slice(0, 19).replace("T", " ")} UTC` : null;

  const ov = (data?.overview ?? {}) as Record<string, number | undefined>;
  const scores = (data?.scores ?? {}) as Record<string, number | undefined>;
  const execResolved = data ? resolveExecutiveScoreboard(data as Record<string, unknown>) : { scores: {} as Record<string, number>, meta: {} as Record<string, unknown> };
  const enrich = (data?.audit_enrichment ?? {}) as Record<string, unknown>;
  const dq = (data?.data_quality ?? {}) as Record<string, number | undefined>;
  const checklist = (data?.checklist ?? []) as { id?: string; label?: string; ok?: boolean; hint?: string | null }[];
  const gaps = (data?.gaps_and_risks ?? []) as { category?: string; title?: string; detail?: string; severity?: string }[];
  const strengths = (data?.strengths ?? []) as { title?: string; detail?: string }[];
  const counts = (data?.counts ?? {}) as Record<string, number | undefined>;
  const rollups = data?.funnel_rollups as Record<string, Record<string, number>> | undefined;
  const pipes = (data?.pipeline_process_detail ?? []) as Record<string, unknown>[];
  const stageDist = (data?.stage_distribution ?? []) as { stage_name?: string; lead_count?: number; pct_of_open_pipeline?: number }[];
  const lostTop = (data?.lost_reasons_top ?? []) as { lost_reason?: string; cnt?: number }[];
  const owners = (data?.owners ?? []) as Record<string, unknown>[];
  const ownerOps = (enrich.owner_operational as Record<string, unknown>[] | undefined) ?? [];
  const taskM = (enrich.task_metrics ?? {}) as Record<string, unknown>;
  const fin = (enrich.financial_snapshot ?? {}) as Record<string, unknown>;
  const lossM = (enrich.loss_metrics ?? {}) as Record<string, unknown>;
  const stageLoss = (enrich.stage_loss_breakdown ?? []) as { stage_name?: string; lost_count?: number }[];
  const eng = (data?.engagement ?? {}) as { counts?: Record<string, number> };
  const samples = (data?.samples ?? {}) as { counts?: Record<string, number>; stuck_leads?: unknown[]; no_next_action_leads?: unknown[]; overdue_tasks?: unknown[] };
  const evidencePayload = data ? resolveEvidenceTables(data as Record<string, unknown>) : null;

  const brief = buildExecutiveBrief({
    gaps,
    strengths,
    analysisRisks: (analysis?.risks as string[]) ?? [],
    recommendations: (analysis?.recommendations as string[]) ?? [],
  });
  const horizons = splitActionHorizons((analysis?.recommendations as string[]) ?? []);

  const totalLeads = ov.total_leads_all_status ?? 0;
  const winRate = totalLeads && ov.total_won_leads != null ? ((ov.total_won_leads / totalLeads) * 100).toFixed(1) : "—";
  const lossRate = totalLeads && ov.total_lost_leads != null ? ((ov.total_lost_leads / totalLeads) * 100).toFixed(1) : "—";

  return (
    <div className="bai-dashboard-root bai-dashboard-layout" data-theme={theme}>
      <aside className="bai-aside" aria-label="Seções do relatório">
        <div className="bai-aside-brand">Índice</div>
        {NAV.map((n) => (
          <a
            key={n.id}
            href={`#${n.id}`}
            className={`bai-nav-link ${activeNavId === n.id ? "bai-nav-link--active" : ""}`}
          >
            <span className="bai-nav-dot" aria-hidden />
            {n.label}
          </a>
        ))}
      </aside>

      <div className="bai-main">
        <div className="bai-filter-strip">
          <span className="bai-filter-label">Filtros</span>
          <span className="bai-filter-chip">Pipeline</span>
          <span className="bai-filter-chip">Responsável</span>
          <span className="bai-filter-chip">Etapa</span>
          <span className="bai-filter-chip">Período</span>
          <span className="bai-filter-chip">Severidade</span>
          <span className="bai-filter-soon">Em breve · dados já filtrados no Kommo</span>
        </div>

        <DashboardHeader
          productName={productName}
          snapshotLabel={snapshot}
          statusLabel={loading ? "Coletando dados…" : data ? "Snapshot carregado" : "Aguardando dados"}
          loading={loading}
          theme={theme}
          onToggleTheme={toggleTheme}
          onRefresh={onRefresh}
          onAnalyze={onAnalyze}
          onExportPlaceholder={() =>
            window.alert("Exportação dedicada em roadmap. Por ora: Cmd/Ctrl+P → salvar em PDF no navegador.")
          }
        />

        {error && (
          <div className="bai-error-banner" role="alert">
            <strong>Não foi possível carregar o relatório</strong>
            <pre>{error}</pre>
          </div>
        )}

        {!data && !loading && !error && (
          <p className="bai-empty-hint" style={{ marginBottom: "1.5rem" }}>
            Use &quot;Atualizar dados&quot; para gerar o snapshot de auditoria a partir do Kommo.
          </p>
        )}

        {data && (
          <>
            <SectionCard
              id="sec-scoreboard"
              eyebrow="Visão executiva"
              title="Maturidade da operação comercial"
              subtitle="Seis pilares de 0 a 100, calculados sobre este snapshot. Ideais para abrir a reunião com um patamar objetivo — tendência comparativa depende de histórico persistido."
              accent="executive"
            >
              <ExecutiveScoreboard
                scores={execResolved.scores}
                historyAvailable={!!execResolved.meta?.history_trend_available}
                meta={execResolved.meta}
              />
            </SectionCard>

            <SectionCard
              id="sec-resumo-exec"
              eyebrow="Leitura em 60 segundos"
              title="Resumo para o gestor"
              subtitle="Síntese automática a partir dos alertas e recomendações já presentes no relatório. A ordem dos itens é derivada dos dados — não há inferência além da priorização."
              accent="insight"
            >
              <p className="bai-exec-brief-intro">
                Use este bloco como roteiro na conversa com stakeholders: o que está impedindo resultado, onde está o risco,
                onde há ganho rápido e o que priorizar na semana.
              </p>
              <div className="bai-brief-grid">
                <BriefCol title="Principais atritos" items={brief.topProblems} tone="rose" />
                <BriefCol title="Riscos a endereçar" items={brief.topRisks} tone="amber" />
                <BriefCol title="Oportunidades de melhoria" items={brief.opportunities} tone="emerald" />
                <BriefCol
                  title="Prioridades da semana"
                  items={brief.weeklyActions}
                  tone="indigo"
                  empty="Gere o parecer IA para preencher ações sugeridas ou use o diagnóstico nas seções seguintes."
                />
              </div>
            </SectionCard>

            <SectionCard
              id="sec-visao"
              eyebrow="Volume e sintomas"
              title="Panorama do pipeline"
              subtitle="Volume de oportunidades, valores e indicadores de atrito detectados neste snapshot Kommo."
            >
              <div className="bai-metric-grid">
                <Metric label="Oportunidades (total)" value={fmtNum(ov.total_leads_all_status)} />
                <Metric label="Abertas" value={fmtNum(ov.total_active_leads)} />
                <Metric label="Ganhas" value={fmtNum(ov.total_won_leads)} />
                <Metric label="Perdidas" value={fmtNum(ov.total_lost_leads)} />
                <Metric label="Valor em aberto" value={fmtMoney(ov.total_open_pipeline_value)} highlight />
                <Metric label="Valor ganho (snapshot)" value={fmtMoney(fin.won_pipeline_value as number | undefined)} />
                <Metric label="Ticket médio (abertas)" value={fmtMoney(fin.avg_ticket_open as number | undefined)} />
                <Metric label="Ticket médio (ganhas)" value={fmtMoney(fin.avg_ticket_won as number | undefined)} />
                <Metric label="Taxa de ganho" value={winRate === "—" ? "—" : `${winRate}%`} />
                <Metric label="Taxa de perda" value={lossRate === "—" ? "—" : `${lossRate}%`} />
                <Metric label="Sem valor (abertas)" value={fmtNum(ov.open_leads_without_value)} warn={(ov.open_leads_without_value ?? 0) > 0} />
                <Metric label="Sem responsável" value={fmtNum(ov.open_leads_without_owner)} warn={(ov.open_leads_without_owner ?? 0) > 0} />
                <Metric label="Sem origem" value={fmtNum(ov.open_leads_without_source)} warn={(ov.open_leads_without_source ?? 0) > 0} />
                <Metric label="Sem próxima ação" value={fmtNum(samples.counts?.no_next_action_leads)} warn />
                <Metric label="Tarefas vencidas" value={fmtNum(samples.counts?.overdue_tasks)} warn />
                <Metric label="Parados (limiar backend)" value={fmtNum(samples.counts?.stuck_leads)} warn />
                <Metric label="Concentração top 3 deals" value={fmtPct(fin.open_value_concentration_top3_pct as number | undefined, 2)} hint="% do valor aberto nos 3 maiores deals" />
              </div>
            </SectionCard>

            <SectionCard
              id="sec-graficos"
              eyebrow="Análise visual"
              title="Painéis analíticos"
              subtitle="Visualizações interativas: passe o cursor para valores exatos e compare pipelines."
            >
              <DashboardChartsPanel
                ov={ov}
                scores={scores}
                rollups={rollups}
                stageDist={stageDist}
                owners={owners}
                lostTop={lostTop}
                pipes={pipes as never[]}
                engCounts={{ notes: eng.counts?.notes, events: eng.counts?.events, conversations: eng.counts?.conversations }}
                checklistOk={checklist.filter((c) => c.ok).length}
                checklistTotal={checklist.length}
              />
            </SectionCard>

            <SectionCard
              id="sec-funil"
              eyebrow="Funil"
              title="Distribuição e perdas por estágio"
              subtitle="Concentração das oportunidades abertas e volume de perdas registradas por estágio neste snapshot."
            >
              <div className="bai-block-heading">Oportunidades abertas por estágio</div>
              <StageBars rows={stageDist.slice(0, 14)} />
              <div className="bai-block-heading" style={{ marginTop: "1.35rem" }}>
                Perdas por estágio
              </div>
              {stageLoss.length === 0 ? (
                <EmptyHint text="Sem breakdown de perdas por estágio neste snapshot." />
              ) : (
                <StageBarsLoss rows={stageLoss.slice(0, 12)} />
              )}
              <p className="bai-muted-cap" style={{ marginTop: "1rem" }}>
                Tempo médio por etapa e taxa de conversão exigem série temporal de eventos —{" "}
                <strong>não disponível</strong> neste modo snapshot.{" "}
                <a href="#ev-stage_bottlenecks" className="bai-inline-link">
                  Ver concentração por estágio (evidências)
                </a>
              </p>
            </SectionCard>

            <SectionCard
              id="sec-higiene"
              eyebrow="Qualidade de dados"
              title="Higiene do CRM"
              subtitle="Indicadores calculados sobre o snapshot atual. Severidade heurística — detalhes nas tabelas de evidências ao final do relatório."
              accent="risk"
            >
              <HygieneMatrix
                rows={[
                  {
                    label: "Oportunidades abertas sem valor",
                    qty: ov.open_leads_without_value,
                    sev: sevFromCount(ov.open_leads_without_value, ov.total_active_leads),
                    note: evLink("#ev-no_value", "Tabela com nomes e valores."),
                  },
                  {
                    label: "Sem responsável",
                    qty: ov.open_leads_without_owner,
                    sev: sevFromCount(ov.open_leads_without_owner, ov.total_active_leads),
                    note: evLink("#ev-no_owner"),
                  },
                  {
                    label: "Sem origem",
                    qty: ov.open_leads_without_source,
                    sev: sevFromCount(ov.open_leads_without_source, ov.total_active_leads),
                    note: evLink("#ev-no_source"),
                  },
                  {
                    label: "Contatos sem e-mail",
                    qty: dq.contacts_without_email,
                    sev: "medium",
                    note: evLink("#ev-incomplete_contacts", "Incluídos em contatos incompletos."),
                  },
                  {
                    label: "Contatos sem telefone",
                    qty: dq.contacts_without_phone,
                    sev: "medium",
                    note: evLink("#ev-incomplete_contacts", "Incluídos em contatos incompletos."),
                  },
                  {
                    label: "Chaves de e-mail duplicadas",
                    qty: dq.duplicate_email_keys,
                    sev: "high",
                    note: evLink("#ev-duplicate_email_groups", "Grupos por endereço."),
                  },
                  {
                    label: "Perdas sem motivo informado",
                    qty: typeof lossM.lost_without_reason_count === "number" ? lossM.lost_without_reason_count : undefined,
                    sev: "high",
                    note: evLink("#ev-lost_without_reason"),
                  },
                  { label: "CNPJ em empresas", qty: undefined, sev: "na", note: "Campo não mapeado na API atual — não disponível." },
                ]}
              />
            </SectionCard>

            <SectionCard
              id="sec-tarefas"
              eyebrow="Disciplina"
              title="Tarefas e follow-up"
              subtitle="Visão agregada das tarefas sincronizadas — desdobramento por responsável na seção Equipe e nas evidências."
            >
              <div className="bai-metric-grid">
                <Metric label="Tarefas (total)" value={fmtNum(taskM.total as number)} />
                <Metric label="Concluídas" value={fmtNum(taskM.completed as number)} />
                <Metric label="Abertas" value={fmtNum(taskM.open as number)} />
                <Metric label="Vencidas (com data)" value={fmtNum(taskM.overdue as number)} warn />
                <Metric label="Atraso médio (dias)" value={taskM.avg_overdue_days != null ? fmtNum(taskM.avg_overdue_days as number) : "—"} />
              </div>
              <p className="bai-muted-cap" style={{ marginTop: "0.85rem" }}>
                Detalhe por colaborador na seção Equipe.{" "}
                <a href="#ev-overdue_tasks" className="bai-inline-link">
                  Tarefas vencidas
                </a>
                {" · "}
                <a href="#ev-no_next_action" className="bai-inline-link">
                  Sem próxima ação
                </a>
              </p>
            </SectionCard>

            <SectionCard
              id="sec-time"
              eyebrow="Equipe"
              title="Carga operacional por responsável"
              subtitle="Indicadores de carga e atrito no processo — não avaliação individual de desempenho."
            >
              <div className="bai-table-wrap" style={{ overflowX: "auto" }}>
                <table className="bai-table">
                  <thead>
                    <tr>
                      <th>Responsável</th>
                      <th>Abertas</th>
                      <th>Valor aberto</th>
                      <th>Sem ação</th>
                      <th>Parados</th>
                      <th>Tarefas atrasadas</th>
                      <th>Risco operacional*</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ownerOps.slice(0, 25).map((row, i) => (
                      <tr key={i}>
                        <td>{String(row.owner_name)}</td>
                        <td>{fmtNum(row.open_leads as number)}</td>
                        <td>{fmtMoney(row.open_value as number)}</td>
                        <td>{fmtNum(row.no_next_action_open as number)}</td>
                        <td>{fmtNum(row.stuck_open as number)}</td>
                        <td>{fmtNum(row.overdue_tasks as number)}</td>
                        <td>{fmtNum(row.operational_risk_0_100 as number)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="bai-muted-cap" style={{ marginTop: "0.75rem" }}>
                * Índice heurístico do snapshot. Evolução no tempo exige histórico persistido.
              </p>
            </SectionCard>

            <SectionCard
              id="sec-perdas"
              eyebrow="Resultado"
              title="Perdas e motivos"
              subtitle="Distribuição de motivos e valor associado quando disponível no Kommo."
            >
              <div className="bai-metric-grid">
                <Metric label="Total perdidas (snapshot)" value={fmtNum(ov.total_lost_leads)} />
                <Metric label="Taxa de perda" value={lossRate === "—" ? "—" : `${lossRate}%`} />
                <Metric label="Valor perdido (soma price)" value={fmtMoney(fin.lost_pipeline_value as number)} />
                <Metric label="Perdas sem motivo" value={fmtNum(lossM.lost_without_reason_count as number)} warn />
              </div>
              <div className="bai-block-heading">Motivos mais frequentes</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: "var(--pinn-text-secondary)", fontSize: "0.9rem", lineHeight: 1.55 }}>
                {lostTop.slice(0, 10).map((x, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    {String(x.lost_reason ?? "—")}: <strong>{fmtNum(x.cnt)}</strong>
                  </li>
                ))}
              </ul>
              <RecoBox items={["Revisar critérios de qualificação nas etapas iniciais.", "Padronizar motivo de perda no fechamento.", "Instituir win/loss review quinzenal."]} />
            </SectionCard>

            <SectionCard
              id="sec-forecast"
              eyebrow="Valor"
              title="Forecast e confiabilidade"
              subtitle={`Índice de confiança no forecast (scoreboard): ${fmtNum(execResolved.scores?.forecast_0_100)} — baseado em completude de valor, responsável e origem.`}
            >
              <div className="bai-metric-grid">
                <Metric label="Valor aberto total" value={fmtMoney(ov.total_open_pipeline_value)} highlight />
                <Metric label="Confiabilidade (0–100)" value={fmtNum(execResolved.scores?.forecast_0_100)} />
                <Metric label="Abertas sem valor" value={fmtNum(ov.open_leads_without_value)} warn />
                <Metric label="Concentração top 3" value={fmtPct(fin.open_value_concentration_top3_pct as number | undefined, 2)} hint="Risco de forecast concentrado" />
              </div>
              <p className="bai-muted-cap">Detalhes por pipeline e estágio também aparecem nos gráficos acima.</p>
            </SectionCard>

            <SectionCard
              id="sec-inventario"
              eyebrow="Cobertura"
              title="Inventário da sincronização"
              subtitle="Contagens absolutas retornadas pela integração neste snapshot — evidência de cobertura da auditoria."
            >
              <div className="bai-metric-grid">
                {Object.entries(counts).map(([k, v]) => (
                  <Metric key={k} label={k.replace(/_/g, " ")} value={fmtNum(v)} />
                ))}
              </div>
              <EmptyHint text={(enrich.filters_note as string) || ""} />
            </SectionCard>

            <SectionCard
              id="sec-diagnostico"
              eyebrow="Consolidado"
              title="Diagnóstico por dimensão"
              subtitle="Leitura estruturada a partir dos gaps classificados — operações, dados, funil e valor."
              accent="insight"
            >
              <DiagBlock title="Operação" text={diagByDim(gaps, ["execução", "disciplina", "processo"])} />
              <DiagBlock title="Dados" text={diagByDim(gaps, ["higiene", "dados"])} />
              <DiagBlock title="Funil" text={diagByDim(gaps, ["velocidade"])} />
              <DiagBlock title="Forecast & valor" text={diagByDim(gaps, ["forecast", "receita"])} />
            </SectionCard>

            <SectionCard
              id="sec-plano"
              eyebrow="Próximos passos"
              title="Plano de ação sugerido"
              subtitle="Horizontes de 7, 15 e 30 dias a partir do parecer IA, quando existir; caso contrário, use o diagnóstico como backlog."
            >
              <PlanHorizon title="7 dias — prioridade imediata" items={horizons.d7} />
              <PlanHorizon title="15 dias — consolidação" items={horizons.d15} />
              <PlanHorizon title="30 dias — estrutura" items={horizons.d30} />
              {!(Array.isArray(analysis?.recommendations) && analysis.recommendations.length > 0) && (
                <EmptyHint text="Gere o parecer IA para preencher recomendações priorizadas ou trabalhe a partir dos gaps na seção Diagnóstico." />
              )}
            </SectionCard>

            <SectionCard id="sec-parecer" eyebrow="Inteligência" title="Parecer IA" subtitle="Interpretação em linguagem natural sobre o snapshot enviado ao modelo." accent="executive">
              {!analysis ? (
                <EmptyHint text="Clique em Gerar parecer IA para produzir resumo executivo, alertas e plano tático em linguagem natural." />
              ) : (
                <div className="bai-prose-block">
                  <h4>Resumo executivo</h4>
                  <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{String(analysis.executive_summary ?? "")}</p>
                  <h4>Alertas e fragilidades</h4>
                  <ul>
                    {(Array.isArray(analysis.whats_wrong) ? analysis.whats_wrong : []).map((x, i) => (
                      <li key={i}>{String(x)}</li>
                    ))}
                  </ul>
                  <h4>Recomendações</h4>
                  {Array.isArray(analysis.recommendations) && analysis.recommendations.length > 0 ? (
                    <ol>
                      {analysis.recommendations.map((x, i) => (
                        <li key={i}>{String(x)}</li>
                      ))}
                    </ol>
                  ) : (
                    <EmptyHint text="O parecer foi gerado sem lista de recomendações estruturada — verifique o backend ou gere novamente." />
                  )}
                  <p className="bai-muted-cap" style={{ marginTop: "1.25rem" }}>
                    Fonte: {String(analysis.source ?? "")} {analysis.model ? `· ${String(analysis.model)}` : ""}
                  </p>
                </div>
              )}
            </SectionCard>

            <SectionCard
              id="sec-evidencias"
              eyebrow="Auditoria"
              title="Evidências detalhadas"
              subtitle="Registros do snapshot com busca e filtros locais. O total “universo” reflete o CRM completo; a tabela pode estar limitada pelo payload."
              accent="risk"
            >
              {evidencePayload?.meta?.note ? <div className="bai-evidence-meta-note">{evidencePayload.meta.note}</div> : null}
              <div className="bai-evidence-jump-row">
                <span className="bai-evidence-jump-label">Atalhos</span>
                {EVIDENCE_BLOCKS.map((b) => (
                  <a key={b.key} href={`#ev-${b.key}`} className="bai-evidence-jump-link">
                    {b.jumpLabel}
                  </a>
                ))}
              </div>
              {EVIDENCE_BLOCKS.map((b) => (
                <EvidenceDataTable
                  key={b.key}
                  id={`ev-${b.key}`}
                  title={b.title}
                  subtitle={b.subtitle}
                  rows={(evidencePayload?.rows?.[b.key] ?? []) as EvidenceRow[]}
                  universeTotal={evidencePayload?.counts?.[b.key]}
                  rowCap={evidencePayload?.meta?.row_cap}
                  emptyHint={b.emptyHint}
                />
              ))}
            </SectionCard>

            <footer className="bai-footer">BAI CRM Auditor · Kommo via Composio · {apiBase}</footer>
          </>
        )}
      </div>
    </div>
  );
}

function evLink(href: string, hint = "Abrir tabela correspondente."): ReactNode {
  return (
    <span style={{ fontSize: "0.82rem", color: "var(--pinn-text-secondary)" }}>
      <a href={href} className="bai-inline-link">
        Ver evidências
      </a>
      {" · "}
      {hint}
    </span>
  );
}

function diagByDim(gaps: { category?: string; title?: string; detail?: string }[], keys: string[]): string {
  const hits = gaps.filter((g) =>
    keys.some((k) => String(g.category ?? "").toLowerCase().includes(k) || String(g.title ?? "").toLowerCase().includes(k)),
  );
  if (!hits.length) return "Sem alertas classificados nesta dimensão neste snapshot.";
  return hits.slice(0, 5).map((h) => `• ${h.title}: ${h.detail}`).join("\n");
}

function sevFromCount(q?: number, base?: number): "low" | "medium" | "high" | "critical" | "na" {
  if (q == null || base == null || !base) return "na";
  const r = q / base;
  if (r > 0.35) return "critical";
  if (r > 0.18) return "high";
  if (r > 0.06) return "medium";
  return "low";
}

function BriefCol({
  title,
  items,
  tone,
  empty,
}: {
  title: string;
  items: string[];
  tone: "rose" | "amber" | "emerald" | "indigo";
  empty?: string;
}) {
  return (
    <article className="bai-brief-card" data-tone={tone}>
      <h3 className="bai-brief-card-title">{title}</h3>
      {items.filter(Boolean).length === 0 ? (
        <p className="bai-brief-empty">{empty ?? "Sem itens neste recorte."}</p>
      ) : (
        <ul>
          {items.filter(Boolean).map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

function Metric({ label, value, hint, warn, highlight }: { label: string; value: string; hint?: string; warn?: boolean; highlight?: boolean }) {
  const cls = ["bai-metric", warn ? "bai-metric--warn" : "", highlight ? "bai-metric--highlight" : ""].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <div className="bai-metric-label">{label}</div>
      <div className="bai-metric-value">{value}</div>
      {hint ? <div className="bai-metric-hint">{hint}</div> : null}
    </div>
  );
}

function StageBars({ rows }: { rows: { stage_name?: string; lead_count?: number; pct_of_open_pipeline?: number }[] }) {
  return (
    <div className="bai-stage-list">
      {rows.map((s, i) => (
        <div key={i}>
          <div className="bai-stage-row-meta">
            <span style={{ color: "var(--pinn-text-primary)" }}>{s.stage_name}</span>
            <span style={{ color: "var(--pinn-text-secondary)", fontVariantNumeric: "tabular-nums" }}>
              {fmtNum(s.lead_count)} ({fmtPct(s.pct_of_open_pipeline)})
            </span>
          </div>
            <div className="bai-stage-track">
            <div
              className="bai-stage-fill bai-stage-fill--pipeline"
              style={{
                width: `${Math.min(100, s.pct_of_open_pipeline ?? 0)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function StageBarsLoss({ rows }: { rows: { stage_name?: string; lost_count?: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => Number(r.lost_count ?? 0)));
  return (
    <div className="bai-stage-list">
      {rows.map((s, i) => (
        <div key={i}>
          <div className="bai-stage-row-meta">
            <span style={{ color: "var(--pinn-text-primary)" }}>{s.stage_name}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtNum(s.lost_count)}</span>
          </div>
          <div className="bai-stage-track">
            <div
              className="bai-stage-fill bai-stage-fill--loss"
              style={{
                width: `${(Number(s.lost_count ?? 0) / max) * 100}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function hygieneSevPill(sev: string): ReactNode {
  if (sev === "na") return "—";
  const pt: Record<string, string> = {
    critical: "Crítico",
    high: "Alto",
    medium: "Médio",
    low: "Baixo",
  };
  const cls: Record<string, string> = {
    critical: "bai-sev-pill bai-sev-critical",
    high: "bai-sev-pill bai-sev-high",
    medium: "bai-sev-pill bai-sev-medium",
    low: "bai-sev-pill bai-sev-low",
  };
  return <span className={cls[sev] ?? "bai-sev-pill bai-sev-low"}>{pt[sev] ?? sev}</span>;
}

function HygieneMatrix({ rows }: { rows: { label: string; qty?: number; sev: string; note?: ReactNode }[] }) {
  return (
    <div className="bai-table-wrap">
      <table className="bai-table">
        <thead>
          <tr>
            <th>Indicador</th>
            <th>Qtd</th>
            <th>Severidade</th>
            <th>Evidência / nota</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.label}</td>
              <td style={{ fontVariantNumeric: "tabular-nums" }}>{r.qty !== undefined ? fmtNum(r.qty) : "—"}</td>
              <td>{hygieneSevPill(r.sev)}</td>
              <td style={{ fontSize: "0.82rem", color: "var(--pinn-text-secondary)", maxWidth: 280 }}>{r.note ?? <>Ver seção Evidências.</>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecoBox({ items }: { items: string[] }) {
  return (
    <div className="bai-reco-box">
      <h4>Sugestões de processo</h4>
      <ul className="bai-reco-box-list">
        {items.map((x, i) => (
          <li key={i} style={{ marginBottom: 6 }}>
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DiagBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="bai-diag-card">
      <h3>{title}</h3>
      <pre>{text}</pre>
    </div>
  );
}

function PlanHorizon({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="bai-plan-block">
      <h3>{title}</h3>
      <ol>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ol>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="bai-empty-hint">{text}</p>;
}
