/**
 * Wizard "Cadência de 3 emails" — Pinn Smart.
 *
 * Cria de uma vez 3 sequence steps padronizados pela arquitetura mais comum
 * de cold outreach B2B:
 *
 *   1. ABERTURA   (Day 0, sem thread anterior — primeiro contato)
 *   2. FOLLOW-UP  (Day +2, responde thread — bump curto)
 *   3. FECHAMENTO (Day +5, responde thread — "breakup email")
 *
 * O usuário edita livremente subject + body de cada um, ajusta delays se
 * quiser, e clica "Criar cadência" → faz 3 POSTs em sequência pro backend.
 *
 * Prévia ao vivo lado-a-lado: cada card mostra como o email vai chegar
 * ao destinatário (incluindo assinatura da inbox anexada à campanha).
 * Renderização espelha `email_outreach/templating.py::render_email_body`.
 */
import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AutoAwesome as AutoAwesomeIcon,
  Close as CloseIcon,
  Reply as ReplyIcon,
  Schedule as ScheduleIcon,
  Send as SendIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from "@mui/icons-material";

import type { Inbox, SequenceStepCreatePayload } from "../types";
import {
  DEFAULT_LEAD_VARS,
  previewEmailHtml,
  previewSubject,
} from "../utils/previewEmailHtml";

const ORANGE = "#F97316";

interface StepDraft {
  label: string;
  subject: string;
  body: string;
  delay_days: number;
  delay_hours: number;
  is_reply_to_previous: boolean;
}

const DEFAULT_STEPS: StepDraft[] = [
  {
    label: "Abertura",
    subject: "",
    body: "",
    delay_days: 0,
    delay_hours: 0,
    is_reply_to_previous: false,
  },
  {
    label: "Follow-up",
    subject: "",
    body: "",
    delay_days: 2,
    delay_hours: 0,
    is_reply_to_previous: true,
  },
  {
    label: "Fechamento",
    subject: "",
    body: "",
    delay_days: 3,
    delay_hours: 0,
    is_reply_to_previous: true,
  },
];

const HINTS: Record<string, string> = {
  Abertura:
    "Primeira mensagem da sequência. Sem 'Re:' — usa subject novo. Apresentação curta + observação contextual + 1 pergunta no final.",
  "Follow-up":
    "Vira 'Re: <subject anterior>' (mantém thread). Texto curto: 2-4 linhas. Reforça o pedido ou traz ângulo diferente.",
  Fechamento:
    "Último email. Tom de 'breakup': diz que não vai insistir mais e deixa porta aberta. Comprovadamente alto reply rate.",
};

function delayLabel(days: number, hours: number, isFirst: boolean): string {
  if (isFirst) return "Imediato";
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  return parts.length ? `+${parts.join(" ")} após o anterior` : "Imediato";
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Inbox preferencial pra prévia da assinatura. Se null, prévia sem assinatura. */
  previewInbox: Inbox | null;
  /** Cria 1 step. Chamado 3x em sequência pelo wizard. */
  createStep: (payload: SequenceStepCreatePayload) => Promise<unknown>;
  /** Avisa o pai quando terminou pra ele fechar/refetchar. */
  onCreated?: () => void;
}

export function ThreeStepCadenceWizard({
  open,
  onClose,
  previewInbox,
  createStep,
  onCreated,
}: Props) {
  const [steps, setSteps] = useState<StepDraft[]>(() =>
    DEFAULT_STEPS.map((s) => ({ ...s })),
  );
  const [showPreview, setShowPreview] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStep = (idx: number, patch: Partial<StepDraft>) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const reset = () => {
    setSteps(DEFAULT_STEPS.map((s) => ({ ...s })));
    setError(null);
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const allValid = useMemo(
    () => steps.every((s) => s.subject.trim() && s.body.trim()),
    [steps],
  );

  const handleSubmit = async () => {
    if (!allValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        await createStep({
          step_order: i + 1,
          variant_label: "A",
          delay_days: s.delay_days,
          delay_hours: s.delay_hours,
          subject_template: s.subject,
          body_template: s.body,
          is_reply_to_previous: s.is_reply_to_previous,
          weight: 1,
        });
      }
      onCreated?.();
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar steps.");
      setSubmitting(false);
    }
  };

  // Subject "espelho" usado nos cards 2 e 3 pra simular o "Re: <abertura>".
  const replySubjectPreview = steps[0].subject
    ? `Re: ${previewSubject(steps[0].subject)}`
    : "Re: (subject da abertura)";

  return (
    <Dialog open={open} onClose={handleClose} fullScreen>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <AutoAwesomeIcon sx={{ color: ORANGE }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Cadência de 3 emails
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Abertura · Follow-up · Fechamento — todos na mesma thread Gmail
          </Typography>
        </Box>
        <Tooltip title={showPreview ? "Ocultar prévia" : "Mostrar prévia"}>
          <IconButton onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? <VisibilityOffIcon /> : <VisibilityIcon />}
          </IconButton>
        </Tooltip>
        <IconButton onClick={handleClose} disabled={submitting}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: "background.default", p: { xs: 2, md: 3 } }}>
        {!previewInbox && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Anexe uma inbox à campanha antes de criar a cadência — a prévia
            usa a assinatura dela e o sequencer precisa dela pra enviar.
          </Alert>
        )}

        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          alignItems="stretch"
        >
          {steps.map((step, idx) => {
            const isFirst = idx === 0;
            const previewSubjectStr = step.is_reply_to_previous
              ? replySubjectPreview
              : previewSubject(step.subject || "(sem assunto)");
            const previewBodyHtml = previewEmailHtml(step.body, {
              inbox: previewInbox,
              leadVars: DEFAULT_LEAD_VARS,
            });

            return (
              <Paper
                key={idx}
                variant="outlined"
                sx={{
                  flex: 1,
                  borderTop: 4,
                  borderTopColor: ORANGE,
                  display: "flex",
                  flexDirection: "column",
                  minWidth: 0,
                }}
              >
                {/* Header do card */}
                <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ mb: 0.5 }}
                  >
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: 1,
                        bgcolor: `${ORANGE}22`,
                        color: ORANGE,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {idx + 1}
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {step.label}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      icon={<ScheduleIcon />}
                      label={delayLabel(step.delay_days, step.delay_hours, isFirst)}
                      variant="outlined"
                    />
                    {step.is_reply_to_previous && (
                      <Chip
                        size="small"
                        icon={<ReplyIcon />}
                        label="Responde anterior"
                        variant="outlined"
                      />
                    )}
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 1 }}
                  >
                    {HINTS[step.label]}
                  </Typography>
                </Box>

                {/* Editor */}
                <Box sx={{ p: 2 }}>
                  {!isFirst && (
                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                      <TextField
                        label="Dias"
                        type="number"
                        size="small"
                        value={step.delay_days}
                        onChange={(e) =>
                          updateStep(idx, {
                            delay_days: Math.max(
                              0,
                              parseInt(e.target.value) || 0,
                            ),
                          })
                        }
                        inputProps={{ min: 0, max: 90 }}
                        sx={{ width: 90 }}
                      />
                      <TextField
                        label="Horas"
                        type="number"
                        size="small"
                        value={step.delay_hours}
                        onChange={(e) =>
                          updateStep(idx, {
                            delay_hours: Math.max(
                              0,
                              parseInt(e.target.value) || 0,
                            ),
                          })
                        }
                        inputProps={{ min: 0, max: 23 }}
                        sx={{ width: 90 }}
                      />
                    </Stack>
                  )}

                  {!step.is_reply_to_previous && (
                    <TextField
                      label="Assunto"
                      fullWidth
                      size="small"
                      value={step.subject}
                      onChange={(e) => updateStep(idx, { subject: e.target.value })}
                      placeholder="Ex: {{company}} — ideia rápida sobre operação comercial"
                      sx={{ mb: 2 }}
                    />
                  )}
                  {step.is_reply_to_previous && (
                    <>
                      <TextField
                        label="Assunto (interno)"
                        fullWidth
                        size="small"
                        value={step.subject}
                        onChange={(e) => updateStep(idx, { subject: e.target.value })}
                        placeholder="Subject pro registro (Gmail vai mostrar 'Re: ...' da abertura)"
                        sx={{ mb: 2 }}
                        helperText="O Gmail mostra como 'Re:' do assunto da abertura, então este campo é só pro seu controle interno."
                      />
                    </>
                  )}

                  <TextField
                    label="Corpo (texto puro ou HTML)"
                    fullWidth
                    multiline
                    minRows={9}
                    value={step.body}
                    onChange={(e) => updateStep(idx, { body: e.target.value })}
                    placeholder={
                      isFirst
                        ? "Olá {{first_name}},\n\nObservei que a {{company}}...\n\nFaz sentido conversar?"
                        : idx === 1
                          ? "Oi {{first_name}}, voltei aqui — qualquer 30 min na semana que vem funciona?"
                          : "Sem retorno até aqui — vou pausar minhas mensagens.\n\nSe fizer sentido no futuro, é só responder este email."
                    }
                    helperText="Variáveis: {{first_name}} {{last_name}} {{company}} {{title}} {{custom.X}} · Quebras duplas viram parágrafos"
                    InputProps={{ sx: { fontFamily: "monospace", fontSize: 13 } }}
                  />
                </Box>

                {/* Prévia */}
                {showPreview && (
                  <Box
                    sx={{
                      borderTop: 1,
                      borderColor: "divider",
                      bgcolor: "#FFFBF5",
                      p: 2,
                      flex: 1,
                    }}
                  >
                    <Typography
                      variant="overline"
                      color="text.secondary"
                      sx={{ fontWeight: 700 }}
                    >
                      Prévia
                    </Typography>
                    <Box
                      sx={{
                        mt: 1,
                        bgcolor: "white",
                        border: 1,
                        borderColor: "divider",
                        borderRadius: 1,
                        p: 2,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="baseline"
                        sx={{ mb: 1.5 }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ minWidth: 60 }}
                        >
                          De:
                        </Typography>
                        <Typography variant="caption">
                          {previewInbox?.display_name || previewInbox?.email || "(sem inbox)"}
                        </Typography>
                      </Stack>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="baseline"
                        sx={{ mb: 1.5 }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ minWidth: 60 }}
                        >
                          Para:
                        </Typography>
                        <Typography variant="caption">
                          {DEFAULT_LEAD_VARS.first_name}{" "}
                          {DEFAULT_LEAD_VARS.last_name}{" "}
                          &lt;{DEFAULT_LEAD_VARS.email}&gt;
                        </Typography>
                      </Stack>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="baseline"
                        sx={{ mb: 1.5 }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ minWidth: 60 }}
                        >
                          Assunto:
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {previewSubjectStr}
                        </Typography>
                      </Stack>
                      <Divider sx={{ my: 1.5 }} />
                      {step.body.trim() ? (
                        <Box
                          dangerouslySetInnerHTML={{ __html: previewBodyHtml }}
                          sx={{
                            "& p": { wordBreak: "break-word" },
                            "& a": { color: "#1d4ed8" },
                          }}
                        />
                      ) : (
                        <Typography
                          variant="caption"
                          color="text.disabled"
                          sx={{ fontStyle: "italic" }}
                        >
                          Escreva o corpo no campo acima pra ver a prévia.
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
              </Paper>
            );
          })}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Box sx={{ flex: 1 }}>
          {error && (
            <Alert severity="error" sx={{ py: 0 }}>
              {error}
            </Alert>
          )}
          {!allValid && !error && (
            <Typography variant="caption" color="text.secondary">
              Preencha assunto e corpo dos 3 emails pra ativar o botão.
            </Typography>
          )}
        </Box>
        <Button onClick={handleClose} disabled={submitting}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          startIcon={
            submitting ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <SendIcon />
            )
          }
          onClick={handleSubmit}
          disabled={!allValid || submitting}
          sx={{ bgcolor: ORANGE, "&:hover": { bgcolor: "#EA580C" } }}
        >
          Criar cadência (3 steps)
        </Button>
      </DialogActions>
    </Dialog>
  );
}
