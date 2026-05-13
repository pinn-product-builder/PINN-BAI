import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PINN_PB_ORG_NAME_LIKE } from '@/lib/featureFlags';

interface UseIsPinnPBResult {
  isPinnPB: boolean;
  pinnPBOrgId: string | null;
  isLoading: boolean;
}

// Cache em memória do orgId do Pinn Product Builder — evita refazer a query
// toda vez que o ClientLayout monta. O ID muda muito raramente (provavelmente nunca).
let cachedPinnPBOrgId: string | null | undefined;

async function fetchPinnPBOrgId(): Promise<string | null> {
  if (cachedPinnPBOrgId !== undefined) return cachedPinnPBOrgId;
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .ilike('name', PINN_PB_ORG_NAME_LIKE)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('useIsPinnProductBuilderOrg: lookup falhou', error);
    cachedPinnPBOrgId = null;
    return null;
  }
  cachedPinnPBOrgId = data?.id ?? null;
  return cachedPinnPBOrgId;
}

/**
 * Identifica se a org corrente é a "Pinn Product Builder" (a org interna
 * que hospeda as telas Pinn SDR / LinkedIn SDR como abas).
 */
export function useIsPinnProductBuilderOrg(orgId?: string | null): UseIsPinnPBResult {
  const { data: pinnPBOrgId, isLoading } = useQuery({
    queryKey: ['pinn-pb-org-id'],
    queryFn: fetchPinnPBOrgId,
    staleTime: Infinity,
  });

  return {
    isPinnPB: !!orgId && !!pinnPBOrgId && orgId === pinnPBOrgId,
    pinnPBOrgId: pinnPBOrgId ?? null,
    isLoading,
  };
}
