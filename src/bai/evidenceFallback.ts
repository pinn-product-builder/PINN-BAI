/**
 * Resolve `evidence_tables` do backend ou fallback controlado a partir de `samples`
 * (compatível com versões antigas da API sem inventar métricas novas).
 */
import type { EvidenceRow } from "@/components/crm-audit/bai/EvidenceDataTable";

export type EvidenceTablesPayload = {
  rows: Record<string, EvidenceRow[]>;
  counts: Record<string, number>;
  meta?: { stuck_threshold_days?: number; row_cap?: number; note?: string };
};

const FALLBACK_NOTE =
  "Backend sem `evidence_tables` completo — exibindo apenas amostras parciais (`samples`). Atualize o servidor e recarregue.";

export function resolveEvidenceTables(data: Record<string, unknown>): EvidenceTablesPayload {
  if (data.evidence_tables != null && typeof data.evidence_tables === "object") {
    return data.evidence_tables as EvidenceTablesPayload;
  }

  const samples = (data.samples ?? {}) as Record<string, unknown>;
  const counts = (samples.counts ?? {}) as Record<string, number>;
  const stuck = (samples.stuck_leads ?? []) as Record<string, unknown>[];
  const noNext = (samples.no_next_action_leads ?? []) as Record<string, unknown>[];
  const overdue = (samples.overdue_tasks ?? []) as Record<string, unknown>[];

  const stuckRows: EvidenceRow[] = stuck.map((x) => {
    const days = typeof x.days_stuck === "number" ? x.days_stuck : Number(x.days_stuck);
    const sev = days >= 21 ? "critical" : days >= 14 ? "high" : days >= 7 ? "medium" : "low";
    return {
      entity_type: "lead",
      external_id: x.external_id,
      name: x.name,
      owner_name: "—",
      pipeline_name: "—",
      stage_name: "—",
      value: null,
      updated_at: null,
      days_stuck: days,
      problem: "Oportunidade parada (amostra — dados incompletos no modo legado)",
      severity: sev,
      recommendation: "Atualize o backend para ver pipeline, etapa e responsável.",
    };
  });

  const noNextRows: EvidenceRow[] = noNext.map((x) => ({
    entity_type: "lead",
    external_id: x.external_id,
    name: x.name,
    owner_name: "—",
    pipeline_name: "—",
    stage_name: "—",
    value: null,
    updated_at: null,
    problem: "Sem tarefa aberta (amostra legada)",
    severity: "high",
    recommendation: "Atualize o backend para linhas enriquecidas ou crie tarefa no Kommo.",
  }));

  const overdueRows: EvidenceRow[] = overdue.map((t) => ({
    entity_type: "task",
    external_id: t.external_id,
    name: String(t.title ?? t.text ?? "(tarefa)"),
    owner_name: "—",
    pipeline_name: "—",
    stage_name: "—",
    value: null,
    updated_at: null,
    problem: "Tarefa vencida (amostra legada)",
    severity: "high",
    recommendation: "Atualize o backend ou trate a fila de tarefas no CRM.",
    lead_external_id: t.lead_external_id,
  }));

  return {
    rows: {
      no_next_action: noNextRows,
      no_owner: [],
      no_value: [],
      no_source: [],
      overdue_tasks: overdueRows,
      stuck_leads: stuckRows,
      lost_without_reason: [],
      incomplete_contacts: [],
      duplicate_email_groups: [],
      stage_bottlenecks: [],
    },
    counts: {
      no_next_action: counts.no_next_action_leads ?? noNextRows.length,
      no_owner: 0,
      no_value: 0,
      no_source: 0,
      overdue_tasks: counts.overdue_tasks ?? overdueRows.length,
      stuck_leads: counts.stuck_leads ?? stuckRows.length,
      lost_without_reason: 0,
      incomplete_contacts: 0,
      duplicate_email_groups: 0,
      stage_bottlenecks: 0,
    },
    meta: {
      note: FALLBACK_NOTE,
      row_cap: 15,
    },
  };
}
