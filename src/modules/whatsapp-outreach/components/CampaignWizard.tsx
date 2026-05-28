/**
 * CampaignWizard — criação de campanha em 4 steps (inspirado em WATI/Octadesk).
 *
 *  1. Nome + ICP/Value Prop (contexto)
 *  2. Números (instâncias Evolution) + Rotação + Cap
 *  3. Cadência (D0/D2/D5/D9 customizável) + Janela de envio
 *  4. Resumo + Criar (status=draft, templates ficam pra depois no detalhe)
 *
 * Após criação, redireciona pro detalhe pra adicionar templates antes de enrollar.
 */
import { useState } from "react";
import {
  Box, Button, Card, CardContent, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, Stack, Step, StepLabel,
  Stepper, TextField, Typography,
} from "@mui/material";
import {
  ArrowBack as BackIcon, ArrowForward as NextIcon, Check as CheckIcon,
  Close as CloseIcon,
} from "@mui/icons-material";

import type { CampaignCreatePayload, SendWindow } from "../types";
import { InstancePicker } from "./InstancePicker";
import { SendWindowEditor } from "./SendWindowEditor";

const STEPS = ["Contexto", "Números", "Cadência & Janela", "Revisão"];

const DEFAULT_WINDOW: SendWindow = {
  weekdays: [1, 2, 3, 4, 5],
  start_hour: 9,
  end_hour: 18,
  tz: "America/Sao_Paulo",
};

interface WizardProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CampaignCreatePayload) => Promise<void> | void;
  submitting: boolean;
}

export function CampaignWizard({ open, onClose, onSubmit, submitting }: WizardProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [icp, setIcp] = useState("");
  const [vp, setVp] = useState("");
  const [instances, setInstances] = useState<string[]>([]);
  const [rotation, setRotation] = useState(false);
  const [cap, setCap] = useState(30);
  const [cadenceStr, setCadenceStr] = useState("0,2,5,9");
  const [sendWindow, setSendWindow] = useState<SendWindow>(DEFAULT_WINDOW);

  const cadence = cadenceStr
    .split(",").map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n >= 0);

  // Validação por step
  const canAdvance = () => {
    if (step === 0) return name.trim().length >= 3;
    if (step === 1) return instances.length >= 1;
    if (step === 2) return cadence.length >= 1 && sendWindow.weekdays.length >= 1
      && sendWindow.start_hour < sendWindow.end_hour;
    return true;
  };

  const reset = () => {
    setStep(0); setName(""); setIcp(""); setVp("");
    setInstances([]); setRotation(false); setCap(30);
    setCadenceStr("0,2,5,9"); setSendWindow(DEFAULT_WINDOW);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    const payload: CampaignCreatePayload = {
      name: name.trim(),
      status: "draft",
      cadence_days: cadence,
      icp_description: icp.trim() || undefined,
      value_prop: vp.trim() || undefined,
      instances,
      instance: instances[0],
      instance_rotation: rotation,
      daily_cap_per_instance: cap,
      send_window: sendWindow,
    };
    await onSubmit(payload);
    reset();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h6">Nova campanha WhatsApp</Typography>
          <Typography variant="caption" color="text.secondary">
            Step {step + 1} de {STEPS.length}
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={step} sx={{ mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>

        {step === 0 && (
          <Stack spacing={2}>
            <TextField
              label="Nome da campanha"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="Ex: Cold E-commerce SP · Junho 2026"
              helperText={name.length > 0 && name.length < 3 ? "Mínimo 3 caracteres" : ""}
              error={name.length > 0 && name.length < 3}
            />
            <TextField
              label="ICP — Perfil de cliente ideal"
              value={icp}
              onChange={(e) => setIcp(e.target.value)}
              multiline rows={2}
              placeholder="Ex: Diretor comercial de e-commerce SP, 50-200 funcionários, faturamento R$ 5M-50M"
              helperText="Pra documentar — Mari usa pra contextualizar a abordagem"
            />
            <TextField
              label="Proposta de valor"
              value={vp}
              onChange={(e) => setVp(e.target.value)}
              multiline rows={2}
              placeholder="Ex: Pinn automatiza follow-up + qualificação 24/7. SDR humano fica pra fechar"
              helperText="O que a Pinn entrega pra esse ICP"
            />
          </Stack>
        )}

        {step === 1 && (
          <InstancePicker
            selected={instances}
            onChange={setInstances}
            rotation={rotation}
            onRotationChange={setRotation}
            capDaily={cap}
            onCapDailyChange={setCap}
          />
        )}

        {step === 2 && (
          <Stack spacing={2}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} mb={1}>
                  Cadência (dias relativos ao D0)
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                  Mari dispara nos índices indicados (D0 = primeiro touch, depois +N dias).
                  Cada touch precisará de pelo menos 1 template ativo antes de enrollar leads.
                </Typography>
                <TextField
                  label="Dias (separados por vírgula)"
                  value={cadenceStr}
                  onChange={(e) => setCadenceStr(e.target.value)}
                  fullWidth
                  helperText={`= ${cadence.length} touches: ${cadence.map((d) => `D${d}`).join(" → ")}`}
                />
              </CardContent>
            </Card>
            <SendWindowEditor value={sendWindow} onChange={setSendWindow} />
          </Stack>
        )}

        {step === 3 && (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} mb={2}>
                Revisão
              </Typography>
              <Stack spacing={1}>
                <Row label="Nome" value={name} />
                {icp && <Row label="ICP" value={icp} />}
                {vp && <Row label="Value prop" value={vp} />}
                <Row
                  label="Instâncias"
                  value={
                    <>
                      {instances.map((i) => (
                        <Chip key={i} label={i} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                      ))}
                      {rotation && <Chip label="Rotação ativa" size="small" color="success" sx={{ ml: 0.5 }} />}
                    </>
                  }
                />
                <Row label="Cap por número" value={`${cap}/dia (≈ ${cap * instances.length}/dia total)`} />
                <Row label="Cadência" value={cadence.map((d) => `D${d}`).join(" → ")} />
                <Row
                  label="Janela"
                  value={`${sendWindow.weekdays.length}d/semana · ${sendWindow.start_hour}h-${sendWindow.end_hour}h · ${sendWindow.tz}`}
                />
              </Stack>
              <Box mt={2} p={1.5} bgcolor="info.light" borderRadius={1}>
                <Typography variant="caption" color="info.dark">
                  ⚠️ Campanha será criada como <strong>rascunho</strong>. Você precisará adicionar templates
                  pra cada touch antes de enrollar leads. Mari valida isso no enroll.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {step > 0 && (
          <Button onClick={() => setStep(step - 1)} startIcon={<BackIcon />}>
            Voltar
          </Button>
        )}
        <Box flex={1} />
        {step < STEPS.length - 1 ? (
          <Button
            variant="contained"
            onClick={() => setStep(step + 1)}
            disabled={!canAdvance()}
            endIcon={<NextIcon />}
            sx={{ bgcolor: "#25D366", "&:hover": { bgcolor: "#1ebd5a" } }}
          >
            Próximo
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting}
            startIcon={<CheckIcon />}
            sx={{ bgcolor: "#25D366", "&:hover": { bgcolor: "#1ebd5a" } }}
          >
            {submitting ? "Criando…" : "Criar campanha"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={2} alignItems="flex-start">
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110, pt: 0.5 }}>
        {label}
      </Typography>
      <Box flex={1}>
        {typeof value === "string"
          ? <Typography variant="body2">{value}</Typography>
          : value}
      </Box>
    </Stack>
  );
}
