/** Hook de analytics da campanha (E2 — Brick G). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { eoApi } from "../api";

const key = (campaignId: string | undefined) =>
  ["eo-campaign-analytics", campaignId] as const;

export const useCampaignAnalytics = (campaignId: string | undefined) =>
  useQuery({
    queryKey: key(campaignId),
    queryFn: () => eoApi.getCampaignAnalytics(campaignId!),
    enabled: !!campaignId,
    refetchInterval: 30_000, // auto-refresh enquanto a tab está aberta
  });

export const useTriggerSequencer = (campaignId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => eoApi.tickSequencer(),
    onSuccess: (r) => {
      toast.success(
        `Tick: ${r.enrolled} enrolled · ${r.sent} sent · ${r.failed} failed`,
      );
      // Invalida analytics + leads + queue
      qc.invalidateQueries({ queryKey: key(campaignId) });
      qc.invalidateQueries({ queryKey: ["eo-campaign-leads", campaignId] });
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao disparar."),
  });
};
