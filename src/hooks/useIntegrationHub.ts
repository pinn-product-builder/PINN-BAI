/**
 * Stub do hub de integrações — evita quebra do Vite quando o backend do hub ainda não está ligado.
 * Substitua por chamadas reais à API quando o serviço existir.
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import type { HubConnection, IntegrationProvider } from "@/lib/types";

export function useIntegrationProviders() {
  return useQuery<IntegrationProvider[]>({
    queryKey: ["integration-providers"],
    queryFn: async () => [],
    staleTime: Infinity,
  });
}

export function useHubConnections(orgId: string | undefined) {
  return useQuery<HubConnection[]>({
    queryKey: ["hub-connections", orgId],
    queryFn: async () => [],
    enabled: !!orgId,
    staleTime: Infinity,
  });
}

export function useHubConnect() {
  return useMutation({
    mutationFn: async (_args: {
      orgId: string;
      providerSlug: string;
      displayName: string;
      credentials: Record<string, string>;
    }) => {
      throw new Error("Hub de integrações não configurado neste ambiente de desenvolvimento.");
    },
  });
}

export function useHubDisconnect() {
  return useMutation({
    mutationFn: async (_args: { orgId: string; connectionId: string }) => {
      throw new Error("Hub de integrações não configurado neste ambiente de desenvolvimento.");
    },
  });
}
