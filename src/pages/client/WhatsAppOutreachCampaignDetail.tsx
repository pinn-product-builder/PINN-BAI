/**
 * WhatsApp Outreach — Detalhe da campanha
 *
 * Tabs:
 *   1. Templates — CRUD dos textos por touch (D0/D2/D5/D9)
 *   2. Leads    — upload CSV + enroll
 *   3. Analytics — métricas de envio/resposta
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  ArrowBack as BackIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";

import {
  useCampaignLeads,
  useUpdateWhatsAppCampaign,
  useWhatsAppCampaign,
} from "@/modules/whatsapp-outreach/hooks/useCampaigns";
import { SendWindowEditor } from "@/modules/whatsapp-outreach/components/SendWindowEditor";
import type { SendWindow, WhatsAppCampaign } from "@/modules/whatsapp-outreach/types";
import {
  useCreateTemplate,
  useDeleteTemplate,
  useTemplates,
  useUpdateTemplate,
} from "@/modules/whatsapp-outreach/hooks/useTemplates";
import { useEnrollLeads } from "@/modules/whatsapp-outreach/hooks/useEnrollLeads";
import { CsvUploader } from "@/modules/whatsapp-outreach/components/CsvUploader";
import { getDefaultTemplatesForCadence } from "@/modules/whatsapp-outreach/lib/defaultTemplates";
import { AutoAwesome as MagicIcon } from "@mui/icons-material";
import { toast } from "sonner";
import { MenuItem, Select } from "@mui/material";
import type { CampaignLeadRow, LeadEnrollIn, OutboundTemplate } from "@/modules/whatsapp-outreach/types";

const DEFAULT_WINDOW: SendWindow = {
  weekdays: [1, 2, 3, 4, 5],
  start_hour: 9,
  end_hour: 18,
  tz: "America/Sao_Paulo",
};

const GREEN = "#25D366";

export default function WhatsAppOutreachCampaignDetail() {
  const { orgId, campaignId } = useParams<{ orgId: string; campaignId: string }>();
  const navigate = useNavigate();
  const cid = Number(campaignId);
  const { data, isLoading } = useWhatsAppCampaign(cid);
  const [tab, setTab] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (isLoading || !data) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  const { campaign, stats } = data;

  // Previsão de conclusão ao ritmo atual.
  // total_msgs = leads × N_toques; pendentes = max(0, total - já_enviado).
  // capacidade/dia = cap_por_instancia × max(1, qtd_instancias).
  // Mostra estimativa em "dias úteis" (não calendário) — a janela só roda
  // nos weekdays definidos, então essa é a métrica honesta.
  const totalMsgs = campaign.leads_enrolled * Math.max(1, campaign.cadence_days.length);
  const pendingMsgs = Math.max(0, totalMsgs - stats.sent);
  const capPerDay = campaign.daily_cap_per_instance * Math.max(1, campaign.instances.length || 1);
  const daysToFinish = capPerDay > 0 ? Math.ceil(pendingMsgs / capPerDay) : 0;

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <IconButton onClick={() => navigate(`/client/${orgId}/whatsapp-outreach`)}>
          <BackIcon />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700}>{campaign.name}</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={campaign.status} size="small" />
            <Typography variant="caption" color="text.secondary">
              Cadência: D{campaign.cadence_days.join("/D")} · Instance: {campaign.instance}
            </Typography>
          </Stack>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<SettingsIcon />}
          onClick={() => setSettingsOpen(true)}
        >
          Configurações
        </Button>
      </Stack>

      <Stack direction="row" spacing={2} mb={2}>
        <StatCard label="Enrolled" value={campaign.leads_enrolled} />
        <StatCard label="Enviados" value={stats.sent} />
        <StatCard label="Pendentes" value={pendingMsgs} />
        <StatCard label="Respondidos" value={campaign.leads_responded} />
        <StatCard label="Falhas" value={stats.failed} />
      </Stack>

      {/* Previsão: só faz sentido enquanto há trabalho pendente. */}
      {pendingMsgs > 0 && (
        <Card variant="outlined" sx={{ mb: 3, bgcolor: "#F0FDF4", borderColor: "#86EFAC" }}>
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Typography variant="body2">
              📅 Ao ritmo atual ({capPerDay} msgs/dia útil), restam <strong>~{daysToFinish}
              {" "}dia{daysToFinish !== 1 ? "s úteis" : " útil"}</strong> pra despachar todos
              os {pendingMsgs} envios pendentes ({campaign.leads_enrolled} leads × {campaign.cadence_days.length} toques).
              {" "}A campanha continua de onde parou todo dia dentro da janela definida.
            </Typography>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Templates" />
        <Tab label="Enroll Leads" />
        <Tab label="Acompanhamento" />
        <Tab label="Analytics" />
      </Tabs>

      {tab === 0 && <TemplatesTab campaignId={cid} cadenceLen={campaign.cadence_days.length} />}
      {tab === 1 && <EnrollTab campaignId={cid} />}
      {tab === 2 && <AcompanhamentoTab campaignId={cid} cadenceLen={campaign.cadence_days.length} />}
      {tab === 3 && <AnalyticsTab stats={stats} campaign={campaign} />}

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        campaign={campaign}
      />
    </Box>
  );
}

// ════════════════════════════════════════════════════════════════
// Acompanhamento tab — lead-por-lead da campanha (paginado + filtros)
// ════════════════════════════════════════════════════════════════

const PHASE_LABELS: Record<string, { label: string; color: "default" | "info" | "success" | "warning" | "error" }> = {
  prospecting: { label: "Em prospecção", color: "info" },
  qualifying:  { label: "Qualificando",  color: "info" },
  discovery:   { label: "Descoberta",    color: "info" },
  scheduling:  { label: "Agendando",     color: "warning" },
  scheduled:   { label: "Reunião marcada", color: "success" },
  recovering:  { label: "Reativando",    color: "warning" },
  human:       { label: "Humano assumiu", color: "default" },
  won:         { label: "Ganhou",        color: "success" },
  lost:        { label: "Perdido",       color: "error" },
  paused:      { label: "Pausado",       color: "default" },
};

function AcompanhamentoTab({ campaignId, cadenceLen }: { campaignId: number; cadenceLen: number }) {
  const PAGE_SIZE = 100;
  const [offset, setOffset] = useState(0);
  const [phaseFilter, setPhaseFilter] = useState<string>("");
  const [touchFilter, setTouchFilter] = useState<string>("");

  // touch_index é number, mas o select aceita "" como "todos"
  const touchIndex = touchFilter === "" ? undefined : Number(touchFilter);

  const { data, isLoading, isFetching, refetch } = useCampaignLeads(campaignId, {
    status: phaseFilter || undefined,
    touchIndex,
    offset,
    limit: PAGE_SIZE,
  });

  const total = data?.total ?? 0;
  const leads = data?.leads ?? [];
  const pageStart = total > 0 ? offset + 1 : 0;
  const pageEnd = Math.min(offset + leads.length, total);

  const resetAndFilter = (next: () => void) => {
    setOffset(0);
    next();
  };

  return (
    <Stack spacing={2}>
      {/* Filtros */}
      <Card variant="outlined">
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Fase do lead
              </Typography>
              <Select
                size="small"
                value={phaseFilter}
                onChange={(e) => resetAndFilter(() => setPhaseFilter(e.target.value))}
                displayEmpty
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="">Todas as fases</MenuItem>
                {Object.entries(PHASE_LABELS).map(([k, v]) => (
                  <MenuItem key={k} value={k}>{v.label}</MenuItem>
                ))}
              </Select>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Recebeu o toque
              </Typography>
              <Select
                size="small"
                value={touchFilter}
                onChange={(e) => resetAndFilter(() => setTouchFilter(e.target.value))}
                displayEmpty
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">Qualquer toque</MenuItem>
                {Array.from({ length: cadenceLen }, (_, i) => (
                  <MenuItem key={i} value={String(i)}>{i === 0 ? "D0 (abertura)" : `t${i}`}</MenuItem>
                ))}
              </Select>
            </Box>
            <Box flex={1} />
            <Box textAlign="right">
              <Typography variant="caption" color="text.secondary">
                {total > 0
                  ? `${pageStart}–${pageEnd} de ${total} lead${total > 1 ? "s" : ""}`
                  : "Nenhum lead encontrado"}
              </Typography>
              <Box>
                <Button size="small" onClick={() => refetch()} disabled={isFetching}>
                  {isFetching ? "Atualizando…" : "Atualizar"}
                </Button>
              </Box>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Tabela */}
      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={28} />
        </Box>
      ) : leads.length === 0 ? (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="body2" color="text.secondary" align="center">
              {phaseFilter || touchFilter
                ? "Nenhum lead bate com esses filtros."
                : "Nenhum lead enrolled nesta campanha ainda. Suba uma planilha na aba 'Enroll Leads'."}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Card variant="outlined" sx={{ overflow: "hidden" }}>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Lead</TableCell>
                  <TableCell>Telefone</TableCell>
                  <TableCell>Fase</TableCell>
                  <TableCell align="center">Toques</TableCell>
                  <TableCell align="center">Último envio</TableCell>
                  <TableCell align="center">Resp.</TableCell>
                  <TableCell align="center">Falhas</TableCell>
                  <TableCell>Próxima ação</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {leads.map((l) => (
                  <LeadRow key={`${l.phone}-${l.instance}`} lead={l} />
                ))}
              </TableBody>
            </Table>
          </Box>
        </Card>
      )}

      {/* Paginação */}
      {total > PAGE_SIZE && (
        <Stack direction="row" justifyContent="center" spacing={1}>
          <Button
            size="small"
            disabled={offset === 0 || isFetching}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            ← Anterior
          </Button>
          <Button
            size="small"
            disabled={offset + PAGE_SIZE >= total || isFetching}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Próxima →
          </Button>
        </Stack>
      )}
    </Stack>
  );
}

function LeadRow({ lead }: { lead: CampaignLeadRow }) {
  const phaseMeta = PHASE_LABELS[lead.phase] ?? { label: lead.phase, color: "default" as const };
  const lastSent = lead.last_sent_at ? new Date(lead.last_sent_at) : null;
  const nextAt = lead.next_action_at ? new Date(lead.next_action_at) : null;
  const fmt = (d: Date | null) =>
    d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " +
        d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <TableRow hover>
      <TableCell>
        <Stack>
          <Typography variant="body2" fontWeight={600}>
            {lead.nome || "(sem nome)"}
          </Typography>
          {lead.empresa && (
            <Typography variant="caption" color="text.secondary">
              {lead.empresa}{lead.cargo ? ` · ${lead.cargo}` : ""}
            </Typography>
          )}
        </Stack>
      </TableCell>
      <TableCell>
        <Typography variant="caption" fontFamily="monospace">{lead.phone}</Typography>
      </TableCell>
      <TableCell>
        <Chip label={phaseMeta.label} color={phaseMeta.color} size="small" />
      </TableCell>
      <TableCell align="center">
        <Typography variant="body2" fontWeight={600}>{lead.sent_count}</Typography>
        {lead.last_touch_index !== null && (
          <Typography variant="caption" color="text.secondary">
            último: {lead.last_touch_index === 0 ? "D0" : `t${lead.last_touch_index}`}
          </Typography>
        )}
      </TableCell>
      <TableCell align="center">
        <Typography variant="caption">{fmt(lastSent)}</Typography>
      </TableCell>
      <TableCell align="center">
        {lead.responded_count > 0
          ? <Chip label={lead.responded_count} color="success" size="small" />
          : <Typography variant="caption" color="text.secondary">—</Typography>}
      </TableCell>
      <TableCell align="center">
        {lead.failed_count > 0
          ? <Chip label={lead.failed_count} color="error" size="small" />
          : <Typography variant="caption" color="text.secondary">—</Typography>}
      </TableCell>
      <TableCell>
        {lead.next_action ? (
          <Stack>
            <Typography variant="caption">{lead.next_action}</Typography>
            <Typography variant="caption" color="text.secondary">{fmt(nextAt)}</Typography>
          </Stack>
        ) : (
          <Typography variant="caption" color="text.secondary">—</Typography>
        )}
      </TableCell>
    </TableRow>
  );
}

// ════════════════════════════════════════════════════════════════
// Settings dialog — PATCH cap, ritmo e janela depois de criada
// ════════════════════════════════════════════════════════════════

function SettingsDialog({
  open, onClose, campaign,
}: {
  open: boolean;
  onClose: () => void;
  campaign: WhatsAppCampaign;
}) {
  const updateMut = useUpdateWhatsAppCampaign();

  // Estado local inicializado do campaign. Reset via key quando abre — useState
  // com initializer só roda no mount, então depende do remount via Dialog.
  const [cap, setCap] = useState(campaign.daily_cap_per_instance);
  const [minMin, setMinMin] = useState(
    campaign.min_interval_seconds != null ? Math.round(campaign.min_interval_seconds / 60) : 8
  );
  const [maxMin, setMaxMin] = useState(
    campaign.max_interval_seconds != null ? Math.round(campaign.max_interval_seconds / 60) : 25
  );
  const [sendWindow, setSendWindow] = useState<SendWindow>(campaign.send_window ?? DEFAULT_WINDOW);

  const intervalValid = minMin >= 0 && maxMin > minMin;
  const windowValid = sendWindow.weekdays.length >= 1 && sendWindow.start_hour < sendWindow.end_hour;
  const canSave = intervalValid && windowValid && cap > 0;

  const handleSave = () => {
    updateMut.mutate(
      {
        id: campaign.id,
        patch: {
          daily_cap_per_instance: cap,
          min_interval_seconds: minMin * 60,
          max_interval_seconds: maxMin * 60,
          send_window: sendWindow,
        },
      },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Configurações da campanha</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField
            label="Cap diário por instância"
            type="number"
            value={cap}
            onChange={(e) => setCap(Math.max(1, parseInt(e.target.value, 10) || 1))}
            inputProps={{ min: 1, max: 500 }}
            helperText="Máximo de mensagens enviadas por dia útil em cada número. 30 é conservador."
            size="small"
          />

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} mb={1}>
                Ritmo entre mensagens
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                Intervalo aleatório entre cada envio. Mari Brain precisa respeitar pra ter efeito.
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Mínimo (min)"
                  type="number"
                  value={minMin}
                  onChange={(e) => setMinMin(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  inputProps={{ min: 0, max: 240 }}
                  sx={{ width: 140 }}
                  size="small"
                  error={!intervalValid}
                />
                <TextField
                  label="Máximo (min)"
                  type="number"
                  value={maxMin}
                  onChange={(e) => setMaxMin(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  inputProps={{ min: 1, max: 480 }}
                  sx={{ width: 140 }}
                  size="small"
                  error={!intervalValid}
                  helperText={!intervalValid ? "Máximo > mínimo" : ""}
                />
              </Stack>
            </CardContent>
          </Card>

          <SendWindowEditor value={sendWindow} onChange={setSendWindow} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!canSave || updateMut.isPending}
          sx={{ bgcolor: "#25D366", "&:hover": { bgcolor: "#1ebd5a" } }}
        >
          {updateMut.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card sx={{ flex: 1, minWidth: 160 }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h4" fontWeight={700}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════
// Templates tab
// ════════════════════════════════════════════════════════════════

function TemplatesTab({ campaignId, cadenceLen }: { campaignId: number; cadenceLen: number }) {
  const { data: templates, isLoading } = useTemplates(campaignId);
  const createMut = useCreateTemplate();
  const updateMut = useUpdateTemplate();
  const deleteMut = useDeleteTemplate();
  const [editing, setEditing] = useState<OutboundTemplate | null>(null);
  const [openNew, setOpenNew] = useState<number | null>(null); // touch_index
  const [seeding, setSeeding] = useState(false);

  const byTouch = useMemo(() => {
    const m = new Map<number, OutboundTemplate[]>();
    (templates ?? []).forEach((t) => {
      const arr = m.get(t.touch_index) ?? [];
      arr.push(t);
      m.set(t.touch_index, arr);
    });
    return m;
  }, [templates]);

  /**
   * Carrega templates default pros touches que estão SEM template hoje.
   * Útil pra campanha antiga que foi criada antes da feature de auto-seed, ou
   * quando o user apagou tudo e quer recomeçar do exemplo.
   */
  const seedMissingDefaults = async () => {
    setSeeding(true);
    try {
      const defaults = getDefaultTemplatesForCadence(cadenceLen);
      let created = 0;
      for (const tpl of defaults) {
        if ((byTouch.get(tpl.touch_index) ?? []).length > 0) continue;
        try {
          await createMut.mutateAsync({
            campaignId,
            payload: {
              touch_index: tpl.touch_index,
              body: tpl.body,
              vars: tpl.vars,
              ab_weight: 1,
              active: true,
              notes: tpl.notes,
            },
          });
          created += 1;
        } catch { /* hook já avisou */ }
      }
      if (created > 0) {
        toast.success(`${created} template${created > 1 ? "s" : ""} de exemplo carregado${created > 1 ? "s" : ""}.`);
      } else {
        toast.info("Todos os touches já têm template — nada a carregar.");
      }
    } finally {
      setSeeding(false);
    }
  };

  if (isLoading) return <CircularProgress />;

  const hasAny = (templates?.length ?? 0) > 0;
  const missingCount = Array.from({ length: cadenceLen }, (_, i) => i)
    .filter((idx) => (byTouch.get(idx) ?? []).length === 0).length;

  return (
    <Stack spacing={2}>
      {/* Banner explicando templates de exemplo */}
      {missingCount > 0 && (
        <Card sx={{ bgcolor: "#FFF9E6", border: "1px solid #F0D67E" }}>
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <MagicIcon sx={{ color: "#B45309" }} />
              <Box flex={1}>
                <Typography variant="body2" fontWeight={600}>
                  {hasAny
                    ? `${missingCount} touch${missingCount > 1 ? "es estão" : " está"} sem template`
                    : "Nenhum template carregado ainda"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  A gente pode preencher com exemplos prontos (voz Mari Pinn, em PT-BR) — você edita o texto antes de ativar a campanha.
                </Typography>
              </Box>
              <Button
                variant="contained"
                size="small"
                startIcon={<MagicIcon />}
                onClick={seedMissingDefaults}
                disabled={seeding}
                sx={{ bgcolor: "#B45309", "&:hover": { bgcolor: "#92400E" }, whiteSpace: "nowrap" }}
              >
                {seeding ? "Carregando..." : "Carregar exemplos"}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {Array.from({ length: cadenceLen }, (_, i) => i).map((idx) => {
        const items = byTouch.get(idx) ?? [];
        return (
          <Card key={idx}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="h6">Touch {idx === 0 ? "D0 (abertura)" : `t${idx}`}</Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setOpenNew(idx)}
                  sx={{ color: GREEN }}
                >
                  Adicionar template
                </Button>
              </Stack>
              {items.length === 0 && (
                <Typography variant="caption" color="error">
                  Sem template ativo. A campanha não pode enrollar leads enquanto este touch estiver vazio.
                </Typography>
              )}
              {items.map((t) => (
                <Box key={t.id} sx={{ p: 1.5, mb: 1, bgcolor: "background.default", borderRadius: 1, border: 1, borderColor: t.active ? "divider" : "warning.light" }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box flex={1}>
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{t.body}</Typography>
                      <Stack direction="row" spacing={1} mt={1}>
                        <Chip size="small" label={`A/B peso ${t.ab_weight}`} />
                        {!t.active && <Chip size="small" label="Inativo" color="warning" />}
                        {t.vars.length > 0 && (
                          <Chip size="small" label={`vars: ${t.vars.join(", ")}`} variant="outlined" />
                        )}
                      </Stack>
                    </Box>
                    <Stack direction="row">
                      <Tooltip title="Editar"><IconButton size="small" onClick={() => setEditing(t)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Remover"><IconButton size="small" onClick={() => deleteMut.mutate({ templateId: t.id, campaignId })}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {/* Dialog: criar template */}
      <TemplateDialog
        open={openNew !== null}
        onClose={() => setOpenNew(null)}
        touchIndex={openNew ?? 0}
        onSubmit={(body, vars, weight) => {
          createMut.mutate(
            {
              campaignId,
              payload: { touch_index: openNew ?? 0, body, vars, ab_weight: weight, active: true },
            },
            { onSuccess: () => setOpenNew(null) }
          );
        }}
      />

      {/* Dialog: editar template */}
      <TemplateDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        touchIndex={editing?.touch_index ?? 0}
        initialBody={editing?.body}
        initialVars={editing?.vars}
        initialWeight={editing?.ab_weight}
        onSubmit={(body, vars, weight) => {
          if (!editing) return;
          updateMut.mutate(
            { templateId: editing.id, campaignId, patch: { body, vars, ab_weight: weight } },
            { onSuccess: () => setEditing(null) }
          );
        }}
      />
    </Stack>
  );
}

function TemplateDialog({
  open, onClose, touchIndex, initialBody = "", initialVars = [], initialWeight = 1, onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  touchIndex: number;
  initialBody?: string;
  initialVars?: string[];
  initialWeight?: number;
  onSubmit: (body: string, vars: string[], weight: number) => void;
}) {
  const [body, setBody] = useState(initialBody);
  const [vars, setVars] = useState(initialVars.join(", "));
  const [weight, setWeight] = useState(initialWeight);

  // Reset quando abre
  useMemo(() => {
    if (open) {
      setBody(initialBody);
      setVars(initialVars.join(", "));
      setWeight(initialWeight);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Template do touch {touchIndex === 0 ? "D0 (abertura)" : `t${touchIndex}`}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField
            label="Mensagem"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            multiline
            rows={6}
            fullWidth
            helperText="Use {{nome}} {{empresa}} {{cargo}} pra personalização. Outras vars do brief também funcionam."
          />
          <TextField
            label="Variáveis (separadas por vírgula)"
            value={vars}
            onChange={(e) => setVars(e.target.value)}
            fullWidth
            helperText="Ex: nome, empresa, cargo. Documentação pra UI (engine ignora — preenche o que existir)."
          />
          <TextField
            label="Peso A/B"
            type="number"
            value={weight}
            onChange={(e) => setWeight(Math.max(1, parseInt(e.target.value, 10) || 1))}
            inputProps={{ min: 1, max: 100 }}
            sx={{ width: 160 }}
            helperText="Maior = mais provável de ser escolhido"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => onSubmit(body, vars.split(",").map((s) => s.trim()).filter(Boolean), weight)}
          disabled={!body.trim()}
          sx={{ bgcolor: GREEN, "&:hover": { bgcolor: "#1ebd5a" } }}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════
// Enroll tab
// ════════════════════════════════════════════════════════════════

function EnrollTab({ campaignId }: { campaignId: number }) {
  const enrollMut = useEnrollLeads();

  const handleEnroll = async (leads: LeadEnrollIn[]) => {
    await enrollMut.mutateAsync({ campaignId, payload: { leads } });
  };

  return <CsvUploader onEnroll={handleEnroll} submitting={enrollMut.isPending} />;
}

// ════════════════════════════════════════════════════════════════
// Analytics tab
// ════════════════════════════════════════════════════════════════

function AnalyticsTab({
  stats, campaign,
}: {
  stats: { total: number; sent: number; responded: number; failed: number };
  campaign: { leads_enrolled: number; leads_responded: number };
}) {
  const respRate = campaign.leads_enrolled > 0
    ? ((campaign.leads_responded / campaign.leads_enrolled) * 100).toFixed(1)
    : "0";
  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Typography variant="h6" mb={2}>Funil da campanha</Typography>
          <Stack spacing={2}>
            <FunnelLine label="Enrolled" value={campaign.leads_enrolled} max={campaign.leads_enrolled} />
            <FunnelLine label="Enviados (dispatch_log)" value={stats.sent} max={campaign.leads_enrolled} />
            <FunnelLine label="Respondidos" value={campaign.leads_responded} max={campaign.leads_enrolled} />
            <FunnelLine label="Falhas" value={stats.failed} max={campaign.leads_enrolled} color="error" />
          </Stack>
          <Typography variant="caption" color="text.secondary" mt={2} display="block">
            Taxa de resposta: <strong>{respRate}%</strong>
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}

function FunnelLine({ label, value, max, color = "success" }: {
  label: string; value: number; max: number; color?: "success" | "error" | "info";
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const bgColor = color === "error" ? "#fca5a5" : color === "info" ? "#93c5fd" : "#86efac";
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" mb={0.5}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" fontWeight={600}>{value}</Typography>
      </Stack>
      <Box sx={{ height: 8, bgcolor: "background.default", borderRadius: 1, overflow: "hidden" }}>
        <Box sx={{ width: `${pct}%`, height: "100%", bgcolor: bgColor, transition: "width 0.3s" }} />
      </Box>
    </Box>
  );
}
