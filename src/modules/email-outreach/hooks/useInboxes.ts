import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { eoApi } from "../api";
import type { Inbox, InboxUpdatePayload, SmtpInboxCreatePayload } from "../types";

const inboxesKey = (orgId: string | undefined) => ["eo-inboxes", orgId] as const;

export const useInboxes = (orgId: string | undefined) =>
  useQuery({
    queryKey: inboxesKey(orgId),
    queryFn: () => eoApi.listInboxes(orgId!),
    enabled: !!orgId,
    staleTime: 30_000,
  });

export const useCreateSmtpInbox = (orgId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<SmtpInboxCreatePayload, "org_id">) =>
      eoApi.createSmtpInbox({ ...payload, org_id: orgId! }),
    onSuccess: () => {
      toast.success("Inbox SMTP conectada.");
      qc.invalidateQueries({ queryKey: inboxesKey(orgId) });
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao criar inbox."),
  });
};

export const useUpdateInbox = (orgId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: InboxUpdatePayload }) =>
      eoApi.updateInbox(id, patch),
    onSuccess: (updated: Inbox) => {
      qc.setQueryData<Inbox[]>(inboxesKey(orgId), (prev) =>
        prev?.map((i) => (i.id === updated.id ? updated : i)) ?? [updated],
      );
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao atualizar."),
  });
};

export const useDeleteInbox = (orgId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eoApi.deleteInbox(id),
    onSuccess: () => {
      toast.success("Inbox removida.");
      qc.invalidateQueries({ queryKey: inboxesKey(orgId) });
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao remover."),
  });
};

export const useHealthcheckInbox = (orgId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eoApi.healthcheckInbox(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inboxesKey(orgId) });
    },
    onError: (err: Error) => toast.error(err.message || "Falha no healthcheck."),
  });
};

/** Inicia OAuth Google em popup; ao concluir, refetch da lista. */
export const useConnectGmail = (orgId: string | undefined, userId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("orgId ausente.");
      const { authorization_url } = await eoApi.startGoogleOAuth(orgId, userId);
      const result = await eoApi.openOAuthPopup(authorization_url);
      if (!result.ok) throw new Error(result.error || "OAuth não concluído.");
      return result;
    },
    onSuccess: () => {
      toast.success("Gmail conectado!");
      qc.invalidateQueries({ queryKey: inboxesKey(orgId) });
    },
    onError: (err: Error) => toast.error(err.message),
  });
};
