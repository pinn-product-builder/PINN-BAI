/** Hook pra enroll de leads em campanha (mutation). */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { waApi } from "../api";
import type { EnrollPayload } from "../types";

export function useEnrollLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, payload }: {
      campaignId: number;
      payload: EnrollPayload;
    }) => waApi.enrollLeads(campaignId, payload),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["whatsapp", "campaigns", vars.campaignId] });
      qc.invalidateQueries({ queryKey: ["whatsapp", "campaigns"] });
      if (data.enrolled > 0) {
        toast.success(
          `${data.enrolled} lead(s) enrolled${data.skipped > 0 ? ` · ${data.skipped} pulados` : ""}`
        );
      }
      if (data.errors.length > 0) {
        toast.warning(`${data.errors.length} erro(s) durante enroll`);
      }
      if (data.enrolled === 0 && data.skipped === 0) {
        toast.info("Nada pra enrollar (lista vazia ou todos já estavam na campanha)");
      }
    },
    onError: (err: Error) => toast.error(`Falha enroll: ${err.message}`),
  });
}
