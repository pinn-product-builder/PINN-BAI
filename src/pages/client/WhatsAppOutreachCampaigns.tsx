/**
 * WhatsApp Outreach — Campanhas
 *
 * Lista de campanhas + criação rápida (status=draft).
 * Detalhe (templates, leads, analytics) fica em /whatsapp-outreach/campaigns/:id.
 *
 * Mesmo padrão visual do EmailOutreachCampaigns.
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
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Visibility as ViewIcon,
} from "@mui/icons-material";

import {
  useCreateWhatsAppCampaign,
  useUpdateWhatsAppCampaign,
  useWhatsAppCampaigns,
} from "@/modules/whatsapp-outreach/hooks/useCampaigns";
import { useCreateTemplate } from "@/modules/whatsapp-outreach/hooks/useTemplates";
import { CampaignWizard } from "@/modules/whatsapp-outreach/components/CampaignWizard";
import { getDefaultTemplatesForCadence } from "@/modules/whatsapp-outreach/lib/defaultTemplates";
import type {
  CampaignStatus,
  WhatsAppCampaign,
} from "@/modules/whatsapp-outreach/types";
import { toast } from "sonner";

const GREEN = "#25D366"; // WhatsApp green
const ORANGE = "#F97316";

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  done: "Concluída",
};

const STATUS_COLOR: Record<CampaignStatus, "default" | "success" | "warning" | "info"> = {
  draft: "default",
  active: "success",
  paused: "warning",
  done: "info",
};

export default function WhatsAppOutreachCampaigns() {
  const navigate = useNavigate();
  const { orgId } = useParams<{ orgId: string }>();
  const { data: campaigns, isLoading, error } = useWhatsAppCampaigns();
  const createMutation = useCreateWhatsAppCampaign();
  const updateMutation = useUpdateWhatsAppCampaign();
  const createTemplateMutation = useCreateTemplate();

  const [openCreate, setOpenCreate] = useState(false);

  const sorted = useMemo(() => {
    if (!campaigns) return [];
    return [...campaigns].sort((a, b) => b.id - a.id);
  }, [campaigns]);

  const handleCreate = async (payload: import("@/modules/whatsapp-outreach/types").CampaignCreatePayload) => {
    try {
      const created = await createMutation.mutateAsync(payload);

      // Auto-seed templates default — 1 por touch da cadência, todos editáveis.
      // Falha silenciosa por template (toast individual já cobre): o user pode
      // simplesmente criar manual nos que faltarem.
      const cadenceLen = (payload.cadence_days ?? created.cadence_days).length;
      const defaults = getDefaultTemplatesForCadence(cadenceLen);
      let seeded = 0;
      for (const tpl of defaults) {
        try {
          await createTemplateMutation.mutateAsync({
            campaignId: created.id,
            payload: {
              touch_index: tpl.touch_index,
              body: tpl.body,
              vars: tpl.vars,
              ab_weight: 1,
              active: true,
              notes: tpl.notes,
            },
          });
          seeded += 1;
        } catch {
          /* hook já mostrou toast — segue pra próximo */
        }
      }
      if (seeded > 0) {
        toast.success(
          `${seeded} template${seeded > 1 ? "s" : ""} de exemplo carregado${seeded > 1 ? "s" : ""} — abra a campanha pra editar antes de enrollar leads.`,
          { duration: 6000 },
        );
      }

      setOpenCreate(false);
      navigate(`/client/${orgId}/whatsapp-outreach/campaigns/${created.id}`);
    } catch {
      /* toast já mostrou */
    }
  };

  const togglePause = (c: WhatsAppCampaign) => {
    const next = c.status === "active" ? "paused" : "active";
    updateMutation.mutate({ id: c.id, patch: { status: next } });
  };

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Pinn Whatsapp
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Campanhas de outbound ativo via WhatsApp. Templates 100% estáticos, cadência configurável.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenCreate(true)}
          sx={{ bgcolor: GREEN, "&:hover": { bgcolor: "#1ebd5a" } }}
        >
          Nova campanha
        </Button>
      </Stack>

      {error && (
        <Card sx={{ mb: 2, bgcolor: "error.light" }}>
          <CardContent>
            <Typography color="error">Falha ao carregar: {(error as Error).message}</Typography>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      )}

      {!isLoading && sorted.length === 0 && (
        <Card>
          <CardContent>
            <Typography variant="body1" color="text.secondary" align="center">
              Nenhuma campanha ainda. Clique em "Nova campanha" pra começar.
            </Typography>
          </CardContent>
        </Card>
      )}

      {!isLoading && sorted.length > 0 && (
        <Card>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Campanha</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Cadência</TableCell>
                <TableCell align="center">Enrolled</TableCell>
                <TableCell align="center">Respondidos</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell>
                    <Stack>
                      <Typography fontWeight={600}>{c.name}</Typography>
                      {c.icp_description && (
                        <Typography variant="caption" color="text.secondary">
                          {c.icp_description.slice(0, 80)}
                          {c.icp_description.length > 80 ? "…" : ""}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={STATUS_LABEL[c.status]}
                      color={STATUS_COLOR[c.status]}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="caption" fontFamily="monospace">
                      D{c.cadence_days.join("/D")}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">{c.leads_enrolled}</TableCell>
                  <TableCell align="center">{c.leads_responded}</TableCell>
                  <TableCell align="right">
                    <Tooltip title={c.status === "active" ? "Pausar" : "Ativar"}>
                      <IconButton
                        size="small"
                        onClick={() => togglePause(c)}
                        disabled={c.status === "done"}
                      >
                        {c.status === "active" ? <PauseIcon /> : <PlayIcon />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Detalhes">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/client/${orgId}/whatsapp-outreach/campaigns/${c.id}`)}
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Wizard 4-step */}
      <CampaignWizard
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onSubmit={handleCreate}
        submitting={createMutation.isPending}
      />
    </Box>
  );
}
