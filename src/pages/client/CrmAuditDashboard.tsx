import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Paper,
  Stack,
  LinearProgress,
  Chip,
  Divider,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Grid,
} from "@mui/material";
import { Refresh, AutoAwesome, CheckCircle, ErrorOutline, WarningAmber } from "@mui/icons-material";
import { useToast } from "@/hooks/use-toast";

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000";

type DashboardPayload = {
  tenant_id: string;
  scores: { crm_data_quality_0_100: number; operation_0_100: number };
  last_sync_at: string | null;
  overview: Record<string, unknown>;
  strengths: Array<{ title: string; detail: string; category: string }>;
  gaps_and_risks: Array<{ title: string; detail: string; severity: string; category: string }>;
  checklist: Array<{ id: string; label: string; ok: boolean; hint: string | null }>;
  samples: {
    stuck_leads: Array<Record<string, unknown>>;
    no_next_action_leads: Array<Record<string, unknown>>;
    overdue_tasks: Array<Record<string, unknown>>;
    counts: Record<string, number | undefined>;
  };
  pipeline_health: Array<Record<string, unknown>>;
  owners: Array<Record<string, unknown>>;
  stage_distribution: Array<Record<string, unknown>>;
  lost_reasons: Array<Record<string, unknown>>;
  extended_catalog?: { sources?: unknown[]; loss_reasons?: unknown[] };
  engagement?: {
    counts: { notes?: number; events?: number; conversations?: number };
    samples: {
      recent_notes: Array<Record<string, unknown>>;
      recent_events: Array<Record<string, unknown>>;
      recent_conversations: Array<Record<string, unknown>>;
    };
  };
  latest_ai_report: { report?: Record<string, unknown>; operation_score?: number } | null;
};

async function fetchDashboard(tenantId: string): Promise<DashboardPayload> {
  const r = await fetch(`${BACKEND}/crm/audit/dashboard?tenant_id=${encodeURIComponent(tenantId)}`);
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || `HTTP ${r.status}`);
  }
  return r.json();
}

const SeverityIcon = ({ s }: { s: string }) => {
  if (s === "high") return <ErrorOutline color="error" fontSize="small" />;
  if (s === "medium") return <WarningAmber color="warning" fontSize="small" />;
  return <WarningAmber color="action" fontSize="small" />;
};

const CrmAuditDashboard = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const tenantId = orgId ?? "";
  const qc = useQueryClient();
  const { toast } = useToast();

  const q = useQuery({
    queryKey: ["crm-audit-dashboard", tenantId],
    queryFn: () => fetchDashboard(tenantId),
    enabled: !!tenantId,
  });

  const syncMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BACKEND}/crm/kommo/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Sincronização concluída", description: "Atualizando painel…" });
      qc.invalidateQueries({ queryKey: ["crm-audit-dashboard", tenantId] });
    },
    onError: (e: Error) => toast({ title: "Erro no sync", description: e.message, variant: "destructive" }),
  });

  const aiMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BACKEND}/crm/analysis/generate?tenant_id=${encodeURIComponent(tenantId)}`, {
        method: "POST",
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Relatório IA gerado" });
      qc.invalidateQueries({ queryKey: ["crm-audit-dashboard", tenantId] });
    },
    onError: (e: Error) => toast({ title: "Erro na IA", description: e.message, variant: "destructive" }),
  });

  if (!tenantId) {
    return <Alert severity="warning">Organização não encontrada na URL.</Alert>;
  }

  if (q.isLoading) {
    return (
      <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (q.isError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {(q.error as Error).message || "Falha ao carregar auditoria. Confira se o backend está no ar e se já houve sync."}
        </Alert>
      </Box>
    );
  }

  const d = q.data!;
  const ov = d.overview as {
    total_active_leads?: number;
    total_won_leads?: number;
    total_lost_leads?: number;
    total_open_pipeline_value?: number;
    total_leads_all_status?: number;
  };

  const dq = d.scores.crm_data_quality_0_100;
  const op = d.scores.operation_0_100;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1600, mx: "auto" }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Auditoria CRM (Kommo)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Visão completa do processo comercial: métricas, riscos, pontos fortes e checklist. Dados via Composio/sync.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={syncMut.isPending ? <CircularProgress size={18} color="inherit" /> : <Refresh />}
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending}
          >
            Sincronizar Kommo
          </Button>
          <Button
            variant="outlined"
            startIcon={aiMut.isPending ? <CircularProgress size={18} /> : <AutoAwesome />}
            onClick={() => aiMut.mutate()}
            disabled={aiMut.isPending}
          >
            Relatório IA
          </Button>
        </Stack>
      </Stack>

      {d.last_sync_at && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
          Último snapshot: {new Date(d.last_sync_at).toLocaleString("pt-BR")}
        </Typography>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Higiene dos dados
            </Typography>
            <Typography variant="h4" fontWeight={700}>
              {dq}
              <Typography component="span" variant="body1" color="text.secondary">
                /100
              </Typography>
            </Typography>
            <LinearProgress variant="determinate" value={dq} sx={{ mt: 1, height: 8, borderRadius: 1 }} color={dq >= 60 ? "success" : "warning"} />
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Operação (tarefas + velocidade)
            </Typography>
            <Typography variant="h4" fontWeight={700}>
              {op}
              <Typography component="span" variant="body1" color="text.secondary">
                /100
              </Typography>
            </Typography>
            <LinearProgress variant="determinate" value={op} sx={{ mt: 1, height: 8, borderRadius: 1 }} color={op >= 60 ? "success" : "warning"} />
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Funil (resumo)
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              <Typography variant="body2">Abertas: <strong>{ov.total_active_leads ?? 0}</strong></Typography>
              <Typography variant="body2">Ganhas: <strong>{ov.total_won_leads ?? 0}</strong> · Perdidas: <strong>{ov.total_lost_leads ?? 0}</strong></Typography>
              <Typography variant="body2">Valor em aberto: <strong>R$ {(ov.total_open_pipeline_value ?? 0).toLocaleString("pt-BR")}</strong></Typography>
              <Typography variant="caption" color="text.secondary">Total sincronizado: {ov.total_leads_all_status ?? 0}</Typography>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: "100%" }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CheckCircle color="success" fontSize="small" /> O que está certo
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1.5}>
              {d.strengths.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Sincronize dados ou melhore métricas para destacar pontos fortes.</Typography>
              ) : (
                d.strengths.map((s, i) => (
                  <Box key={i}>
                    <Typography variant="body2" fontWeight={600}>{s.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{s.detail}</Typography>
                    <Chip label={s.category} size="small" sx={{ mt: 0.5 }} variant="outlined" />
                  </Box>
                ))
              )}
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: "100%" }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ErrorOutline color="error" fontSize="small" /> Riscos e o que corrigir
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1.5}>
              {d.gaps_and_risks.length === 0 ? (
                <Typography variant="body2" color="success.main">Nenhum gap crítico detectado no recorte atual.</Typography>
              ) : (
                d.gaps_and_risks.map((g, i) => (
                  <Box key={i}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <SeverityIcon s={g.severity} />
                      <Typography variant="body2" fontWeight={600}>{g.title}</Typography>
                      <Chip label={g.severity} size="small" color={g.severity === "high" ? "error" : g.severity === "medium" ? "warning" : "default"} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block">{g.detail}</Typography>
                  </Box>
                ))
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Checklist de processo
        </Typography>
        <Grid container spacing={1}>
          {d.checklist.map((c) => (
            <Grid item xs={12} sm={6} md={4} key={c.id}>
              <Stack direction="row" alignItems="flex-start" spacing={1}>
                {c.ok ? <CheckCircle color="success" fontSize="small" /> : <ErrorOutline color="disabled" fontSize="small" />}
                <Box>
                  <Typography variant="body2">{c.label}</Typography>
                  {c.hint && <Typography variant="caption" color="warning.main">{c.hint}</Typography>}
                </Box>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Paper>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>Saúde por etapa / pipeline</Typography>
            <TableContainer sx={{ maxHeight: 320 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Pipeline</TableCell>
                    <TableCell>Etapa</TableCell>
                    <TableCell align="right">Abertas</TableCell>
                    <TableCell align="right">Valor aberto</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(d.pipeline_health ?? []).slice(0, 40).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{String(row.pipeline_name ?? row.pipeline_external_id ?? "—")}</TableCell>
                      <TableCell>{String(row.stage_name ?? row.stage_external_id ?? "—")}</TableCell>
                      <TableCell align="right">{String(row.open_leads ?? 0)}</TableCell>
                      <TableCell align="right">{Number(row.open_pipeline_value ?? 0).toLocaleString("pt-BR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>Performance por responsável</Typography>
            <TableContainer sx={{ maxHeight: 320 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Responsável</TableCell>
                    <TableCell align="right">Abertas</TableCell>
                    <TableCell align="right">Ganhas</TableCell>
                    <TableCell align="right">Valor aberto</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(d.owners ?? []).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{String(row.owner_name ?? row.owner_external_id ?? "—")}</TableCell>
                      <TableCell align="right">{String(row.open_leads ?? 0)}</TableCell>
                      <TableCell align="right">{String(row.won_leads ?? 0)}</TableCell>
                      <TableCell align="right">{Number(row.open_value ?? 0).toLocaleString("pt-BR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>Distribuição no funil (abertas)</Typography>
        <Stack spacing={1}>
          {(d.stage_distribution ?? []).slice(0, 20).map((row, i) => {
            const pct = Number(row.pct_of_open_pipeline ?? 0);
            return (
              <Box key={i}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption">{String(row.stage_name ?? row.stage_external_id)}</Typography>
                  <Typography variant="caption">{String(row.lead_count ?? 0)} · {pct}%</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={Math.min(100, pct)} sx={{ height: 6, borderRadius: 1 }} />
              </Box>
            );
          })}
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>Motivos de perda (top)</Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {(d.lost_reasons ?? []).map((row, i) => (
            <Chip key={i} label={`${String(row.lost_reason ?? "—")}: ${String(row.cnt ?? 0)}`} variant="outlined" />
          ))}
        </Stack>
      </Paper>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Parados (amostra)</Typography>
            <Typography variant="caption" color="text.secondary">{d.samples.counts.stuck_leads ?? 0} no total</Typography>
            <Table size="small">
              <TableBody>
                {d.samples.stuck_leads.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>{String(row.name ?? row.external_id)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Sem próxima tarefa</Typography>
            <Typography variant="caption" color="text.secondary">{d.samples.counts.no_next_action_leads ?? 0} no total</Typography>
            <Table size="small">
              <TableBody>
                {d.samples.no_next_action_leads.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>{String(row.name ?? row.external_id)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Tarefas vencidas (amostra)</Typography>
            <Typography variant="caption" color="text.secondary">{d.samples.counts.overdue_tasks ?? 0} no total</Typography>
            <Table size="small">
              <TableBody>
                {d.samples.overdue_tasks.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>{String(row.title ?? row.external_id)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Engajamento (notas, eventos, conversas)
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
          Preenchido após sincronizar o Kommo. Limite de volume por execução: variável{" "}
          <code>AUDITOR_ENGAGEMENT_MAX_PAGES</code> (páginas de até 250 itens).
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
          <Chip label={`Notas: ${d.engagement?.counts?.notes ?? 0}`} color="primary" variant="outlined" />
          <Chip label={`Eventos: ${d.engagement?.counts?.events ?? 0}`} variant="outlined" />
          <Chip label={`Conversas: ${d.engagement?.counts?.conversations ?? 0}`} variant="outlined" />
        </Stack>
        {!d.engagement?.counts?.notes && !d.engagement?.counts?.events && !d.engagement?.counts?.conversations ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Ainda sem registros de engajamento no banco. Rode &quot;Sincronizar Kommo&quot; após aplicar a migration
            <code> 20260506130000_bai_crm_engagement.sql </code>
            no Supabase.
          </Alert>
        ) : null}
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" gutterBottom>Notas recentes</Typography>
            <Table size="small">
              <TableBody>
                {(d.engagement?.samples?.recent_notes ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">Nenhuma amostra</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  (d.engagement?.samples?.recent_notes ?? []).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Typography variant="caption" display="block" color="text.secondary">
                          {String(row.scope_entity_type ?? "")} #{String(row.entity_external_id ?? "—")}
                        </Typography>
                        <Typography variant="body2" sx={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {String(row.content_preview ?? "").slice(0, 120)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" gutterBottom>Eventos recentes</Typography>
            <Table size="small">
              <TableBody>
                {(d.engagement?.samples?.recent_events ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">Nenhuma amostra</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  (d.engagement?.samples?.recent_events ?? []).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Typography variant="caption" display="block">
                          {String(row.event_type ?? "—")} · {String(row.entity_type ?? "")} #{String(row.entity_external_id ?? "")}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" gutterBottom>Conversas recentes</Typography>
            <Table size="small">
              <TableBody>
                {(d.engagement?.samples?.recent_conversations ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">Nenhuma amostra</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  (d.engagement?.samples?.recent_conversations ?? []).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Typography variant="caption" display="block">
                          contato #{String(row.contact_external_id ?? "—")} · {String(row.status ?? "")}
                        </Typography>
                        <Typography variant="body2" sx={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {String(row.last_message_preview ?? "").slice(0, 100)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Grid>
        </Grid>
      </Paper>

      {(d.extended_catalog?.sources?.length || d.extended_catalog?.loss_reasons?.length) ? (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>Catálogo Kommo (fontes / motivos de perda)</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Preenchido após sync via Composio/API.
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Chip label={`Fontes: ${d.extended_catalog?.sources?.length ?? 0}`} />
            <Chip label={`Motivos perda: ${d.extended_catalog?.loss_reasons?.length ?? 0}`} />
          </Stack>
        </Paper>
      ) : null}

      {d.latest_ai_report?.report && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>Último parecer IA</Typography>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {String((d.latest_ai_report.report as { executive_summary?: string }).executive_summary ?? JSON.stringify(d.latest_ai_report.report, null, 2))}
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default CrmAuditDashboard;
