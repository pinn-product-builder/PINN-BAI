import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mariSupabase } from '@/integrations/supabase/mariClient';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface HuntingConfig {
  max_invites_per_run: number;
  preferred_network_depth: '2' | '3';
  search_keywords: string[];
  target_titles: string[];
  excluded_titles: string[];
  target_sectors: string[];
}

export interface LinkedInProfile {
  id: string;
  profile_name: string;
  unipile_account_id: string;
  prompt_profile: string | null;
  hunting_config: HuntingConfig | null;
  is_active: boolean;
}

// ─── Defaults por perfil ──────────────────────────────────────────────────────

export const DEFAULT_HUNTING_CONFIG_RENAN: HuntingConfig = {
  max_invites_per_run: 20,
  preferred_network_depth: '2',
  search_keywords: [
    'CEO founder SaaS',
    'head de vendas tecnologia',
    'diretor comercial software',
    'VP sales B2B',
    'fundador startup tech',
  ],
  target_titles: [
    'CEO',
    'Founder',
    'Co-Founder',
    'Diretor Comercial',
    'VP de Vendas',
    'Head de Vendas',
    'Gerente Comercial',
    'CRO',
    'CSO',
  ],
  excluded_titles: [
    'estagiário',
    'assistente',
    'auxiliar',
    'analista júnior',
    'trainee',
    'bolsista',
  ],
  target_sectors: [
    'tecnologia',
    'saas',
    'software',
    'fintech',
    'healthtech',
    'edtech',
    'e-commerce',
    'marketplace',
  ],
};

export const DEFAULT_HUNTING_CONFIG_JAQUELINE: HuntingConfig = {
  max_invites_per_run: 25,
  preferred_network_depth: '2',
  search_keywords: [
    'diretor de marketing',
    'head de marketing B2B',
    'gerente de crescimento',
    'growth hacker',
    'CMO',
    'CEO PME',
    'sócio proprietário',
  ],
  target_titles: [
    'CEO',
    'Founder',
    'Co-Founder',
    'CMO',
    'Diretor de Marketing',
    'Head de Marketing',
    'Gerente de Growth',
    'Sócio Proprietário',
    'Presidente',
    'Diretor Geral',
  ],
  excluded_titles: [
    'estagiário',
    'assistente',
    'auxiliar',
    'analista júnior',
    'trainee',
    'bolsista',
    'coordenador júnior',
  ],
  target_sectors: [
    'tecnologia',
    'saas',
    'varejo',
    'serviços',
    'consultoria',
    'agência',
    'indústria',
    'saúde',
    'educação',
    'financeiro',
  ],
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useLinkedInProfiles = () => {
  return useQuery<LinkedInProfile[]>({
    queryKey: ['linkedin-profiles'],
    queryFn: async () => {
      if (!mariSupabase) return [];
      const { data, error } = await (mariSupabase as any)
        .from('linkedin_accounts')
        .select('id, profile_name, unipile_account_id, prompt_profile, hunting_config, is_active');
      if (error) {
        console.warn('[useLinkedInProfiles]', error.message ?? error);
        return [];
      }
      return (data ?? []) as LinkedInProfile[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useUpdateHuntingConfig = (accountId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config: HuntingConfig) => {
      if (!mariSupabase) throw new Error('Supabase da Mari não configurado');
      const { error } = await (mariSupabase as any)
        .from('linkedin_accounts')
        .update({ hunting_config: config })
        .eq('id', accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['linkedin-accounts'] });
    },
  });
};
