/** Hooks de campanhas do módulo Email Outreach (E2 — Brick A). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { eoApi } from "../api";
import type { Campaign, CampaignCreatePayload, CampaignUpdatePayload } from "../types";

const listKey = (orgId: string | undefined) => ["eo-campaigns", orgId] as const;
const detailKey = (campaignId: string | undefined) =>
  ["eo-campaign", campaignId] as const;

export const useCampaigns = (orgId: string | undefined) =>
  useQuery({
    queryKey: listKey(orgId),
    queryFn: () => eoApi.listCampaigns(orgId!),
    enabled: !!orgId,
    staleTime: 30_000,
  });

export const useCampaign = (campaignId: string | undefined) =>
  useQuery({
    queryKey: detailKey(campaignId),
    queryFn: () => eoApi.getCampaign(campaignId!),
    enabled: !!campaignId,
  });

export const useCreateCampaign = (orgId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<CampaignCreatePayload, "org_id">) =>
      eoApi.createCampaign({ ...payload, org_id: orgId! }),
    onSuccess: (created) => {
      toast.success(`Campanha "${created.name}" criada.`);
      qc.invalidateQueries({ queryKey: listKey(orgId) });
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao criar campanha."),
  });
};

export const useUpdateCampaign = (orgId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CampaignUpdatePayload }) =>
      eoApi.updateCampaign(id, patch),
    onSuccess: (updated: Campaign) => {
      qc.setQueryData<Campaign[]>(listKey(orgId), (prev) =>
        prev?.map((c) => (c.id === updated.id ? updated : c)) ?? [updated],
      );
      qc.setQueryData(detailKey(updated.id), updated);
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao atualizar campanha."),
  });
};

export const useDeleteCampaign = (orgId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eoApi.deleteCampaign(id),
    onSuccess: () => {
      toast.success("Campanha removida.");
      qc.invalidateQueries({ queryKey: listKey(orgId) });
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao remover."),
  });
};
