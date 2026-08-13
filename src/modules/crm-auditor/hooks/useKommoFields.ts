/**
 * useKommoFields — catálogo de campos customizados do CRM (formato longo),
 * lido da view `vw_bai_crm_field_catalog` via edge `fetch-client-data`.
 * Alimenta as sugestões de widgets do AutoBuildDashboardDialog.
 *
 * Reconstruído fielmente a partir do bundle de produção
 * (dist/assets/index-*.js, build de 05/jul/2026).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KommoField {
  field_name: string;
  field_type: string;
  distinct_values: number;
  leads_with_field: number;
}

/**
 * Campo serve como dimensão de gráfico (pie/bar)? Exclui tipos de texto livre,
 * data e numéricos; exige cardinalidade útil (2–20 valores) e uso mínimo.
 */
export function isChartableDimension(field: KommoField): boolean {
  const type = (field.field_type || "").toLowerCase();
  if (["textarea", "text", "date", "date_time", "numeric", "url"].includes(type)) return false;
  return field.distinct_values >= 2 && field.distinct_values <= 20 && field.leads_with_field >= 3;
}

/** Campo checkbox com pelo menos 1 lead — vira metric_card de flag. */
export function isFlagDimension(field: KommoField): boolean {
  return (field.field_type || "").toLowerCase() === "checkbox" && field.leads_with_field >= 1;
}

export function useKommoFields(orgId: string | undefined) {
  return useQuery({
    queryKey: ["crm-auditor", orgId ?? "", "kommo-field-catalog"],
    queryFn: async (): Promise<KommoField[]> => {
      if (!orgId) return [];
      const { data, error } = await supabase.functions.invoke("fetch-client-data", {
        body: { orgId, tableName: "vw_bai_crm_field_catalog", limit: 200 },
      });
      if (error) throw error;
      const rows = ((data?.data ?? []) as KommoField[]);
      return rows.sort((a, b) => b.leads_with_field - a.leads_with_field);
    },
    enabled: !!orgId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
