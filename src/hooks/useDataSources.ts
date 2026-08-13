/**
 * useDataSources — catálogo curado de fontes de dados de widgets
 * (tabela `dashboard_data_sources`). Admin gerencia em /admin/data-sources;
 * consumido pelo WidgetEditorDialog (datalist), DashboardAdminMenu
 * (availableTables da geração IA) e crm-auditor/AutoBuildDashboardDialog.
 *
 * Reconstruído fielmente a partir do bundle de produção
 * (dist/assets/index-*.js, build de 05/jul/2026).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DataSource {
  id: string;
  org_id: string | null;
  key: string;
  display_name: string;
  description: string | null;
  category: string | null;
  columns: string[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UpsertDataSourceInput {
  id?: string;
  org_id?: string | null;
  key: string;
  display_name: string;
  description?: string | null;
  category?: string | null;
  columns?: string[];
  is_active?: boolean;
}

const BASE_KEY = ["dashboard-data-sources"];

export function useDataSources(opts?: { orgId?: string | null; activeOnly?: boolean }) {
  const orgId = opts?.orgId ?? null;
  const activeOnly = opts?.activeOnly ?? true;
  return useQuery({
    queryKey: [...BASE_KEY, orgId, activeOnly],
    queryFn: async (): Promise<DataSource[]> => {
      // `dashboard_data_sources` não está nos types gerados do Supabase.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      let query = sb
        .from("dashboard_data_sources")
        .select("*")
        .order("category", { ascending: true })
        .order("display_name", { ascending: true });
      if (activeOnly) query = query.eq("is_active", true);
      // Fontes globais (org_id null) + específicas da org quando informada.
      if (orgId) query = query.or(`org_id.is.null,org_id.eq.${orgId}`);
      else query = query.is("org_id", null);
      const { data, error } = await query;
      if (error) {
        console.warn("[useDataSources] fetch falhou:", error.message);
        return [];
      }
      return (data ?? []) as DataSource[];
    },
  });
}

export function useUpsertDataSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertDataSourceInput) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const payload = {
        org_id: input.org_id ?? null,
        key: input.key,
        display_name: input.display_name,
        description: input.description ?? null,
        category: input.category ?? null,
        columns: input.columns ?? [],
        is_active: input.is_active ?? true,
      };
      if (input.id) {
        const { error } = await sb.from("dashboard_data_sources").update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("dashboard_data_sources").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BASE_KEY }),
  });
}

export function useDeleteDataSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { error } = await sb.from("dashboard_data_sources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BASE_KEY }),
  });
}
