/** Hooks de templates outbound via TanStack Query. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { waApi } from "../api";
import type {
  TemplateCreatePayload,
  TemplateUpdatePayload,
} from "../types";

const KEY = ["whatsapp", "templates"] as const;

export function useTemplates(campaignId: number | null,
                                opts?: { activeOnly?: boolean }) {
  return useQuery({
    queryKey: [...KEY, campaignId, opts?.activeOnly ?? false],
    queryFn: () => waApi.listTemplates(campaignId!, opts),
    enabled: campaignId !== null && Number.isFinite(campaignId),
    staleTime: 30_000,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, payload }: {
      campaignId: number;
      payload: TemplateCreatePayload;
    }) => waApi.createTemplate(campaignId, payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [...KEY, vars.campaignId] });
      qc.invalidateQueries({ queryKey: ["whatsapp", "campaigns"] });
      toast.success(`Template t${vars.payload.touch_index} adicionado`);
    },
    onError: (err: Error) => toast.error(`Falha: ${err.message}`),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, patch, campaignId }: {
      templateId: number;
      patch: TemplateUpdatePayload;
      campaignId: number;
    }) => waApi.updateTemplate(templateId, patch),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [...KEY, vars.campaignId] });
      toast.success("Template atualizado");
    },
    onError: (err: Error) => toast.error(`Falha: ${err.message}`),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId }: { templateId: number; campaignId: number }) =>
      waApi.deleteTemplate(templateId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [...KEY, vars.campaignId] });
      toast.success("Template removido");
    },
    onError: (err: Error) => toast.error(`Falha: ${err.message}`),
  });
}
