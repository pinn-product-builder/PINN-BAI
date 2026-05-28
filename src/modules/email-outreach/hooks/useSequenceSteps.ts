/** Hooks de sequence steps (E2 — Brick B). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { eoApi } from "../api";
import type {
  SequenceStep,
  SequenceStepCreatePayload,
  SequenceStepUpdatePayload,
} from "../types";

const stepsKey = (campaignId: string | undefined) =>
  ["eo-campaign-steps", campaignId] as const;

export const useSequenceSteps = (campaignId: string | undefined) =>
  useQuery({
    queryKey: stepsKey(campaignId),
    queryFn: () => eoApi.listSteps(campaignId!),
    enabled: !!campaignId,
  });

export const useCreateSequenceStep = (campaignId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SequenceStepCreatePayload) =>
      eoApi.createStep(campaignId!, payload),
    onSuccess: () => {
      toast.success("Step adicionado.");
      qc.invalidateQueries({ queryKey: stepsKey(campaignId) });
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao criar step."),
  });
};

export const useUpdateSequenceStep = (campaignId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: SequenceStepUpdatePayload }) =>
      eoApi.updateStep(campaignId!, id, patch),
    onSuccess: (updated: SequenceStep) => {
      qc.setQueryData<SequenceStep[]>(stepsKey(campaignId), (prev) =>
        prev?.map((s) => (s.id === updated.id ? updated : s)) ?? [updated],
      );
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao atualizar step."),
  });
};

export const useDeleteSequenceStep = (campaignId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stepId: string) => eoApi.deleteStep(campaignId!, stepId),
    onSuccess: () => {
      toast.success("Step removido.");
      qc.invalidateQueries({ queryKey: stepsKey(campaignId) });
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao remover step."),
  });
};
