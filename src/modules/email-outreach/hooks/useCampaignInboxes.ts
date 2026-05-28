/** Hooks de inboxes anexadas à campanha (E2 — Brick D). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { eoApi } from "../api";

const key = (campaignId: string | undefined) =>
  ["eo-campaign-inboxes", campaignId] as const;

export const useCampaignInboxes = (campaignId: string | undefined) =>
  useQuery({
    queryKey: key(campaignId),
    queryFn: () => eoApi.listCampaignInboxes(campaignId!),
    enabled: !!campaignId,
  });

export const useAttachInbox = (campaignId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ inboxId, weight }: { inboxId: string; weight?: number }) =>
      eoApi.attachInbox(campaignId!, inboxId, weight ?? 1),
    onSuccess: () => {
      toast.success("Inbox anexada.");
      qc.invalidateQueries({ queryKey: key(campaignId) });
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao anexar."),
  });
};

export const useUpdateCampaignInboxWeight = (campaignId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ inboxId, weight }: { inboxId: string; weight: number }) =>
      eoApi.updateCampaignInbox(campaignId!, inboxId, weight),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(campaignId) });
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao atualizar peso."),
  });
};

export const useDetachInbox = (campaignId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inboxId: string) => eoApi.detachInbox(campaignId!, inboxId),
    onSuccess: () => {
      toast.success("Inbox desanexada.");
      qc.invalidateQueries({ queryKey: key(campaignId) });
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao desanexar."),
  });
};
