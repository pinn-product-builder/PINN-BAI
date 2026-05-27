/** Hook pra listar instâncias Evolution + health. */

import { useQuery } from "@tanstack/react-query";

import { waApi } from "../api";

export function useInstances() {
  return useQuery({
    queryKey: ["whatsapp", "instances"],
    queryFn: () => waApi.listInstances(),
    staleTime: 15_000,           // health muda rápido — refetch a cada 15s
    refetchInterval: 30_000,     // poll a cada 30s na tela aberta
  });
}
