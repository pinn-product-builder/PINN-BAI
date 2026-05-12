/**
 * CRM Audit Dashboard — Pinn BAI
 * Identidade visual Pinn BAI (MUI + orange #F97316) + dados completos da auditoria Kommo.
 */
import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Card, CardContent, Chip, CircularProgress, Divider,
  Grid, IconButton, Stack, Tab, Table, TableBody, TableCell,
  TableHead, TableRow, Tabs, Tooltip as MuiTooltip, Typography,
  Alert, Button, InputAdornment, TextField, Select, MenuItem,
  LinearProgress, Collapse,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  AutoAwesome as AIIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Search as SearchIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as OkIcon,
  Error as ErrorIcon,
} from "@mui/icons-material";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { resolveExecutiveScoreboard } from "@/bai/executiveScores";
import { resolveEvidenceTables } from "@/bai/evidenceFallback";
import { buildExecutiveBrief, splitActionHorizons, fmtMoney, fmtNum, fmtPct, tierFromScore, tierLabelPt } from "@/bai/helpers";
import { isDemoOrg } from "@/lib/featureFlags";
import { DEMO_CRM_AUDIT_DASHBOARD } from "@/data/arguto-extra-demo";

// ─── Config ───────────────────────────────────────────────────────────────────
const BACKEND = import.meta.env.VITE_BACKEND_URL ?? "https://bai.srv879715.hstgr.cloud";

const ORANGE = "#F97316";
const ORANGE_SOFT = "rgba(249,115,22,0.10)";
const ORANGE_BORDER = "rgba(249,115,22,0.28)";

const CHART_COLORS = {
  orange: ORANGE,
  amber: "#F59E0B",
  green: "#22C55E",
  red: "#EF4444",
  blue: "#3B82F6",
  muted: "#6B7280",
};

const TOOLTIP_STYLE = {
  backgroundColor: "#1C1917",
  border: `1px solid rgba(255,255,255,0.12)`,
  borderRadius: 8,
  color: "#F4F1EC",
  fontSize: 12,
};

// ─── Data fetch ───────────────────────────────────────────────────────────────
async function fetchDashboard(tenantId: string) {
  // Modo demo (Arguto): retorna snapshot pré-curado sem chamar o backend.
  if (isDemoOrg(tenantId)) return DEMO_CRM_AUDIT_DASHBOARD;
  const r = await fetch(`${BACKEND}/crm/audit/dashboard?tenant_id=${encodeURIComponent(tenantId)}`);
  if (!r.ok) throw new Error(`Erro ${r.status}: ${await r.text()}`);
  return r.json();
}

// ─── Severity helpers ─────────────────────────────────────────────────────────
function SeverityChip({ sev }: { sev: string }) {
  const map: Record<string, { label: string; color: "error" | "warning" | "default" | "success" }> = {
    critical: { label: "Crítico", color: "error" },
    high: { label: "Alto", color: "warning" },
    medium: { label: "Médio", color: "default" },
    low: { label: "Baixo", color: "success" },
    na: { label: "N/A", color: "default" },
  };
  const cfg = map[sev] ?? { label: sev, color: "default" };
  return <Chip label={cfg.label} color={cfg.color} size="small" sx={{ fontSize: "0.65rem", fontWeight: 700 }} />;
}

function TierChip({ score }: { score: number }) {
  const tier = tierFromScore(score);
  const label = tierLabelPt(tier);
  const colorMap: Record<string, string> = {
    critical: "#EF4444",
    warning: "#F59E0B",
    healthy: "#22C55E",
    excellent: ORANGE,
  };
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.06em",
        bgcolor: `${colorMap[tier]}18`,
        color: colorMap[tier],
        border: `1px solid ${colorMap[tier]}44`,
      }}
    />
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, subtitle, accent, children, id }: {
  title: string; subtitle?: string; accent?: boolean; children: React.ReactNode; id?: string;
}) {
  return (
    <Card
      id={id}
      variant="outlined"
      sx={{
        mb: 2,
        borderColor: accent ? ORANGE_BORDER : "divider",
        borderRadius: "12px",
        boxShadow: accent ? `0 0 0 1px ${ORANGE_BORDER}, 0 4px 24px rgba(249,115,22,0.06)` : "none",
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{
            width: 32, height: 3, borderRadius: 999, mb: 1.5,
            background: accent ? `linear-gradient(90deg, ${ORANGE}, #FB923C)` : "linear-gradient(90deg, #6B7280, #9CA3AF)",
          }} />
          <Typography variant="h6" fontWeight={700} letterSpacing="-0.025em" lineHeight={1.25}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: "60ch", lineHeight: 1.55 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

// ─── Metric card ─────────────────────────────────────────────────────────────
function MetricCard({ label, value, warn, highlight, hint }: {
  label: string; value: string; warn?: boolean; highlight?: boolean; hint?: string;
}) {
  return (
    <Box sx={{
      position: "relative",
      p: 2,
      borderRadius: "12px",
      border: "1px solid",
      borderColor: highlight ? ORANGE_BORDER : warn ? "rgba(239,68,68,0.28)" : "divider",
      background: highlight
        ? `linear-gradient(135deg, ${ORANGE_SOFT}, rgba(251,146,60,0.04))`
        : warn
          ? "linear-gradient(135deg, rgba(239,68,68,0.07), rgba(239,68,68,0.015))"
          : "linear-gradient(135deg, rgba(0,0,0,0.025), rgba(0,0,0,0.005))",
      minHeight: 92,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      transition: "transform 0.18s ease, box-shadow 0.18s ease",
      overflow: "hidden",
      "&:hover": { transform: "translateY(-2px)", boxShadow: highlight ? `0 8px 24px rgba(249,115,22,0.14)` : "0 6px 16px rgba(0,0,0,0.06)" },
      "&::before": highlight ? {
        content: '""', position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${ORANGE}, #FB923C)`,
      } : warn ? {
        content: '""', position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: "linear-gradient(90deg, #EF4444, #F87171)",
      } : undefined,
    }}>
      <Typography variant="caption" sx={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "text.secondary" }}>
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={800} letterSpacing="-0.03em" sx={{ mt: 0.75, lineHeight: 1.1, color: highlight ? ORANGE : warn ? "error.main" : "text.primary", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" sx={{ fontSize: "0.65rem", color: "text.secondary", mt: 0.25 }}>{hint}</Typography>
      )}
    </Box>
  );
}

// ─── Chart card wrapper ──────────────────────────────────────────────────────
function ChartCard({ title, subtitle, accent, height = 280, children }: {
  title: string; subtitle?: string; accent?: boolean; height?: number; children: React.ReactNode;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: "14px",
        borderColor: "divider",
        height: "100%",
        background: "linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0))",
        transition: "box-shadow 0.2s ease",
        "&:hover": { boxShadow: "0 10px 30px rgba(0,0,0,0.06)" },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ mb: 1.5 }}>
          <Box sx={{
            width: 28, height: 3, borderRadius: 999, mb: 1,
            background: accent ? `linear-gradient(90deg, ${ORANGE}, #FB923C)` : "linear-gradient(90deg, #9CA3AF, #D1D5DB)",
          }} />
          <Typography variant="subtitle2" fontWeight={700} letterSpacing="-0.01em">{title}</Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, lineHeight: 1.4 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box sx={{ height, mt: 1 }}>
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
}

// ─── Group label ─────────────────────────────────────────────────────────────
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.75, mt: 0.5 }}>
      <Box sx={{ width: 4, height: 18, borderRadius: 999, background: `linear-gradient(180deg, ${ORANGE}, #FB923C)` }} />
      <Typography variant="caption" sx={{ fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "text.secondary" }}>
        {children}
      </Typography>
    </Stack>
  );
}

// ─── Pillar score card ────────────────────────────────────────────────────────
function PillarCard({ title, hint, score }: { title: string; hint: string; score: number }) {
  const tier = tierFromScore(score);
  const barColor: Record<string, string> = {
    critical: "#EF4444", warning: "#F59E0B", healthy: "#22C55E", excellent: ORANGE,
  };
  return (
    <Card variant="outlined" sx={{ borderRadius: "10px", borderColor: "divider", height: "100%" }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ height: 3, borderRadius: 999, mb: 1.5, background: `linear-gradient(90deg, ${ORANGE}, #FB923C)`, opacity: 0.8 }} />
        <Typography variant="caption" sx={{ fontSize: "0.63rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "text.secondary" }}>
          {title}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.75, mb: 0.75 }}>
          <Typography variant="h4" fontWeight={800} letterSpacing="-0.04em" sx={{ color: ORANGE }}>
            {fmtNum(score)}
          </Typography>
          <TierChip score={score} />
        </Stack>
        <LinearProgress
          variant="determinate"
          value={Math.min(100, score)}
          sx={{
            height: 4, borderRadius: 999, mb: 1,
            bgcolor: "rgba(0,0,0,0.06)",
            "& .MuiLinearProgress-bar": { background: barColor[tier], borderRadius: 999 },
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem", lineHeight: 1.45 }}>
          {hint}
        </Typography>
      </CardContent>
    </Card>
  );
}

// ─── Stage bar ────────────────────────────────────────────────────────────────
function StageBar({ name, count, pct, color = ORANGE }: { name: string; count: number; pct: number; color?: string }) {
  return (
    <Box sx={{ mb: 1.25 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="body2" fontSize="0.82rem" noWrap sx={{ maxWidth: "65%" }}>{name}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
          {fmtNum(count)} ({fmtPct(pct)})
        </Typography>
      </Stack>
      <Box sx={{ height: 6, borderRadius: 999, bgcolor: "action.hover", overflow: "hidden" }}>
        <Box sx={{ height: "100%", width: `${Math.min(100, pct)}%`, borderRadius: 999, background: `linear-gradient(90deg, ${color}, ${color}cc)`, transition: "width 0.4s" }} />
      </Box>
    </Box>
  );
}

// ─── Evidence table ───────────────────────────────────────────────────────────
function EvidenceBlock({ id, title, subtitle, rows, universeTotal, emptyHint }: {
  id: string; title: string; subtitle: string; rows: Record<string, unknown>[]; universeTotal?: number; emptyHint: string;
}) {
  const [search, setSearch] = useState("");
  const [sev, setSev] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(8);

  const filtered = useMemo(() => rows.filter(r => {
    if (sev && r.severity !== sev) return false;
    if (search) {
      const q = search.toLowerCase();
      return [r.name, r.owner_name, r.pipeline_name, r.stage_name, r.problem, r.external_id]
        .some(v => String(v ?? "").toLowerCase().includes(q));
    }
    return true;
  }), [rows, sev, search]);

  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  if (rows.length === 0 && !expanded) {
    return (
      <Box id={id} sx={{ mb: 2, p: 2, borderRadius: "10px", border: "1px dashed", borderColor: "divider" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="subtitle2" fontWeight={600}>{title}</Typography>
            <Typography variant="caption" color="text.secondary">{emptyHint}</Typography>
          </Box>
          <Chip label="OK" color="success" size="small" icon={<OkIcon sx={{ fontSize: 14 }} />} />
        </Stack>
      </Box>
    );
  }

  return (
    <Box id={id} sx={{ mb: 2.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25, cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
            {universeTotal != null && (
              <Chip label={fmtNum(universeTotal)} size="small" sx={{ fontSize: "0.7rem", bgcolor: ORANGE_SOFT, color: ORANGE }} />
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
        </Box>
        <IconButton size="small">{expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
      </Stack>

      <Collapse in={expanded || rows.length > 0}>
        {rows.length === 0 ? (
          <Alert severity="success" sx={{ borderRadius: "8px" }}>{emptyHint}</Alert>
        ) : (
          <>
            <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: "wrap", gap: 1 }}>
              <TextField
                size="small" placeholder="Buscar…" value={search} onChange={e => { setSearch(e.target.value); setVisible(8); }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16 }} /></InputAdornment> }}
                sx={{ minWidth: 200, flex: 1 }}
              />
              <Select size="small" value={sev} onChange={e => { setSev(e.target.value); setVisible(8); }} displayEmpty sx={{ minWidth: 160 }}>
                <MenuItem value="">Todas severidades</MenuItem>
                {["critical", "high", "medium", "low"].map(s => <MenuItem key={s} value={s}>{s === "critical" ? "Crítico" : s === "high" ? "Alto" : s === "medium" ? "Médio" : "Baixo"}</MenuItem>)}
              </Select>
            </Stack>
            <Box sx={{ overflowX: "auto", borderRadius: "10px", border: "1px solid", borderColor: "divider" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    {["Entidade", "Responsável", "Pipeline / Etapa", "Valor", "Prazo", "Diagnóstico", "Sev.", "Ação"].map(h => (
                      <TableCell key={h} sx={{ fontSize: "0.63rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary", py: 1, whiteSpace: "nowrap" }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shown.map((r, i) => (
                    <TableRow key={i} hover sx={{ "&:last-child td": { border: 0 } }}>
                      <TableCell sx={{ py: 1.25 }}>
                        <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>{String(r.name ?? "—")}</Typography>
                        <Typography variant="caption" color="text.secondary">{String(r.entity_type ?? "")} {r.external_id ? `· #${String(r.external_id)}` : ""}</Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1.25, fontSize: "0.8rem" }}>{String(r.owner_name ?? "—")}</TableCell>
                      <TableCell sx={{ py: 1.25 }}>
                        <Typography variant="caption" display="block">{String(r.pipeline_name ?? "—")}</Typography>
                        <Typography variant="caption" color="text.secondary">{String(r.stage_name ?? "—")}</Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1.25, fontSize: "0.8rem", fontVariantNumeric: "tabular-nums" }}>
                        {r.value != null && !Number.isNaN(Number(r.value)) ? fmtMoney(Number(r.value)) : "—"}
                      </TableCell>
                      <TableCell sx={{ py: 1.25, fontSize: "0.75rem", color: "text.secondary", whiteSpace: "nowrap" }}>
                        {r.days_stuck != null ? `${fmtNum(Number(r.days_stuck))}d parado` : r.days_overdue != null ? `${fmtNum(Number(r.days_overdue))}d atraso` : String(r.updated_at ?? "—").slice(0, 16)}
                      </TableCell>
                      <TableCell sx={{ py: 1.25, fontSize: "0.75rem", color: "text.secondary", maxWidth: 200 }}>{String(r.problem ?? "—")}</TableCell>
                      <TableCell sx={{ py: 1.25 }}><SeverityChip sev={String(r.severity ?? "low")} /></TableCell>
                      <TableCell sx={{ py: 1.25, fontSize: "0.72rem", color: "text.secondary", maxWidth: 200, lineHeight: 1.4 }}>{String(r.recommendation ?? "—")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1, px: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Mostrando {shown.length} de {filtered.length}{filtered.length !== rows.length ? ` (filtrado de ${rows.length})` : ""}
                {universeTotal != null ? ` · universo: ${fmtNum(universeTotal)}` : ""}
              </Typography>
              {hasMore && (
                <Button size="small" onClick={() => setVisible(v => v + 12)} sx={{ color: ORANGE, fontSize: "0.78rem" }}>
                  Carregar mais
                </Button>
              )}
            </Stack>
          </>
        )}
      </Collapse>
    </Box>
  );
}

// ─── Evidence blocks config ───────────────────────────────────────────────────
const EVIDENCE_BLOCKS = [
  { key: "no_next_action", title: "Sem próxima ação", subtitle: "Abertas sem nenhuma tarefa pendente no Kommo.", emptyHint: "Todas as oportunidades têm próxima ação definida." },
  { key: "no_owner", title: "Sem responsável", subtitle: "Abertas sem usuário responsável atribuído.", emptyHint: "Todas as abertas têm responsável." },
  { key: "no_value", title: "Sem valor (forecast)", subtitle: "Abertas com valor zerado — forecast incompleto.", emptyHint: "Sem oportunidades com valor zerado." },
  { key: "no_source", title: "Sem origem", subtitle: "Abertas sem canal/campanha de origem.", emptyHint: "Origem preenchida nas abertas." },
  { key: "overdue_tasks", title: "Tarefas vencidas", subtitle: "Tarefas em aberto com data de conclusão no passado.", emptyHint: "Nenhuma tarefa vencida pendente." },
  { key: "stuck_leads", title: "Leads parados", subtitle: "Abertas sem atualização acima do limiar configurado.", emptyHint: "Nenhuma oportunidade parada." },
  { key: "lost_without_reason", title: "Perdas sem motivo", subtitle: "Perdidas sem motivo de perda informado.", emptyHint: "Todas as perdas têm motivo registrado." },
  { key: "incomplete_contacts", title: "Contatos incompletos", subtitle: "Contatos sem e-mail ou telefone.", emptyHint: "Todos os contatos têm dados de contato." },
  { key: "duplicate_email_groups", title: "E-mails duplicados", subtitle: "Contatos que compartilham o mesmo endereço de e-mail.", emptyHint: "Nenhum e-mail duplicado encontrado." },
  { key: "stage_bottlenecks", title: "Gargalos por etapa", subtitle: "Estágios com maior concentração de oportunidades abertas.", emptyHint: "Sem concentração anormal por estágio." },
] as const;

// ─── Main component ───────────────────────────────────────────────────────────
export default function CrmAuditDashboard() {
  const { orgId } = useParams<{ orgId: string }>();
  const tenantId = orgId ?? "";
  const [tab, setTab] = useState(0);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ["crm-audit-dashboard", tenantId],
    queryFn: () => fetchDashboard(tenantId),
    enabled: !!tenantId,
    staleTime: 60_000,
    retry: 1,
  });

  // Pre-populate analysis from latest_ai_report when data loads
  useEffect(() => {
    if (data?.latest_ai_report?.report && !analysis) {
      setAnalysis(data.latest_ai_report.report as Record<string, unknown>);
    }
  }, [data, analysis]);

  const handleRefresh = useCallback(async () => {
    setSyncing(true);
    try {
      await fetch(`${BACKEND}/crm/kommo/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
    } finally {
      setSyncing(false);
    }
    refetch();
  }, [tenantId, refetch]);

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    try {
      const r = await fetch(`${BACKEND}/crm/analysis/generate?tenant_id=${encodeURIComponent(tenantId)}`, { method: "POST" });
      if (r.ok) setAnalysis(await r.json());
    } finally {
      setAnalyzing(false);
    }
  }, [tenantId]);

  // ── Data extraction ──
  const loading = isFetching || syncing || analyzing;
  const ov = (data?.overview ?? {}) as Record<string, number | undefined>;
  const scores = (data?.scores ?? {}) as Record<string, number | undefined>;
  const execResolved = data ? resolveExecutiveScoreboard(data) : { scores: {} as Record<string, number>, meta: {} as Record<string, unknown> };
  // data_quality_breakdown (new) or data_quality (legacy)
  const dqRaw = (data?.data_quality_breakdown ?? data?.data_quality ?? {}) as Record<string, unknown>;
  const dq: Record<string, number | undefined> = {
    contacts_without_email: dqRaw.contacts_without_email as number,
    contacts_without_phone: dqRaw.contacts_without_phone as number,
    duplicate_email_keys: dqRaw.duplicate_email_keys as number,
  };
  const gaps = (data?.gaps_and_risks ?? []) as { category?: string; title?: string; detail?: string; severity?: string }[];
  const strengths = (data?.strengths ?? []) as { title?: string; detail?: string }[];
  const samples = (data?.samples ?? {}) as { counts?: Record<string, number>; stuck_leads?: unknown[]; no_next_action_leads?: unknown[]; overdue_tasks?: unknown[] };
  const stageDist = (data?.stage_distribution ?? []) as { stage_name?: string; lead_count?: number; pct_of_open_pipeline?: number }[];
  // lost_reasons may be raw IDs — resolve names from extended_catalog
  const lossReasonMap = new Map<string, string>(
    ((data?.extended_catalog as Record<string, unknown>)?.loss_reasons as { id: number; name: string }[] ?? []).map(r => [String(r.id), r.name])
  );
  const lostTop = ((data?.lost_reasons ?? data?.lost_reasons_top ?? []) as { lost_reason?: string; cnt?: number }[])
    .map(r => ({ ...r, lost_reason: lossReasonMap.get(r.lost_reason ?? "") ?? r.lost_reason }));
  const owners = (data?.owners ?? []) as Record<string, unknown>[];
  // owner_operational: try audit_enrichment first, else build from owners list
  const enrich = (data?.audit_enrichment ?? {}) as Record<string, unknown>;
  const ownerOps: Record<string, unknown>[] = (enrich.owner_operational as Record<string, unknown>[] | undefined)
    ?? owners.map(o => ({
      owner_name: o.owner_name,
      open_leads: o.open_leads,
      open_value: o.open_value,
      no_next_action_open: null,
      stuck_open: null,
      overdue_tasks: null,
      operational_risk_0_100: null,
    }));
  // task_metrics: derive from samples.counts if not in enrichment
  const taskM: Record<string, unknown> = (enrich.task_metrics as Record<string, unknown>) ?? {
    total: (data?.sync_stats as Record<string, number>)?.tasks,
    open: samples.counts?.overdue_tasks != null ? undefined : undefined,
    completed: undefined,
    overdue: samples.counts?.overdue_tasks,
    avg_overdue_days: undefined,
  };
  // financial_snapshot: build from overview totals
  const fin: Record<string, unknown> = (enrich.financial_snapshot as Record<string, unknown>) ?? {
    won_pipeline_value: undefined,
    lost_pipeline_value: undefined,
    avg_ticket_open: ov.total_open_pipeline_value && ov.total_active_leads ? Math.round(Number(ov.total_open_pipeline_value) / Number(ov.total_active_leads)) : undefined,
    open_value_concentration_top3_pct: undefined,
  };
  // loss_metrics: derive from lost_reasons
  const totalLostWithReason = lostTop.filter(r => r.lost_reason !== "(não informado)").reduce((s, r) => s + Number(r.cnt ?? 0), 0);
  const totalLostWithoutReason = lostTop.find(r => r.lost_reason === "(não informado)")?.cnt ?? 0;
  const lossM: Record<string, unknown> = (enrich.loss_metrics as Record<string, unknown>) ?? {
    lost_without_reason_count: totalLostWithoutReason,
    total_lost: ov.total_lost_leads,
  };
  // stage_loss_breakdown: derive from pipeline_health rows
  const pipelineHealth = (data?.pipeline_health ?? []) as { stage_name?: string; lost_leads?: number; open_leads?: number; open_pipeline_value?: number }[];
  const stageLoss = (enrich.stage_loss_breakdown as { stage_name?: string; lost_count?: number }[] | undefined)
    ?? pipelineHealth.filter(r => (r.lost_leads ?? 0) > 0).map(r => ({ stage_name: r.stage_name, lost_count: r.lost_leads }));
  const eng = (data?.engagement ?? {}) as { counts?: Record<string, number> };
  const evidencePayload = data ? resolveEvidenceTables(data) : null;
  // analysis field aliases — API uses recommendations_next_7_days + main_bottlenecks
  const analysisRecs = (analysis?.recommendations_next_7_days ?? analysis?.recommendations ?? []) as string[];
  const analysisRisks = [
    ...((analysis?.commercial_risks ?? []) as { title?: string; detail?: string }[]).map(r => r.title ?? ""),
    ...((analysis?.crm_hygiene_issues ?? []) as { title?: string; detail?: string }[]).map(r => r.title ?? ""),
  ].filter(Boolean);
  const brief = buildExecutiveBrief({ gaps, strengths, analysisRisks, recommendations: analysisRecs });
  const horizons = splitActionHorizons(analysisRecs);

  const totalLeads = ov.total_leads_all_status ?? 0;
  const winRate = totalLeads && ov.total_won_leads != null ? ((ov.total_won_leads / totalLeads) * 100).toFixed(1) : null;
  const lossRate = totalLeads && ov.total_lost_leads != null ? ((ov.total_lost_leads / totalLeads) * 100).toFixed(1) : null;

  // Charts data
  const pieData = [
    { name: "Abertas", value: ov.total_active_leads ?? 0, fill: ORANGE },
    { name: "Ganhas", value: ov.total_won_leads ?? 0, fill: CHART_COLORS.green },
    { name: "Perdidas", value: ov.total_lost_leads ?? 0, fill: CHART_COLORS.muted },
  ].filter(x => x.value > 0);

  const scoreBarData = [
    { nome: "Higiene", valor: Math.min(100, scores.crm_data_quality_0_100 ?? 0) },
    { nome: "Operação", valor: Math.min(100, scores.operation_0_100 ?? 0) },
  ];

  const stagesChartData = stageDist.slice(0, 12).map(s => ({
    nome: String(s.stage_name ?? "—").slice(0, 24),
    abertas: Number(s.lead_count ?? 0),
  }));

  const ownersChartData = [...owners]
    .sort((a, b) => Number(b.open_value ?? 0) - Number(a.open_value ?? 0))
    .slice(0, 10)
    .map(o => ({ nome: String(o.owner_name ?? "—").slice(0, 20), valor: Number(o.open_value ?? 0) }));

  const lostChartData = lostTop.slice(0, 8).map(x => ({
    nome: String(x.lost_reason ?? "—").slice(0, 28),
    qtd: Number(x.cnt ?? 0),
  }));

  const lastSync = data?.last_sync_at ? new Date(data.last_sync_at as string).toLocaleString("pt-BR") : null;

  const PILLARS = [
    { key: "general_0_100", title: "Operação geral", hint: "Síntese dos 6 pilares neste snapshot." },
    { key: "hygiene_0_100", title: "Higiene do CRM", hint: "Qualidade de cadastro, duplicidade e campos críticos." },
    { key: "discipline_0_100", title: "Disciplina comercial", hint: "Execução de tarefas, follow-up e ritmo de atualização." },
    { key: "risk_commercial_0_100", title: "Risco comercial", hint: "Atrito operacional e concentração de valor." },
    { key: "forecast_0_100", title: "Forecast", hint: "Completude de valor, responsável e origem." },
    { key: "engagement_0_100", title: "Engajamento", hint: "Volume de notas, eventos e conversas registrados." },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Box sx={{ flex: 1, minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Header */}
      <Box sx={{
        position: "sticky", top: 0, zIndex: 10,
        px: 3, py: 2, borderBottom: "1px solid", borderColor: "divider",
        bgcolor: "background.default",
        backdropFilter: "blur(12px)",
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: ORANGE }}>
              Auditoria comercial · BAI
            </Typography>
            <Typography variant="h5" fontWeight={800} letterSpacing="-0.03em" sx={{ mt: 0.25, fontFamily: "Poppins, sans-serif" }}>
              Auditor — CRM
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
              <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: loading ? CHART_COLORS.amber : CHART_COLORS.green, boxShadow: loading ? `0 0 10px ${CHART_COLORS.amber}88` : `0 0 8px ${CHART_COLORS.green}88` }} />
              <Typography variant="caption" color="text.secondary">
                {loading ? "Processando…" : data ? `Snapshot carregado${lastSync ? ` · ${lastSync}` : ""}` : "Aguardando dados"}
              </Typography>
            </Stack>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button
              variant="outlined" size="small" startIcon={<RefreshIcon />}
              onClick={handleRefresh} disabled={loading}
              sx={{ borderColor: "divider", color: "text.secondary", fontWeight: 600, textTransform: "none", fontSize: "0.8rem" }}
            >
              {syncing ? "Sincronizando…" : "Atualizar dados"}
            </Button>
            <Button
              variant="contained" size="small" startIcon={<AIIcon />}
              onClick={handleAnalyze} disabled={loading}
              sx={{ background: `linear-gradient(135deg, ${ORANGE}, #EA580C)`, fontWeight: 600, textTransform: "none", fontSize: "0.8rem", boxShadow: "0 4px 12px rgba(249,115,22,0.3)" }}
            >
              {analyzing ? "Gerando…" : "Gerar parecer IA"}
            </Button>
          </Stack>
        </Stack>

        {/* Tabs nav */}
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mt: 1.5, minHeight: 36, "& .MuiTab-root": { minHeight: 36, fontSize: "0.8rem", fontWeight: 500, textTransform: "none", py: 0.75 }, "& .Mui-selected": { fontWeight: 700, color: ORANGE }, "& .MuiTabs-indicator": { bgcolor: ORANGE, height: 2 } }}>
          {["Scoreboard", "Operação", "Gráficos", "Funil", "Higiene", "Tarefas", "Equipe", "Perdas", "Forecast", "Evidências", "Parecer IA"].map((t, i) => (
            <Tab key={t} label={t} value={i} />
          ))}
        </Tabs>
      </Box>

      {/* Content */}
      <Box sx={{ px: 3, py: 3, maxWidth: 1280, mx: "auto" }}>
        {/* Loading */}
        {loading && !data && (
          <Stack alignItems="center" spacing={2} sx={{ py: 10 }}>
            <CircularProgress sx={{ color: ORANGE }} size={40} />
            <Typography color="text.secondary" variant="body2">Carregando auditoria…</Typography>
          </Stack>
        )}

        {/* Error */}
        {error && !data && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: "10px" }}>
            <strong>Erro ao carregar relatório</strong><br />
            <Typography variant="caption">{String((error as Error).message)}</Typography>
          </Alert>
        )}

        {/* Empty state */}
        {!data && !loading && !error && (
          <Stack alignItems="center" spacing={2} sx={{ py: 10 }}>
            <Typography color="text.secondary">Clique em <strong>Atualizar dados</strong> para gerar o snapshot da auditoria.</Typography>
          </Stack>
        )}

        {data && (
          <>
            {/* ── Tab 0: Scoreboard ── */}
            {tab === 0 && (
              <Section id="scoreboard" title="Maturidade da operação comercial" subtitle="Seis pilares calculados sobre este snapshot. Acompanhe a evolução histórica para tendências comparativas." accent>
                <Grid container spacing={2}>
                  {PILLARS.map(p => (
                    <Grid item xs={12} sm={6} md={4} key={p.key}>
                      <PillarCard title={p.title} hint={p.hint} score={execResolved.scores?.[p.key] ?? 0} />
                    </Grid>
                  ))}
                </Grid>
                {execResolved.meta?.fallback_legacy_scores && (
                  <Alert severity="info" sx={{ mt: 2, borderRadius: "8px", fontSize: "0.8rem" }}>
                    Scores calculados a partir de métricas legadas. Atualize o backend para os 6 pilares completos.
                  </Alert>
                )}

                {/* Resumo executivo */}
                <Divider sx={{ my: 3 }} />
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Resumo para o gestor</Typography>
                <Grid container spacing={2}>
                  {[
                    { title: "Principais atritos", items: brief.topProblems, color: "#EF4444" },
                    { title: "Riscos a endereçar", items: brief.topRisks, color: CHART_COLORS.amber },
                    { title: "Pontos fortes", items: brief.opportunities, color: CHART_COLORS.green },
                    { title: "Prioridades da semana", items: brief.weeklyActions, color: ORANGE },
                  ].map(col => (
                    <Grid item xs={12} sm={6} md={3} key={col.title}>
                      <Box sx={{ p: 2, borderRadius: "10px", border: "1px solid", borderColor: "divider", bgcolor: "action.hover", height: "100%", borderLeft: `3px solid ${col.color}` }}>
                        <Typography variant="caption" sx={{ fontSize: "0.63rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "text.secondary", display: "block", mb: 1 }}>
                          {col.title}
                        </Typography>
                        {col.items.filter(Boolean).length === 0 ? (
                          <Typography variant="caption" color="text.secondary" fontStyle="italic">
                            {col.title === "Prioridades da semana" ? "Gere o parecer IA para ver ações sugeridas." : "Sem itens neste recorte."}
                          </Typography>
                        ) : (
                          <Box component="ul" sx={{ m: 0, pl: 2, color: "text.primary", fontSize: "0.82rem", lineHeight: 1.55 }}>
                            {col.items.filter(Boolean).map((x, i) => <li key={i} style={{ marginBottom: 4 }}>{x}</li>)}
                          </Box>
                        )}
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Section>
            )}

            {/* ── Tab 1: Operação ── */}
            {tab === 1 && (
              <Section title="Panorama do pipeline" subtitle="Volume, valores e indicadores de atrito detectados neste snapshot Kommo." accent>
                <GroupLabel>Volume de oportunidades</GroupLabel>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(4, 1fr)" }, gap: 1.75, mb: 3 }}>
                  <MetricCard label="Total leads" value={fmtNum(ov.total_leads_all_status)} />
                  <MetricCard label="Abertas" value={fmtNum(ov.total_active_leads)} highlight />
                  <MetricCard label="Ganhas" value={fmtNum(ov.total_won_leads)} />
                  <MetricCard label="Perdidas" value={fmtNum(ov.total_lost_leads)} />
                </Box>

                <GroupLabel>Indicadores financeiros</GroupLabel>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(4, 1fr)" }, gap: 1.75, mb: 3 }}>
                  <MetricCard label="Valor em aberto" value={fmtMoney(ov.total_open_pipeline_value)} highlight />
                  <MetricCard label="Valor ganho" value={fmtMoney(fin.won_pipeline_value as number)} />
                  <MetricCard label="Ticket médio (abertas)" value={fmtMoney(fin.avg_ticket_open as number)} />
                  <MetricCard label="Concentração top 3" value={fmtPct(fin.open_value_concentration_top3_pct as number, 2)} />
                  <MetricCard label="Taxa de ganho" value={winRate ? `${winRate}%` : "—"} />
                  <MetricCard label="Taxa de perda" value={lossRate ? `${lossRate}%` : "—"} />
                </Box>

                <GroupLabel>Atrito e higiene</GroupLabel>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(4, 1fr)" }, gap: 1.75, mb: 3 }}>
                  <MetricCard label="Sem valor (abertas)" value={fmtNum(ov.open_leads_without_value)} warn={(ov.open_leads_without_value ?? 0) > 0} />
                  <MetricCard label="Sem responsável" value={fmtNum(ov.open_leads_without_owner)} warn={(ov.open_leads_without_owner ?? 0) > 0} />
                  <MetricCard label="Sem origem" value={fmtNum(ov.open_leads_without_source)} warn={(ov.open_leads_without_source ?? 0) > 0} />
                  <MetricCard label="Sem próxima ação" value={fmtNum(samples.counts?.no_next_action_leads)} warn />
                  <MetricCard label="Tarefas vencidas" value={fmtNum(samples.counts?.overdue_tasks)} warn />
                  <MetricCard label="Leads parados" value={fmtNum(samples.counts?.stuck_leads)} warn />
                </Box>

                <Divider sx={{ my: 3, borderColor: "divider" }} />
                <GroupLabel>Inventário do sync</GroupLabel>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(4, 1fr)" }, gap: 1.75 }}>
                  {Object.entries((data?.sync_stats ?? {}) as Record<string, number>).map(([k, v]) => (
                    <MetricCard key={k} label={k.replace(/_/g, " ")} value={fmtNum(v)} />
                  ))}
                </Box>
              </Section>
            )}

            {/* ── Tab 2: Gráficos ── */}
            {tab === 2 && (
              <Section title="Painéis analíticos" subtitle="Visualizações interativas sobre o snapshot atual." accent>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2.5, mb: 2.5 }}>
                  <ChartCard title="Composição das oportunidades" subtitle="Abertas, ganhas e perdidas neste snapshot." accent height={280}>
                    <PieChart>
                      <defs>
                        {pieData.map((entry, i) => (
                          <linearGradient key={i} id={`pieGrad-${i}`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={entry.fill} stopOpacity={1} />
                            <stop offset="100%" stopColor={entry.fill} stopOpacity={0.7} />
                          </linearGradient>
                        ))}
                      </defs>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={64} outerRadius={102} paddingAngle={3} stroke="none">
                        {pieData.map((_, i) => <Cell key={i} fill={`url(#pieGrad-${i})`} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => fmtNum(v)} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                    </PieChart>
                  </ChartCard>

                  <ChartCard title="Scores de saúde (0–100)" subtitle="Higiene de dados vs disciplina operacional." accent height={280}>
                    <BarChart data={scoreBarData} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
                      <defs>
                        <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={ORANGE} stopOpacity={1} />
                          <stop offset="100%" stopColor="#FB923C" stopOpacity={0.75} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                      <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(249,115,22,0.06)" }} formatter={(v: number) => `${v}/100`} />
                      <Bar dataKey="valor" name="Pontuação" radius={[10, 10, 0, 0]} fill="url(#scoreGrad)" maxBarSize={64} />
                    </BarChart>
                  </ChartCard>
                </Box>

                <Box sx={{ mb: 2.5 }}>
                  <ChartCard title="Volume por estágio" subtitle="Distribuição de oportunidades abertas por estágio." accent height={340}>
                    <BarChart data={stagesChartData} margin={{ top: 12, right: 16, left: 4, bottom: 60 }}>
                      <defs>
                        <linearGradient id="stagesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={ORANGE} stopOpacity={1} />
                          <stop offset="100%" stopColor="#FB923C" stopOpacity={0.7} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                      <XAxis dataKey="nome" tick={{ fontSize: 10, fill: "#6B7280" }} interval={0} angle={-28} textAnchor="end" height={72} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(249,115,22,0.06)" }} formatter={(v: number) => fmtNum(v)} />
                      <Bar dataKey="abertas" name="Abertas" fill="url(#stagesGrad)" radius={[8, 8, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ChartCard>
                </Box>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2.5 }}>
                  {ownersChartData.length > 0 && (
                    <ChartCard title="Equipe · valor em aberto" subtitle="Volume financeiro sob responsabilidade de cada usuário." height={320}>
                      <BarChart layout="vertical" data={ownersChartData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                        <defs>
                          <linearGradient id="ownersGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#16A34A" stopOpacity={0.85} />
                            <stop offset="100%" stopColor="#22C55E" stopOpacity={1} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : String(v)} />
                        <YAxis type="category" dataKey="nome" width={130} tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(34,197,94,0.06)" }} formatter={(v: number) => fmtMoney(v)} />
                        <Bar dataKey="valor" name="Valor em aberto" fill="url(#ownersGrad)" radius={[0, 8, 8, 0]} maxBarSize={28} />
                      </BarChart>
                    </ChartCard>
                  )}

                  {lostChartData.length > 0 && (
                    <ChartCard title="Motivos de perda" subtitle="Categorias mais frequentes que encerram oportunidades." height={320}>
                      <BarChart layout="vertical" data={lostChartData} margin={{ top: 8, right: 20, left: 8, bottom: 8 }}>
                        <defs>
                          <linearGradient id="lostGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#DC2626" stopOpacity={0.85} />
                            <stop offset="100%" stopColor="#EF4444" stopOpacity={1} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="nome" width={170} tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(239,68,68,0.06)" }} formatter={(v: number) => fmtNum(v)} />
                        <Bar dataKey="qtd" name="Quantidade" fill="url(#lostGrad)" radius={[0, 8, 8, 0]} maxBarSize={28} />
                      </BarChart>
                    </ChartCard>
                  )}
                </Box>
              </Section>
            )}
            {tab === 3 && (
              <Section title="Distribuição e perdas por estágio" subtitle="Concentração de abertas e volume de perdas por estágio neste snapshot.">
                {stageDist.length > 0 ? (
                  <>
                    <Typography variant="caption" sx={{ fontSize: "0.63rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "text.secondary", display: "block", mb: 1.5 }}>
                      Oportunidades abertas por estágio
                    </Typography>
                    {stageDist.slice(0, 16).map((s, i) => (
                      <StageBar key={i} name={String(s.stage_name ?? "—")} count={s.lead_count ?? 0} pct={s.pct_of_open_pipeline ?? 0} />
                    ))}
                  </>
                ) : <Typography variant="body2" color="text.secondary">Sem dados de distribuição por estágio.</Typography>}

                {stageLoss.length > 0 && (
                  <>
                    <Divider sx={{ my: 2.5 }} />
                    <Typography variant="caption" sx={{ fontSize: "0.63rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "text.secondary", display: "block", mb: 1.5 }}>
                      Perdas por estágio
                    </Typography>
                    {(() => {
                      const maxLost = Math.max(1, ...stageLoss.map(r => Number(r.lost_count ?? 0)));
                      return stageLoss.slice(0, 12).map((s, i) => (
                        <StageBar key={i} name={String(s.stage_name ?? "—")} count={s.lost_count ?? 0} pct={(Number(s.lost_count ?? 0) / maxLost) * 100} color={CHART_COLORS.red} />
                      ));
                    })()}
                  </>
                )}

                {lostTop.length > 0 && (
                  <>
                    <Divider sx={{ my: 2.5 }} />
                    <Typography variant="caption" sx={{ fontSize: "0.63rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "text.secondary", display: "block", mb: 1.5 }}>
                      Motivos mais frequentes
                    </Typography>
                    <Box component="ul" sx={{ m: 0, pl: 2.5, color: "text.secondary", fontSize: "0.875rem", lineHeight: 1.55 }}>
                      {lostTop.slice(0, 10).map((x, i) => (
                        <li key={i} style={{ marginBottom: 6 }}>{String(x.lost_reason ?? "—")}: <strong>{fmtNum(x.cnt)}</strong></li>
                      ))}
                    </Box>
                  </>
                )}
              </Section>
            )}

            {/* ── Tab 4: Higiene ── */}
            {tab === 4 && (
              <Section title="Higiene do CRM" subtitle="Indicadores de qualidade de dados calculados sobre este snapshot. Severidade heurística." accent>
                <Box sx={{ overflowX: "auto", borderRadius: "10px", border: "1px solid", borderColor: "divider" }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: "action.hover" }}>
                        {["Indicador", "Quantidade", "Severidade", "Nota"].map(h => (
                          <TableCell key={h} sx={{ fontSize: "0.63rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary", py: 1.25 }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[
                        { label: "Abertas sem valor", qty: ov.open_leads_without_value, sev: ov.open_leads_without_value && ov.total_active_leads ? (ov.open_leads_without_value / ov.total_active_leads > 0.35 ? "critical" : ov.open_leads_without_value / ov.total_active_leads > 0.18 ? "high" : "medium") : "na", note: "Forecast incompleto" },
                        { label: "Sem responsável", qty: ov.open_leads_without_owner, sev: (ov.open_leads_without_owner ?? 0) > 0 ? "high" : "low", note: "Oportunidade orfã" },
                        { label: "Sem origem", qty: ov.open_leads_without_source, sev: ov.open_leads_without_source && ov.total_active_leads ? (ov.open_leads_without_source / ov.total_active_leads > 0.35 ? "critical" : "high") : "na", note: "Canal não rastreado" },
                        { label: "Contatos sem e-mail", qty: dq.contacts_without_email, sev: "medium", note: "Alcance por e-mail comprometido" },
                        { label: "Contatos sem telefone", qty: dq.contacts_without_phone, sev: "medium", note: "Alcance por voz comprometido" },
                        { label: "E-mails duplicados", qty: dq.duplicate_email_keys, sev: "high", note: "Risco de base poluída" },
                        { label: "Perdas sem motivo", qty: typeof lossM.lost_without_reason_count === "number" ? lossM.lost_without_reason_count : undefined, sev: "high", note: "Análise de perdas inviabilizada" },
                      ].map((r, i) => (
                        <TableRow key={i} hover sx={{ "&:last-child td": { border: 0 } }}>
                          <TableCell sx={{ fontSize: "0.85rem", fontWeight: 500 }}>{r.label}</TableCell>
                          <TableCell sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: "0.9rem" }}>{r.qty !== undefined ? fmtNum(r.qty) : "—"}</TableCell>
                          <TableCell><SeverityChip sev={r.sev} /></TableCell>
                          <TableCell sx={{ fontSize: "0.8rem", color: "text.secondary" }}>{r.note}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </Section>
            )}

            {/* ── Tab 5: Tarefas ── */}
            {tab === 5 && (
              <Section title="Tarefas e follow-up" subtitle="Visão agregada das tarefas sincronizadas — desdobramento por responsável na aba Equipe.">
                <Grid container spacing={1.5} sx={{ mb: 3 }}>
                  {[
                    { label: "Total de tarefas", value: fmtNum(taskM.total as number) },
                    { label: "Concluídas", value: fmtNum(taskM.completed as number) },
                    { label: "Abertas", value: fmtNum(taskM.open as number) },
                    { label: "Vencidas (com data)", value: fmtNum(taskM.overdue as number), warn: (taskM.overdue as number) > 0 },
                    { label: "Atraso médio (dias)", value: taskM.avg_overdue_days != null ? fmtNum(taskM.avg_overdue_days as number) : "—" },
                  ].map((m, i) => (
                    <Grid item xs={6} sm={4} md={2.4} key={i}><MetricCard label={m.label} value={m.value} warn={m.warn} /></Grid>
                  ))}
                </Grid>

                {samples.counts?.no_next_action_leads != null && (
                  <Alert severity="warning" icon={<WarningIcon />} sx={{ borderRadius: "8px", mb: 2 }}>
                    <strong>{fmtNum(samples.counts.no_next_action_leads)} oportunidades</strong> sem próxima ação definida no Kommo.
                  </Alert>
                )}

                {(samples.counts?.overdue_tasks ?? 0) > 0 && (
                  <Alert severity="error" icon={<ErrorIcon />} sx={{ borderRadius: "8px" }}>
                    <strong>{fmtNum(samples.counts?.overdue_tasks)} tarefas vencidas</strong> aguardando ação — veja a aba Evidências para detalhes.
                  </Alert>
                )}
              </Section>
            )}

            {/* ── Tab 6: Equipe ── */}
            {tab === 6 && (
              <Section title="Carga operacional por responsável" subtitle="Indicadores de carga e atrito no processo — não avaliação individual de desempenho.">
                {ownerOps.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">Dados de carga por responsável não disponíveis neste snapshot. Sync com backend atualizado necessário.</Typography>
                ) : (
                  <Box sx={{ overflowX: "auto", borderRadius: "10px", border: "1px solid", borderColor: "divider" }}>
                    <Table>
                      <TableHead>
                        <TableRow sx={{ bgcolor: "action.hover" }}>
                          {["Responsável", "Abertas", "Valor aberto", "Sem ação", "Parados", "Tarefas atrasadas", "Risco operacional"].map(h => (
                            <TableCell key={h} sx={{ fontSize: "0.63rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary", py: 1.25, whiteSpace: "nowrap" }}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {ownerOps.slice(0, 25).map((row, i) => (
                          <TableRow key={i} hover sx={{ "&:last-child td": { border: 0 } }}>
                            <TableCell sx={{ fontWeight: 600, fontSize: "0.85rem" }}>{String(row.owner_name)}</TableCell>
                            <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>{fmtNum(row.open_leads as number)}</TableCell>
                            <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>{fmtMoney(row.open_value as number)}</TableCell>
                            <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>
                              <Typography variant="body2" sx={{ color: (row.no_next_action_open as number) > 0 ? "warning.main" : "text.primary" }}>
                                {fmtNum(row.no_next_action_open as number)}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>
                              <Typography variant="body2" sx={{ color: (row.stuck_open as number) > 0 ? "warning.main" : "text.primary" }}>
                                {fmtNum(row.stuck_open as number)}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>
                              <Typography variant="body2" sx={{ color: (row.overdue_tasks as number) > 0 ? "error.main" : "text.primary" }}>
                                {fmtNum(row.overdue_tasks as number)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <MuiTooltip title="Índice heurístico do snapshot (0–100). Menor é melhor.">
                                <Chip label={fmtNum(row.operational_risk_0_100 as number)} size="small" sx={{ bgcolor: ORANGE_SOFT, color: ORANGE, fontWeight: 700, fontSize: "0.75rem" }} />
                              </MuiTooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}
              </Section>
            )}

            {/* ── Tab 7: Perdas ── */}
            {tab === 7 && (
              <Section title="Perdas e motivos" subtitle="Distribuição de motivos e valor associado no snapshot atual.">
                <Grid container spacing={1.5} sx={{ mb: 3 }}>
                  {[
                    { label: "Total perdidas", value: fmtNum(ov.total_lost_leads) },
                    { label: "Taxa de perda", value: lossRate ? `${lossRate}%` : "—", warn: parseFloat(lossRate ?? "0") > 30 },
                    { label: "Valor perdido", value: fmtMoney(fin.lost_pipeline_value as number) },
                    { label: "Perdas sem motivo", value: fmtNum(lossM.lost_without_reason_count as number), warn: (lossM.lost_without_reason_count as number) > 0 },
                  ].map((m, i) => (
                    <Grid item xs={6} sm={3} key={i}><MetricCard label={m.label} value={m.value} warn={m.warn} /></Grid>
                  ))}
                </Grid>

                <Typography variant="caption" sx={{ fontSize: "0.63rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "text.secondary", display: "block", mb: 1.5 }}>
                  Motivos mais frequentes
                </Typography>
                {lostTop.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">Nenhum motivo de perda registrado neste snapshot.</Typography>
                ) : (
                  <Box sx={{ overflowX: "auto", borderRadius: "10px", border: "1px solid", borderColor: "divider" }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: "action.hover" }}>
                          <TableCell sx={{ fontSize: "0.63rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" }}>Motivo</TableCell>
                          <TableCell sx={{ fontSize: "0.63rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" }}>Qtd.</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {lostTop.slice(0, 12).map((x, i) => (
                          <TableRow key={i} hover sx={{ "&:last-child td": { border: 0 } }}>
                            <TableCell sx={{ fontSize: "0.85rem" }}>{String(x.lost_reason ?? "—")}</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtNum(x.cnt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}

                <Box sx={{ mt: 2.5, p: 2, borderRadius: "10px", bgcolor: ORANGE_SOFT, border: `1px solid ${ORANGE_BORDER}` }}>
                  <Typography variant="caption" sx={{ fontSize: "0.63rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE, display: "block", mb: 1 }}>
                    Sugestões de processo
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2.5, color: "text.secondary", fontSize: "0.85rem", lineHeight: 1.55 }}>
                    <li style={{ marginBottom: 4 }}>Revisar critérios de qualificação nas etapas iniciais.</li>
                    <li style={{ marginBottom: 4 }}>Padronizar motivo de perda no fechamento.</li>
                    <li>Instituir win/loss review quinzenal.</li>
                  </Box>
                </Box>
              </Section>
            )}

            {/* ── Tab 8: Forecast ── */}
            {tab === 8 && (
              <Section title="Forecast e confiabilidade" subtitle={`Índice de confiança: ${fmtNum(execResolved.scores?.forecast_0_100)} — baseado em completude de valor, responsável e origem.`} accent>
                <Grid container spacing={1.5} sx={{ mb: 3 }}>
                  {[
                    { label: "Valor aberto total", value: fmtMoney(ov.total_open_pipeline_value), highlight: true },
                    { label: "Confiabilidade (0–100)", value: fmtNum(execResolved.scores?.forecast_0_100) },
                    { label: "Abertas sem valor", value: fmtNum(ov.open_leads_without_value), warn: (ov.open_leads_without_value ?? 0) > 0 },
                    { label: "Concentração top 3 deals", value: fmtPct(fin.open_value_concentration_top3_pct as number, 2) },
                  ].map((m, i) => (
                    <Grid item xs={6} sm={3} key={i}><MetricCard label={m.label} value={m.value} highlight={m.highlight} warn={m.warn} /></Grid>
                  ))}
                </Grid>

                <PillarCard
                  title="Confiabilidade do forecast"
                  hint="Score baseado em: % de abertas com valor > 0, % com responsável, % com origem e ausência de duplicidades. Sem série temporal, sem benchmark histórico."
                  score={execResolved.scores?.forecast_0_100 ?? 0}
                />
              </Section>
            )}

            {/* ── Tab 9: Evidências ── */}
            {tab === 9 && (
              <Section title="Evidências detalhadas" subtitle="Registros do snapshot com busca e filtros. Total 'universo' reflete o CRM completo." accent>
                {evidencePayload?.meta?.note && (
                  <Alert severity="warning" sx={{ mb: 2, borderRadius: "8px", fontSize: "0.8rem" }}>{evidencePayload.meta.note}</Alert>
                )}
                <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 3, p: 1.5, borderRadius: "8px", bgcolor: "action.hover", border: "1px dashed", borderColor: "divider" }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: "0.63rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "text.secondary", mr: 1, alignSelf: "center" }}>
                    Atalhos
                  </Typography>
                  {EVIDENCE_BLOCKS.map(b => (
                    <Chip key={b.key} label={b.title} size="small" onClick={() => document.getElementById(`ev-${b.key}`)?.scrollIntoView({ behavior: "smooth" })}
                      sx={{ cursor: "pointer", fontSize: "0.72rem", "&:hover": { bgcolor: ORANGE_SOFT, color: ORANGE } }} />
                  ))}
                </Stack>
                {EVIDENCE_BLOCKS.map(b => (
                  <EvidenceBlock
                    key={b.key}
                    id={`ev-${b.key}`}
                    title={b.title}
                    subtitle={b.subtitle}
                    rows={(evidencePayload?.rows?.[b.key] ?? []) as Record<string, unknown>[]}
                    universeTotal={evidencePayload?.counts?.[b.key]}
                    emptyHint={b.emptyHint}
                  />
                ))}
              </Section>
            )}

            {/* ── Tab 10: Parecer IA ── */}
            {tab === 10 && (
              <Box>
                {!analysis ? (
                  <Card variant="outlined" sx={{ borderRadius: "12px", borderColor: ORANGE_BORDER, p: 5 }}>
                    <Stack alignItems="center" spacing={2}>
                      <AIIcon sx={{ fontSize: 56, color: ORANGE, opacity: 0.5 }} />
                      <Typography variant="h6" fontWeight={700}>Auditoria analítica completa</Typography>
                      <Typography color="text.secondary" variant="body2" textAlign="center" sx={{ maxWidth: "50ch" }}>
                        Clique em <strong>Gerar parecer IA</strong> para produzir diagnóstico detalhado de cada funil, responsável, higiene e plano de ação tático.
                      </Typography>
                      <Button variant="contained" size="large" startIcon={<AIIcon />} onClick={handleAnalyze} disabled={analyzing}
                        sx={{ background: `linear-gradient(135deg, ${ORANGE}, #EA580C)`, fontWeight: 700, textTransform: "none", px: 4, boxShadow: "0 4px 16px rgba(249,115,22,0.35)" }}>
                        {analyzing ? "Gerando auditoria…" : "Gerar Parecer IA"}
                      </Button>
                    </Stack>
                  </Card>
                ) : (
                  <Stack spacing={2.5}>
                    {/* ── Veredito geral ── */}
                    {(() => {
                      const v = String(analysis.overall_verdict ?? "");
                      const score = Number(analysis.operation_score ?? 0);
                      const cfg: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
                        critical: { label: "CRÍTICO — intervenção imediata necessária", color: "#EF4444", bg: "rgba(239,68,68,0.06)", icon: <ErrorIcon sx={{ color: "#EF4444", fontSize: 28 }} /> },
                        warning:  { label: "EM ALERTA — atenção urgente requerida",     color: "#F59E0B", bg: "rgba(245,158,11,0.06)", icon: <WarningIcon sx={{ color: "#F59E0B", fontSize: 28 }} /> },
                        moderate: { label: "MODERADO — há problemas relevantes",         color: ORANGE,    bg: ORANGE_SOFT,              icon: <TrendingUpIcon sx={{ color: ORANGE, fontSize: 28 }} /> },
                        healthy:  { label: "SAUDÁVEL — manutenção e evolução",           color: "#22C55E", bg: "rgba(34,197,94,0.06)",   icon: <OkIcon sx={{ color: "#22C55E", fontSize: 28 }} /> },
                      };
                      const c = cfg[v] ?? cfg.warning;
                      return (
                        <Card variant="outlined" sx={{ borderRadius: "12px", borderColor: c.color + "44", bgcolor: c.bg, p: 2.5 }}>
                          <Stack direction="row" alignItems="center" spacing={2} justifyContent="space-between" flexWrap="wrap" gap={1}>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                              {c.icon}
                              <Box>
                                <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: c.color }}>Veredito da auditoria</Typography>
                                <Typography variant="h6" fontWeight={800} letterSpacing="-0.02em" sx={{ color: c.color, lineHeight: 1.2 }}>{c.label}</Typography>
                              </Box>
                            </Stack>
                            <Box sx={{ textAlign: "right" }}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Score operacional</Typography>
                              <Typography variant="h3" fontWeight={900} sx={{ color: c.color, lineHeight: 1, letterSpacing: "-0.04em" }}>{score}<Typography component="span" variant="h6" fontWeight={400} sx={{ color: "text.secondary" }}>/100</Typography></Typography>
                            </Box>
                          </Stack>
                        </Card>
                      );
                    })()}

                    {/* ── Resumo executivo ── */}
                    {analysis.executive_summary && (
                      <Card variant="outlined" sx={{ borderRadius: "12px", borderColor: "divider", p: 3 }}>
                        <Box sx={{ width: 32, height: 3, borderRadius: 999, background: `linear-gradient(90deg, ${ORANGE}, #FB923C)`, mb: 1.5 }} />
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Diagnóstico executivo</Typography>
                        {String(analysis.executive_summary).split("\n\n").filter(Boolean).map((para, i) => (
                          <Typography key={i} variant="body2" sx={{ mb: 1.25, lineHeight: 1.75, color: "text.secondary", fontSize: "0.9rem" }}>{para}</Typography>
                        ))}
                        <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: "block", fontSize: "0.68rem" }}>
                          Modelo: {String((analysis as Record<string, unknown>).model_used ?? "determinístico")}
                        </Typography>
                      </Card>
                    )}

                    {/* ── Gargalos principais ── */}
                    {Array.isArray(analysis.main_bottlenecks) && (analysis.main_bottlenecks as unknown[]).length > 0 && (
                      <Card variant="outlined" sx={{ borderRadius: "12px", borderColor: "divider", p: 3 }}>
                        <Box sx={{ width: 32, height: 3, borderRadius: 999, bgcolor: "#EF4444", mb: 1.5 }} />
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Gargalos críticos detectados</Typography>
                        <Stack spacing={1.5}>
                          {(analysis.main_bottlenecks as { title?: string; detail?: string; metric?: string; severity?: string; root_cause?: string; financial_impact?: string }[]).map((b, i) => {
                            const sevColor: Record<string, string> = { critical: "#EF4444", high: "#F59E0B", medium: ORANGE, low: "#6B7280" };
                            const c = sevColor[b.severity ?? "medium"] ?? "#6B7280";
                            return (
                              <Box key={i} sx={{ p: 2, borderRadius: "10px", border: "1px solid", borderColor: c + "33", borderLeft: `4px solid ${c}`, bgcolor: c + "08" }}>
                                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1} sx={{ mb: 0.75 }}>
                                  <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: "0.9rem", flex: 1 }}>{b.title}</Typography>
                                  <Chip label={b.severity?.toUpperCase()} size="small" sx={{ bgcolor: c + "18", color: c, fontWeight: 800, fontSize: "0.6rem", letterSpacing: "0.08em", flexShrink: 0 }} />
                                </Stack>
                                {b.metric && <Typography variant="caption" sx={{ fontWeight: 700, color: c, display: "block", mb: 0.5, fontSize: "0.78rem" }}>📊 {b.metric}</Typography>}
                                {b.detail && <Typography variant="body2" sx={{ fontSize: "0.83rem", color: "text.secondary", lineHeight: 1.6, mb: 0.75 }}>{b.detail}</Typography>}
                                {b.root_cause && b.root_cause !== "—" && (
                                  <Typography variant="caption" color="text.disabled" sx={{ display: "block", fontSize: "0.75rem" }}>
                                    <strong>Causa raiz:</strong> {b.root_cause}
                                  </Typography>
                                )}
                                {b.financial_impact && b.financial_impact !== "—" && (
                                  <Typography variant="caption" sx={{ display: "block", fontSize: "0.75rem", color: "#EF4444", mt: 0.25 }}>
                                    <strong>Impacto financeiro:</strong> {b.financial_impact}
                                  </Typography>
                                )}
                              </Box>
                            );
                          })}
                        </Stack>
                      </Card>
                    )}

                    {/* ── Análise por funil ── */}
                    {Array.isArray(analysis.funnel_analysis) && (analysis.funnel_analysis as unknown[]).length > 0 && (
                      <Card variant="outlined" sx={{ borderRadius: "12px", borderColor: "divider", p: 3 }}>
                        <Box sx={{ width: 32, height: 3, borderRadius: 999, background: `linear-gradient(90deg, ${ORANGE}, #FB923C)`, mb: 1.5 }} />
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Análise por funil de vendas</Typography>
                        <Grid container spacing={2}>
                          {(analysis.funnel_analysis as { pipeline_name?: string; leads_open?: number; total_value?: number; conversion_rate?: number | null; bottleneck_stage?: string | null; problems?: string[]; severity?: string; recommendation?: string }[]).map((f, i) => {
                            const sevColor: Record<string, string> = { critical: "#EF4444", high: "#F59E0B", medium: ORANGE, low: "#22C55E" };
                            const c = sevColor[f.severity ?? "medium"] ?? ORANGE;
                            return (
                              <Grid item xs={12} md={6} key={i}>
                                <Box sx={{ p: 2.5, borderRadius: "10px", border: "1px solid", borderColor: c + "33", bgcolor: c + "06", height: "100%" }}>
                                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
                                    <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: "0.88rem" }}>{f.pipeline_name}</Typography>
                                    <Chip label={f.severity?.toUpperCase()} size="small" sx={{ bgcolor: c + "18", color: c, fontWeight: 800, fontSize: "0.58rem" }} />
                                  </Stack>
                                  <Stack direction="row" spacing={2} sx={{ mb: 1.5 }}>
                                    <Box>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.63rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", display: "block" }}>Abertas</Typography>
                                      <Typography variant="h6" fontWeight={800} sx={{ color: c, lineHeight: 1 }}>{fmtNum(f.leads_open)}</Typography>
                                    </Box>
                                    <Box>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.63rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", display: "block" }}>Valor</Typography>
                                      <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1 }}>{fmtMoney(f.total_value)}</Typography>
                                    </Box>
                                    <Box>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.63rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", display: "block" }}>Conversão</Typography>
                                      <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1 }}>{f.conversion_rate != null ? `${f.conversion_rate}%` : "—"}</Typography>
                                    </Box>
                                  </Stack>
                                  {f.bottleneck_stage && (
                                    <Box sx={{ mb: 1, px: 1.25, py: 0.5, bgcolor: c + "14", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                                      <WarningIcon sx={{ fontSize: 13, color: c }} />
                                      <Typography variant="caption" sx={{ fontSize: "0.72rem", fontWeight: 700, color: c }}>Gargalo: {f.bottleneck_stage}</Typography>
                                    </Box>
                                  )}
                                  {Array.isArray(f.problems) && (
                                    <Box component="ul" sx={{ m: 0, mt: 1, pl: 2, color: "text.secondary", fontSize: "0.8rem", lineHeight: 1.55 }}>
                                      {f.problems.map((p, j) => <li key={j} style={{ marginBottom: 3 }}>{p}</li>)}
                                    </Box>
                                  )}
                                  {f.recommendation && (
                                    <Box sx={{ mt: 1.25, pt: 1.25, borderTop: "1px dashed", borderColor: "divider" }}>
                                      <Typography variant="caption" sx={{ fontSize: "0.73rem", color: "text.secondary", lineHeight: 1.5 }}>
                                        <strong>Recomendação:</strong> {f.recommendation}
                                      </Typography>
                                    </Box>
                                  )}
                                </Box>
                              </Grid>
                            );
                          })}
                        </Grid>
                      </Card>
                    )}

                    {/* ── Disciplina operacional ── */}
                    {analysis.task_discipline && (() => {
                      const td = analysis.task_discipline as { overdue_tasks?: number; no_next_action?: number; stuck_leads?: number; stuck_threshold_days?: number; assessment?: string; severity?: string; pattern?: string };
                      const sevColor: Record<string, string> = { critical: "#EF4444", high: "#F59E0B", medium: ORANGE, low: "#22C55E" };
                      const c = sevColor[td.severity ?? "medium"] ?? ORANGE;
                      return (
                        <Card variant="outlined" sx={{ borderRadius: "12px", borderColor: c + "33", p: 3 }}>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                            <Box sx={{ width: 32, height: 3, borderRadius: 999, bgcolor: c }} />
                            <Typography variant="subtitle1" fontWeight={700}>Disciplina operacional</Typography>
                            <Chip label={td.severity?.toUpperCase()} size="small" sx={{ bgcolor: c + "18", color: c, fontWeight: 800, fontSize: "0.6rem" }} />
                          </Stack>
                          <Grid container spacing={1.5} sx={{ mb: 2 }}>
                            {[
                              { label: "Leads parados", value: fmtNum(td.stuck_leads), warn: (td.stuck_leads ?? 0) > 100, note: `+${td.stuck_threshold_days ?? 7}d sem atualização` },
                              { label: "Sem próxima ação", value: fmtNum(td.no_next_action), warn: (td.no_next_action ?? 0) > 50 },
                              { label: "Tarefas vencidas", value: fmtNum(td.overdue_tasks), warn: (td.overdue_tasks ?? 0) > 0 },
                            ].map((m, j) => (
                              <Grid item xs={4} key={j}>
                                <MetricCard label={m.label} value={m.value} warn={m.warn} />
                              </Grid>
                            ))}
                          </Grid>
                          {td.assessment && <Typography variant="body2" sx={{ fontSize: "0.85rem", color: "text.secondary", lineHeight: 1.65, mb: 1 }}>{td.assessment}</Typography>}
                          {td.pattern && <Typography variant="caption" sx={{ fontSize: "0.75rem", color: "text.disabled", fontStyle: "italic" }}>Padrão: {td.pattern}</Typography>}
                        </Card>
                      );
                    })()}

                    {/* ── Higiene de dados ── */}
                    {analysis.data_hygiene && (() => {
                      const dh = analysis.data_hygiene as { score_0_100?: number; diagnosis?: string; issues?: { title?: string; detail?: string; qty?: number; pct?: number; impact?: string; severity?: string; fix?: string }[] };
                      return (
                        <Card variant="outlined" sx={{ borderRadius: "12px", borderColor: "divider", p: 3 }}>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                            <Box sx={{ width: 32, height: 3, borderRadius: 999, background: "#F59E0B" }} />
                            <Typography variant="subtitle1" fontWeight={700}>Higiene de dados do CRM</Typography>
                            <Chip label={`${fmtNum(dh.score_0_100)}/100`} size="small" sx={{ bgcolor: ORANGE_SOFT, color: ORANGE, fontWeight: 800, fontSize: "0.7rem" }} />
                          </Stack>
                          {dh.diagnosis && <Typography variant="body2" sx={{ fontSize: "0.85rem", color: "text.secondary", mb: 2, lineHeight: 1.6 }}>{dh.diagnosis}</Typography>}
                          {Array.isArray(dh.issues) && dh.issues.length > 0 && (
                            <Stack spacing={1}>
                              {dh.issues.map((issue, j) => {
                                const sevColor: Record<string, string> = { critical: "#EF4444", high: "#F59E0B", medium: ORANGE, low: "#22C55E" };
                                const c = sevColor[issue.severity ?? "medium"] ?? ORANGE;
                                return (
                                  <Box key={j} sx={{ p: 1.75, borderRadius: "8px", border: "1px solid", borderColor: c + "30", bgcolor: c + "06" }}>
                                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                                      <Typography variant="body2" fontWeight={700} sx={{ fontSize: "0.83rem" }}>{issue.title}</Typography>
                                      <Stack direction="row" spacing={0.75}>
                                        {issue.qty != null && <Chip label={fmtNum(issue.qty)} size="small" sx={{ bgcolor: c + "18", color: c, fontWeight: 800, fontSize: "0.68rem" }} />}
                                        {issue.pct != null && <Chip label={`${issue.pct?.toFixed(1)}%`} size="small" sx={{ fontSize: "0.68rem" }} />}
                                      </Stack>
                                    </Stack>
                                    {issue.detail && <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.75rem", mb: 0.25 }}>{issue.detail}</Typography>}
                                    {issue.impact && <Typography variant="caption" sx={{ display: "block", fontSize: "0.73rem", color: c, fontStyle: "italic" }}>Impacto: {issue.impact}</Typography>}
                                    {issue.fix && <Typography variant="caption" sx={{ display: "block", fontSize: "0.73rem", color: "text.disabled", mt: 0.25 }}>Ação: {issue.fix}</Typography>}
                                  </Box>
                                );
                              })}
                            </Stack>
                          )}
                        </Card>
                      );
                    })()}

                    {/* ── Riscos comerciais ── */}
                    {Array.isArray(analysis.commercial_risks) && (analysis.commercial_risks as unknown[]).length > 0 && (
                      <Card variant="outlined" sx={{ borderRadius: "12px", borderColor: "divider", p: 3 }}>
                        <Box sx={{ width: 32, height: 3, borderRadius: 999, bgcolor: "#EF4444", mb: 1.5 }} />
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Riscos comerciais</Typography>
                        <Stack spacing={1.25}>
                          {(analysis.commercial_risks as { title?: string; detail?: string; financial_impact?: string; urgency?: string }[]).map((r, i) => {
                            const urgColor: Record<string, string> = { immediate: "#EF4444", short_term: "#F59E0B", structural: ORANGE };
                            const c = urgColor[r.urgency ?? "short_term"] ?? "#F59E0B";
                            return (
                              <Box key={i} sx={{ p: 2, borderRadius: "8px", border: "1px solid", borderColor: c + "30", borderLeft: `3px solid ${c}` }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1} sx={{ mb: 0.5 }}>
                                  <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }}>{r.title}</Typography>
                                  <Chip size="small" label={r.urgency === "immediate" ? "Imediato" : r.urgency === "short_term" ? "Curto prazo" : "Estrutural"} sx={{ bgcolor: c + "18", color: c, fontSize: "0.65rem", fontWeight: 700, flexShrink: 0 }} />
                                </Stack>
                                {r.detail && <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.78rem", lineHeight: 1.55, mb: 0.5 }}>{r.detail}</Typography>}
                                {r.financial_impact && <Typography variant="caption" sx={{ display: "block", fontSize: "0.73rem", color: "#EF4444", fontWeight: 600 }}>💰 {r.financial_impact}</Typography>}
                              </Box>
                            );
                          })}
                        </Stack>
                      </Card>
                    )}

                    {/* ── Análise por responsável ── */}
                    {Array.isArray(analysis.owner_analysis) && (analysis.owner_analysis as unknown[]).length > 0 && (
                      <Card variant="outlined" sx={{ borderRadius: "12px", borderColor: "divider", p: 3 }}>
                        <Box sx={{ width: 32, height: 3, borderRadius: 999, background: `linear-gradient(90deg, ${ORANGE}, #FB923C)`, mb: 1.5 }} />
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Análise por responsável</Typography>
                        <Box sx={{ overflowX: "auto", borderRadius: "10px", border: "1px solid", borderColor: "divider" }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{ bgcolor: "action.hover" }}>
                                {["Responsável", "Abertas", "Valor aberto", "Avaliação", "Problemas", "Risco"].map(h => (
                                  <TableCell key={h} sx={{ fontSize: "0.63rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary", py: 1.25, whiteSpace: "nowrap" }}>{h}</TableCell>
                                ))}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {(analysis.owner_analysis as { owner?: string; open_leads?: number; open_value?: number; assessment?: string; concerns?: string; risk_level?: string }[]).map((o, i) => {
                                const riskColor: Record<string, string> = { critical: "#EF4444", high: "#F59E0B", medium: ORANGE, low: "#22C55E" };
                                const c = riskColor[o.risk_level ?? "low"] ?? "#22C55E";
                                return (
                                  <TableRow key={i} hover sx={{ "&:last-child td": { border: 0 } }}>
                                    <TableCell sx={{ fontWeight: 700, fontSize: "0.85rem" }}>{o.owner}</TableCell>
                                    <TableCell sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmtNum(o.open_leads)}</TableCell>
                                    <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>{fmtMoney(o.open_value)}</TableCell>
                                    <TableCell sx={{ fontSize: "0.78rem", color: "text.secondary", maxWidth: 200, lineHeight: 1.45 }}>{o.assessment}</TableCell>
                                    <TableCell sx={{ fontSize: "0.78rem", color: o.concerns === "Sem preocupações críticas identificadas." ? "text.disabled" : "text.secondary", maxWidth: 200 }}>{o.concerns}</TableCell>
                                    <TableCell>
                                      <Chip label={o.risk_level?.toUpperCase()} size="small" sx={{ bgcolor: c + "18", color: c, fontWeight: 800, fontSize: "0.6rem" }} />
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </Box>
                      </Card>
                    )}

                    {/* ── Análise de perdas ── */}
                    {analysis.lost_reason_analysis && (() => {
                      const lr = analysis.lost_reason_analysis as { total_lost?: number; without_reason_pct?: number; insight?: string; top_reasons?: { reason?: string; count?: number; pct?: number; suggestion?: string }[]; recommendation?: string };
                      return (
                        <Card variant="outlined" sx={{ borderRadius: "12px", borderColor: "divider", p: 3 }}>
                          <Box sx={{ width: 32, height: 3, borderRadius: 999, bgcolor: "#6B7280", mb: 1.5 }} />
                          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                            <Typography variant="subtitle1" fontWeight={700}>Análise de perdas e motivos</Typography>
                            <Stack direction="row" spacing={1}>
                              <Chip label={`${fmtNum(lr.total_lost)} perdidas`} size="small" />
                              {lr.without_reason_pct != null && lr.without_reason_pct > 0 && (
                                <Chip label={`${lr.without_reason_pct?.toFixed(1)}% sem motivo`} size="small" sx={{ bgcolor: "rgba(239,68,68,0.1)", color: "#EF4444", fontWeight: 700 }} />
                              )}
                            </Stack>
                          </Stack>
                          {lr.insight && <Typography variant="body2" sx={{ fontSize: "0.85rem", color: "text.secondary", lineHeight: 1.65, mb: 2 }}>{lr.insight}</Typography>}
                          {Array.isArray(lr.top_reasons) && lr.top_reasons.length > 0 && (
                            <Stack spacing={0.75} sx={{ mb: 2 }}>
                              {lr.top_reasons.map((r, j) => (
                                <Box key={j} sx={{ p: 1.5, borderRadius: "8px", bgcolor: "action.hover", border: "1px solid", borderColor: "divider" }}>
                                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                                    <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.82rem" }}>{r.reason}</Typography>
                                    <Stack direction="row" spacing={0.75}>
                                      <Chip label={fmtNum(r.count)} size="small" sx={{ fontSize: "0.68rem" }} />
                                      {r.pct != null && <Chip label={`${r.pct?.toFixed(1)}%`} size="small" sx={{ bgcolor: ORANGE_SOFT, color: ORANGE, fontSize: "0.68rem" }} />}
                                    </Stack>
                                  </Stack>
                                  {r.suggestion && <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.73rem" }}>{r.suggestion}</Typography>}
                                </Box>
                              ))}
                            </Stack>
                          )}
                          {lr.recommendation && (
                            <Box sx={{ p: 1.75, borderRadius: "8px", bgcolor: ORANGE_SOFT, border: `1px solid ${ORANGE_BORDER}` }}>
                              <Typography variant="caption" sx={{ fontSize: "0.63rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE, display: "block", mb: 0.75 }}>Estratégia de redução de perdas</Typography>
                              <Typography variant="caption" sx={{ fontSize: "0.8rem", color: "text.secondary", lineHeight: 1.6 }}>{lr.recommendation}</Typography>
                            </Box>
                          )}
                        </Card>
                      );
                    })()}

                    {/* ── Plano de ação ── */}
                    {analysis.action_plan && (() => {
                      const ap = analysis.action_plan as { immediate_7d?: string[]; short_term_15d?: string[]; structural_30d?: string[] };
                      const horizonsAP = [
                        { title: "⚡ 7 dias — ações imediatas", items: ap.immediate_7d ?? [], color: "#EF4444", border: "#EF4444" },
                        { title: "📋 15 dias — consolidação", items: ap.short_term_15d ?? [], color: "#F59E0B", border: "#F59E0B" },
                        { title: "🏗️ 30 dias — estrutura", items: ap.structural_30d ?? [], color: ORANGE, border: ORANGE },
                      ].filter(h => h.items.length > 0);
                      return (
                        <Card variant="outlined" sx={{ borderRadius: "12px", borderColor: ORANGE_BORDER, bgcolor: ORANGE_SOFT, p: 3 }}>
                          <Box sx={{ width: 32, height: 3, borderRadius: 999, background: `linear-gradient(90deg, ${ORANGE}, #EA580C)`, mb: 1.5 }} />
                          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Plano de ação por horizonte</Typography>
                          <Grid container spacing={2}>
                            {horizonsAP.map((h, i) => (
                              <Grid item xs={12} md={4} key={i}>
                                <Box sx={{ p: 2, borderRadius: "10px", bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderTop: `3px solid ${h.color}`, height: "100%" }}>
                                  <Typography variant="caption" sx={{ fontSize: "0.75rem", fontWeight: 800, display: "block", mb: 1.25, color: h.color }}>{h.title}</Typography>
                                  <Box component="ol" sx={{ m: 0, pl: 2.25, color: "text.secondary", fontSize: "0.83rem", lineHeight: 1.65 }}>
                                    {h.items.map((x, j) => <li key={j} style={{ marginBottom: 8 }}>{x}</li>)}
                                  </Box>
                                </Box>
                              </Grid>
                            ))}
                          </Grid>
                        </Card>
                      );
                    })()}

                    {/* ── Botão regenerar ── */}
                    <Stack direction="row" justifyContent="center" sx={{ pt: 1 }}>
                      <Button variant="outlined" startIcon={<AIIcon />} onClick={handleAnalyze} disabled={analyzing}
                        sx={{ borderColor: ORANGE_BORDER, color: ORANGE, fontWeight: 600, textTransform: "none" }}>
                        {analyzing ? "Regenerando…" : "Regenerar parecer"}
                      </Button>
                    </Stack>
                  </Stack>
                )}
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
