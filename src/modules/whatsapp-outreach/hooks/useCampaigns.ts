/** Hooks de campanhas WhatsApp via TanStack Query. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { waApi } from "../api";
import type {
  CampaignCreatePayload,
  CampaignUpdatePayload,
} from "../types";

const KEY = ["whatsapp", "campaigns"] as const;

export function useWhatsAppCampaigns() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => waApi.listCampaigns(),
    staleTime: 30_000,
  });
}

export function useWhatsAppCampaign(campaignId: number | null) {
  return useQuery({
    queryKey: [...KEY, campaignId],
    queryFn: () => waApi.getCampaign(campaignId!),
    enabled: campaignId !== null && Number.isFinite(campaignId),
    staleTime: 10_000,
  });
}

export function useCreateWhatsAppCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CampaignCreatePayload) => waApi.createCampaign(payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success(`Campanha "${data.name}" criada (id=${data.id})`);
    },
    onError: (err: Error) => {
      toast.error(`Falha ao criar campanha: ${err.message}`);
    },
  });
}

export function useUpdateWhatsAppCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: CampaignUpdatePayload }) =>
      waApi.updateCampaign(id, patch),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, vars.id] });
      toast.success("Campanha atualizada");
    },
    onError: (err: Error) => toast.error(`Falha: ${err.message}`),
  });
}
