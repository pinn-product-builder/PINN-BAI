import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_PLANS, type Plan } from '@/lib/plans';

const PLANS_QUERY_KEY = ['platform-plans'];

// A tabela `plans` foi adicionada via migration nova — ainda não está
// presente no `Database` type gerado. Cast para `any` é proposital aqui:
// é o ponto único de acesso e fica restrito à API tipada exposta abaixo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const plansTable = () => (supabase as any).from('plans');

export const usePlans = () => {
  return useQuery({
    queryKey: PLANS_QUERY_KEY,
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await plansTable()
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        // Fallback silencioso pra UI não quebrar caso a migration ainda
        // não tenha rodado no ambiente atual.
        // eslint-disable-next-line no-console
        console.warn('[usePlans] Falling back to DEFAULT_PLANS:', error.message);
        return DEFAULT_PLANS;
      }

      const rows = (data ?? []) as Plan[];
      return rows.length > 0 ? rows : DEFAULT_PLANS;
    },
    staleTime: 5 * 60 * 1000,
  });
};

/** Apenas planos ativos — usado nos selects de criação de organização. */
export const useActivePlans = () => {
  const query = usePlans();
  return {
    ...query,
    data: query.data?.filter((p) => p.is_active) ?? [],
  };
};

interface UpdatePlanInput {
  id: number;
  name?: string;
  full_name?: string;
  description?: string;
  is_active?: boolean;
  sort_order?: number;
}

export const useUpdatePlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdatePlanInput) => {
      const { error } = await plansTable().update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLANS_QUERY_KEY });
    },
  });
};

export const useDeletePlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await plansTable().delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLANS_QUERY_KEY });
    },
  });
};

interface CreatePlanInput {
  name: string;
  full_name: string;
  description: string;
  is_active?: boolean;
}

export const useCreatePlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePlanInput): Promise<Plan> => {
      // Próximo id disponível — convenção simples (incrementa do maior).
      const { data: existing, error: listError } = await plansTable()
        .select('id, sort_order')
        .order('id', { ascending: false })
        .limit(1);
      if (listError) throw listError;

      const rows = (existing ?? []) as Pick<Plan, 'id' | 'sort_order'>[];
      const nextId = (rows[0]?.id ?? 0) + 1;
      const nextOrder = (rows[0]?.sort_order ?? 0) + 1;

      const { data, error } = await plansTable()
        .insert({
          id: nextId,
          name: input.name,
          full_name: input.full_name,
          description: input.description,
          is_active: input.is_active ?? true,
          sort_order: nextOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Plan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLANS_QUERY_KEY });
    },
  });
};
