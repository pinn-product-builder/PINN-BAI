import { useQuery } from "@tanstack/react-query";
import { waApi } from "../api";

export function useWhatsAppDashboard(days: number = 30) {
  return useQuery({
    queryKey: ["whatsapp", "dashboard", days],
    queryFn: () => waApi.getDashboard(days),
    staleTime: 30_000,
    refetchInterval: 60_000,  // refresh 1x/min na tela aberta
  });
}
