/** Hooks de leads + enrollment (E2 — Brick C). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { eoApi } from "../api";
import type {
  CampaignLead,
  LeadBulkImportPayload,
  LeadCreatePayload,
} from "../types";

const leadsKey = (orgId: string | undefined) => ["eo-leads", orgId] as const;
const campaignLeadsKey = (campaignId: string | undefined) =>
  ["eo-campaign-leads", campaignId] as const;

export const useLeads = (orgId: string | undefined, status?: string) =>
  useQuery({
    queryKey: ["eo-leads", orgId, status ?? "all"] as const,
    queryFn: () => eoApi.listLeads(orgId!, { status, limit: 1000 }),
    enabled: !!orgId,
    staleTime: 30_000,
  });

export const useCreateLead = (orgId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: LeadCreatePayload) => eoApi.createLead(orgId!, payload),
    onSuccess: () => {
      toast.success("Lead criado.");
      qc.invalidateQueries({ queryKey: leadsKey(orgId) });
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao criar lead."),
  });
};

export const useBulkImportLeads = (orgId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: LeadBulkImportPayload) => eoApi.bulkImportLeads(orgId!, payload),
    onSuccess: (result) => {
      toast.success(
        `Import: ${result.inserted} novos, ${result.updated} atualizados, ${result.skipped} ignorados.`,
      );
      qc.invalidateQueries({ queryKey: leadsKey(orgId) });
    },
    onError: (err: Error) => toast.error(err.message || "Falha no import."),
  });
};

export const useDeleteLead = (orgId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => eoApi.deleteLead(leadId),
    onSuccess: () => {
      toast.success("Lead removido.");
      qc.invalidateQueries({ queryKey: leadsKey(orgId) });
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao remover."),
  });
};

// ── Enrollment ──────────────────────────────────────────────────────────

export const useCampaignLeads = (campaignId: string | undefined) =>
  useQuery({
    queryKey: campaignLeadsKey(campaignId),
    queryFn: () => eoApi.listCampaignLeads(campaignId!),
    enabled: !!campaignId,
  });

export const useEnrollLeads = (campaignId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadIds: string[]) => eoApi.enrollLeads(campaignId!, leadIds),
    onSuccess: (result: CampaignLead[]) => {
      toast.success(`${result.length} lead${result.length === 1 ? "" : "s"} inscrito${result.length === 1 ? "" : "s"}.`);
      qc.invalidateQueries({ queryKey: campaignLeadsKey(campaignId) });
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao inscrever."),
  });
};

export const useUnenrollLead = (campaignId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (campaignLeadId: string) => eoApi.unenrollLead(campaignId!, campaignLeadId),
    onSuccess: () => {
      toast.success("Lead removido da campanha.");
      qc.invalidateQueries({ queryKey: campaignLeadsKey(campaignId) });
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao remover."),
  });
};
