/**
 * Email Outreach — Inboxes (E1 / EO-004)
 *
 * Página de gestão das caixas de envio conectadas ao motor de cold email
 * próprio do BAI. Permite:
 *   - conectar Gmail via OAuth (popup)
 *   - cadastrar SMTP/IMAP manualmente
 *   - listar, pausar/reativar, ajustar limite diário, rodar healthcheck
 *   - remover inbox
 *
 * Próxima sprint (E2) adiciona campanhas e disparos a partir destas inboxes.
 */
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Alert,
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
  Menu,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  Bolt as BoltIcon,
  Check as CheckIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Email as EmailIcon,
  MoreVert as MoreIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
  Send as SendIcon,
} from "@mui/icons-material";

import { useAuth } from "@/contexts/AuthContext";
import {
  useConnectGmail,
  useCreateSmtpInbox,
  useDeleteInbox,
  useHealthcheckInbox,
  useInboxes,
  useUpdateInbox,
} from "@/modules/email-outreach/hooks/useInboxes";
import type { Inbox, InboxStatus } from "@/modules/email-outreach/types";

const ORANGE = "#F97316";

const STATUS_LABEL: Record<InboxStatus, string> = {
  active: "Ativa",
  paused: "Pausada",
  disconnected: "Desconectada",
  warming: "Em warmup",
  error: "Erro",
};

const STATUS_COLOR: Record<InboxStatus, "success" | "warning" | "default" | "info" | "error"> = {
  active: "success",
  paused: "warning",
  disconnected: "default",
  warming: "info",
  error: "error",
};

const PROVIDER_LABEL: Record<Inbox["provider"], string> = {
  gmail: "Gmail",
  outlook: "Outlook",
  smtp: "SMTP",
  ses: "AWS SES",
};

// ─── Página ──────────────────────────────────────────────────────────────────

const EmailOutreachInboxes = () => {
  const { orgId } = useParams();
  const { profile } = useAuth();

  const inboxesQuery = useInboxes(orgId);
  const connectGmail = useConnectGmail(orgId, profile?.user_id);
  const updateInbox = useUpdateInbox(orgId);
  const deleteInbox = useDeleteInbox(orgId);
  const healthcheck = useHealthcheckInbox(orgId);

  const [smtpOpen, setSmtpOpen] = useState(false);
  const [signatureFor, setSignatureFor] = useState<Inbox | null>(null);

  const summary = useMemo(() => {
    const inboxes = inboxesQuery.data ?? [];
    return {
      total: inboxes.length,
      active: inboxes.filter((i) => i.status === "active").length,
      warming: inboxes.filter((i) => i.status === "warming").length,
      dailyCapacity: inboxes
        .filter((i) => i.status === "active" || i.status === "warming")
        .reduce((acc, i) => acc + i.daily_limit, 0),
    };
  }, [inboxesQuery.data]);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: "auto" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Pinn Smart · Inboxes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Conecte as caixas de envio que servirão de remetente nas campanhas de cold email.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<EmailIcon />}
            onClick={() => setSmtpOpen(true)}
          >
            Adicionar SMTP
          </Button>
          <Button
            variant="contained"
            startIcon={connectGmail.isPending ? <CircularProgress size={16} color="inherit" /> : <BoltIcon />}
            disabled={connectGmail.isPending || !orgId}
            onClick={() => connectGmail.mutate()}
            sx={{ bgcolor: ORANGE, "&:hover": { bgcolor: "#EA580C" } }}
          >
            Conectar Gmail
          </Button>
        </Stack>
      </Stack>

      {/* Cards de resumo */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={3}>
        <SummaryCard label="Inboxes conectadas" value={summary.total} />
        <SummaryCard label="Ativas" value={summary.active} accent="success" />
        <SummaryCard label="Em warmup" value={summary.warming} accent="info" />
        <SummaryCard
          label="Capacidade diária"
          value={`${summary.dailyCapacity.toLocaleString("pt-BR")} emails`}
          accent="orange"
        />
      </Stack>

      {/* Tabela */}
      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          {inboxesQuery.isLoading ? (
            <Box sx={{ p: 6, textAlign: "center" }}>
              <CircularProgress />
            </Box>
          ) : inboxesQuery.isError ? (
            <Box sx={{ p: 3 }}>
              <Alert severity="error">
                Falha ao carregar inboxes: {(inboxesQuery.error as Error).message}
              </Alert>
            </Box>
          ) : (inboxesQuery.data ?? []).length === 0 ? (
            <EmptyState onConnect={() => connectGmail.mutate()} />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Provider</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Limite/dia</TableCell>
                  <TableCell align="right">Warmup score</TableCell>
                  <TableCell>Último check</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inboxesQuery.data!.map((inbox) => (
                  <InboxRow
                    key={inbox.id}
                    inbox={inbox}
                    onToggleStatus={() =>
                      updateInbox.mutate({
                        id: inbox.id,
                        patch: { status: inbox.status === "active" ? "paused" : "active" },
                      })
                    }
                    onLimitChange={(limit) =>
                      updateInbox.mutate({ id: inbox.id, patch: { daily_limit: limit } })
                    }
                    onHealthcheck={() => healthcheck.mutate(inbox.id)}
                    onEditSignature={() => setSignatureFor(inbox)}
                    onDelete={() => {
                      if (confirm(`Remover ${inbox.email}? Essa ação não pode ser desfeita.`)) {
                        deleteInbox.mutate(inbox.id);
                      }
                    }}
                    healthchecking={healthcheck.isPending && healthcheck.variables === inbox.id}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SmtpDialog open={smtpOpen} onClose={() => setSmtpOpen(false)} orgId={orgId} />

      <SignatureDialog
        inbox={signatureFor}
        onClose={() => setSignatureFor(null)}
        onSave={async (patch) => {
          if (!signatureFor) return;
          await updateInbox.mutateAsync({ id: signatureFor.id, patch });
          setSignatureFor(null);
        }}
        saving={updateInbox.isPending}
      />
    </Box>
  );
};

// ─── Subcomponentes ──────────────────────────────────────────────────────────

const SummaryCard = ({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "success" | "info" | "orange";
}) => {
  const color =
    accent === "success"
      ? "#10B981"
      : accent === "info"
      ? "#3B82F6"
      : accent === "orange"
      ? ORANGE
      : "text.primary";
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 0 }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.6 }}>
          {label}
        </Typography>
        <Typography variant="h5" fontWeight={700} sx={{ color, mt: 0.5 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
};

const InboxRow = ({
  inbox,
  onToggleStatus,
  onLimitChange,
  onHealthcheck,
  onEditSignature,
  onDelete,
  healthchecking,
}: {
  inbox: Inbox;
  onToggleStatus: () => void;
  onLimitChange: (limit: number) => void;
  onHealthcheck: () => void;
  onEditSignature: () => void;
  onDelete: () => void;
  healthchecking: boolean;
}) => {
  const hasSignature = Boolean(
    inbox.signature_name ||
      inbox.signature_role ||
      inbox.signature_company ||
      inbox.signature_phone ||
      inbox.signature_link ||
      inbox.signature_html,
  );
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null);
  const [editingLimit, setEditingLimit] = useState(false);
  const [draftLimit, setDraftLimit] = useState(inbox.daily_limit);

  return (
    <TableRow hover>
      <TableCell>
        <Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" fontWeight={600}>
              {inbox.email}
            </Typography>
            {!hasSignature && (
              <Tooltip title="Sem assinatura. Clique no menu (⋮) → Configurar assinatura.">
                <Chip size="small" color="warning" variant="outlined" label="sem assinatura" />
              </Tooltip>
            )}
          </Stack>
          {inbox.display_name && inbox.display_name !== inbox.email && (
            <Typography variant="caption" color="text.secondary">
              {inbox.display_name}
            </Typography>
          )}
        </Stack>
      </TableCell>
      <TableCell>
        <Chip size="small" label={PROVIDER_LABEL[inbox.provider]} />
      </TableCell>
      <TableCell>
        <Chip
          size="small"
          color={STATUS_COLOR[inbox.status]}
          label={STATUS_LABEL[inbox.status]}
          variant={inbox.status === "active" ? "filled" : "outlined"}
        />
        {inbox.last_health_error && (
          <Tooltip title={inbox.last_health_error}>
            <Chip size="small" color="error" label="erro" sx={{ ml: 1 }} />
          </Tooltip>
        )}
      </TableCell>
      <TableCell align="right">
        {editingLimit ? (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
            <TextField
              size="small"
              type="number"
              value={draftLimit}
              onChange={(e) => setDraftLimit(Number(e.target.value))}
              inputProps={{ min: 1, max: 2000 }}
              sx={{ width: 90 }}
            />
            <IconButton
              size="small"
              color="primary"
              onClick={() => {
                onLimitChange(draftLimit);
                setEditingLimit(false);
              }}
            >
              <CheckIcon fontSize="small" />
            </IconButton>
          </Stack>
        ) : (
          <Tooltip title="Clique para editar">
            <Typography
              variant="body2"
              sx={{ cursor: "pointer", "&:hover": { color: ORANGE } }}
              onClick={() => {
                setDraftLimit(inbox.daily_limit);
                setEditingLimit(true);
              }}
            >
              {inbox.daily_limit}
            </Typography>
          </Tooltip>
        )}
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" color={inbox.warmup_score > 50 ? "success.main" : "text.secondary"}>
          {inbox.warmup_score.toFixed(0)} / 100
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="caption" color="text.secondary">
          {inbox.last_health_check_at
            ? new Date(inbox.last_health_check_at).toLocaleString("pt-BR")
            : "—"}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          <Tooltip title="Testar conexão agora">
            <IconButton size="small" onClick={onHealthcheck} disabled={healthchecking}>
              {healthchecking ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title={inbox.status === "active" ? "Pausar envios" : "Reativar"}>
            <IconButton size="small" onClick={onToggleStatus}>
              {inbox.status === "active" ? (
                <PauseIcon fontSize="small" />
              ) : (
                <PlayIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={(e) => setMenuEl(e.currentTarget)}>
            <MoreIcon fontSize="small" />
          </IconButton>
          <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
            <MenuItem
              onClick={() => {
                setMenuEl(null);
                onEditSignature();
              }}
            >
              <EditIcon fontSize="small" sx={{ mr: 1 }} />
              {hasSignature ? "Editar assinatura" : "Configurar assinatura"}
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuEl(null);
                onDelete();
              }}
              sx={{ color: "error.main" }}
            >
              <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
              Remover inbox
            </MenuItem>
          </Menu>
        </Stack>
      </TableCell>
    </TableRow>
  );
};

const EmptyState = ({ onConnect }: { onConnect: () => void }) => (
  <Box sx={{ p: 6, textAlign: "center" }}>
    <SendIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
    <Typography variant="h6" gutterBottom>
      Nenhuma inbox conectada ainda
    </Typography>
    <Typography variant="body2" color="text.secondary" mb={2}>
      Conecte um Gmail ou cadastre uma conta SMTP para começar a enviar campanhas.
    </Typography>
    <Button
      variant="contained"
      startIcon={<BoltIcon />}
      onClick={onConnect}
      sx={{ bgcolor: ORANGE, "&:hover": { bgcolor: "#EA580C" } }}
    >
      Conectar primeira inbox (Gmail)
    </Button>
  </Box>
);

// ─── Dialog SMTP ─────────────────────────────────────────────────────────────

const SmtpDialog = ({
  open,
  onClose,
  orgId,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string | undefined;
}) => {
  const create = useCreateSmtpInbox(orgId);
  const [form, setForm] = useState({
    email: "",
    display_name: "",
    smtp_host: "",
    smtp_port: 587,
    smtp_username: "",
    smtp_password: "",
    imap_host: "",
    imap_port: 993,
    daily_limit: 50,
  });

  const submit = async () => {
    await create.mutateAsync(form);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Adicionar inbox SMTP/IMAP</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            fullWidth
            required
          />
          <TextField
            label="Nome de exibição"
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="SMTP host"
              value={form.smtp_host}
              onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Porta"
              type="number"
              value={form.smtp_port}
              onChange={(e) => setForm({ ...form, smtp_port: Number(e.target.value) })}
              sx={{ width: 100 }}
            />
          </Stack>
          <TextField
            label="Usuário SMTP"
            value={form.smtp_username}
            onChange={(e) => setForm({ ...form, smtp_username: e.target.value })}
            fullWidth
            required
          />
          <TextField
            label="Senha SMTP"
            type="password"
            value={form.smtp_password}
            onChange={(e) => setForm({ ...form, smtp_password: e.target.value })}
            fullWidth
            required
            helperText="Armazenada criptografada (Fernet AES-128)."
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="IMAP host"
              value={form.imap_host}
              onChange={(e) => setForm({ ...form, imap_host: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Porta"
              type="number"
              value={form.imap_port}
              onChange={(e) => setForm({ ...form, imap_port: Number(e.target.value) })}
              sx={{ width: 100 }}
            />
          </Stack>
          <TextField
            label="Limite diário"
            type="number"
            value={form.daily_limit}
            onChange={(e) => setForm({ ...form, daily_limit: Number(e.target.value) })}
            inputProps={{ min: 1, max: 2000 }}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          startIcon={create.isPending ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
          onClick={submit}
          disabled={create.isPending || !form.email || !form.smtp_host || !form.smtp_username}
          sx={{ bgcolor: ORANGE, "&:hover": { bgcolor: "#EA580C" } }}
        >
          Adicionar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Dialog Assinatura ───────────────────────────────────────────────────────

const SignatureDialog = ({
  inbox,
  onClose,
  onSave,
  saving,
}: {
  inbox: Inbox | null;
  onClose: () => void;
  onSave: (patch: {
    signature_name?: string;
    signature_role?: string;
    signature_company?: string;
    signature_phone?: string;
    signature_link?: string;
  }) => Promise<void>;
  saving: boolean;
}) => {
  const [form, setForm] = useState({
    signature_name: "",
    signature_role: "",
    signature_company: "",
    signature_phone: "",
    signature_link: "",
  });

  // Re-hidrata o form sempre que o dialog abre com uma inbox nova.
  useMemo(() => {
    if (!inbox) return;
    setForm({
      signature_name: inbox.signature_name ?? "",
      signature_role: inbox.signature_role ?? "",
      signature_company: inbox.signature_company ?? "",
      signature_phone: inbox.signature_phone ?? "",
      signature_link: inbox.signature_link ?? "",
    });
  }, [inbox?.id]);

  const previewLines: string[] = [];
  if (form.signature_name) previewLines.push(form.signature_name);
  const roleCompany = [form.signature_role, form.signature_company].filter(Boolean).join(" · ");
  if (roleCompany) previewLines.push(roleCompany);
  if (form.signature_phone) previewLines.push(form.signature_phone);
  if (form.signature_link) previewLines.push(form.signature_link);

  return (
    <Dialog open={!!inbox} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Assinatura de email
        {inbox && (
          <Typography variant="caption" display="block" color="text.secondary">
            {inbox.email}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <Alert severity="info" variant="outlined" sx={{ fontSize: 13 }}>
            Aplicada automaticamente no rodapé de todo email enviado a partir desta inbox.
            Estilo "plain-like" — sem cores fortes ou imagens, pra não cair em spam.
          </Alert>
          <TextField
            label="Nome"
            placeholder="Pedro Henrique"
            value={form.signature_name}
            onChange={(e) => setForm({ ...form, signature_name: e.target.value })}
            inputProps={{ maxLength: 120 }}
            fullWidth
            autoFocus
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Cargo"
              placeholder="CTO"
              value={form.signature_role}
              onChange={(e) => setForm({ ...form, signature_role: e.target.value })}
              inputProps={{ maxLength: 120 }}
              fullWidth
            />
            <TextField
              label="Empresa"
              placeholder="Pinn"
              value={form.signature_company}
              onChange={(e) => setForm({ ...form, signature_company: e.target.value })}
              inputProps={{ maxLength: 120 }}
              fullWidth
            />
          </Stack>
          <TextField
            label="Telefone (opcional)"
            placeholder="+55 11 99999-9999"
            value={form.signature_phone}
            onChange={(e) => setForm({ ...form, signature_phone: e.target.value })}
            inputProps={{ maxLength: 60 }}
            fullWidth
          />
          <TextField
            label="Link / site (opcional)"
            placeholder="pinnpb.com"
            value={form.signature_link}
            onChange={(e) => setForm({ ...form, signature_link: e.target.value })}
            inputProps={{ maxLength: 500 }}
            fullWidth
          />

          {previewLines.length > 0 && (
            <Box
              sx={{
                mt: 1,
                p: 2,
                borderTop: "1px solid",
                borderColor: "divider",
                bgcolor: "background.default",
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                Prévia da assinatura:
              </Typography>
              <Stack spacing={0.25} sx={{ fontFamily: "system-ui, sans-serif", fontSize: 14, color: "text.secondary" }}>
                {previewLines.map((line, idx) => (
                  <Typography
                    key={idx}
                    variant="body2"
                    sx={{
                      fontWeight: idx === 0 ? 600 : 400,
                      color: idx === 0 ? "text.primary" : "text.secondary",
                    }}
                  >
                    {line}
                  </Typography>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <CheckIcon />}
          onClick={() => onSave(form)}
          disabled={saving}
          sx={{ bgcolor: ORANGE, "&:hover": { bgcolor: "#EA580C" } }}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EmailOutreachInboxes;
