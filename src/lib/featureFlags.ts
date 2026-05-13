const RFM_CHURN_MODULE_ENABLED = true;

// IDs / slugs das orgs especiais. Single source of truth.
export const ARGUTO_ORG_ID = 'b72718e7-6a54-4ff8-9bbf-24d1573ddb43';
export const ARGUTO_ORG_SLUG = 'arguto';

// Pinn Product Builder hospeda as telas Pinn SDR / LinkedIn SDR como abas internas.
// O orgId real é descoberto via lookup `ilike(name, '%pinn%')` no Supabase em runtime
// (ver useIsPinnProductBuilderOrg) — o slug abaixo é só fallback semântico.
export const PINN_PB_ORG_NAME_LIKE = '%pinn%';

// Quando o módulo estiver pronto para rollout, manter o global true
// e liberar apenas as organizações dessa lista.
const RFM_CHURN_ALLOWED_ORG_IDS: string[] = [
  ARGUTO_ORG_ID, // Arguto · Demo (Desafio 1)
];

/**
 * Orgs em modo "demo" — usam scores pré-populados e não devem invocar
 * edge functions (calculate-rfm / predict-churn) que ainda não existem
 * em produção. Evita console.warn ruidoso durante reunião comercial.
 *
 * IDs hardcoded servem só de fallback — preferir detecção por slug
 * (DEMO_ORG_SLUGS) pra não quebrar quando UUID muda entre ambientes
 * (dev/staging/prod cada um cria um id próprio via seed).
 */
const DEMO_ORG_IDS: string[] = [
  ARGUTO_ORG_ID, // Arguto · Demo (id local de dev)
];

const DEMO_ORG_SLUGS: string[] = [ARGUTO_ORG_SLUG];

export const isRfmChurnEnabledForOrg = (orgId?: string | null): boolean => {
  if (!RFM_CHURN_MODULE_ENABLED) return false;
  if (!orgId) return false;
  if (RFM_CHURN_ALLOWED_ORG_IDS.length === 0) return false;
  return RFM_CHURN_ALLOWED_ORG_IDS.includes(orgId);
};

export const isRfmChurnEnabledForAdmin = (): boolean => RFM_CHURN_MODULE_ENABLED;

/**
 * Slug ativo da org, populado pelo OrganizationBrandingContext quando o
 * usuário entra numa org. Permite que hooks/util que só recebem orgId
 * detectem demo via slug — porque o UUID muda entre dev/staging/prod
 * (cada ambiente seeda Arguto com id próprio).
 */
declare global {
  interface Window {
    __pinnActiveOrgSlug?: string | null;
  }
}

export const setActiveOrgSlug = (slug?: string | null): void => {
  if (typeof window !== 'undefined') {
    window.__pinnActiveOrgSlug = slug ?? null;
  }
};

export const isDemoOrg = (orgId?: string | null): boolean => {
  if (!orgId) return false;
  if (DEMO_ORG_IDS.includes(orgId)) return true;
  // Fallback por slug — pega o UUID novo em ambientes onde Arguto foi seedada
  // com id diferente do hardcoded acima.
  if (typeof window !== 'undefined' && window.__pinnActiveOrgSlug) {
    return DEMO_ORG_SLUGS.includes(window.__pinnActiveOrgSlug);
  }
  return false;
};

export const isDemoSlug = (slug?: string | null): boolean => {
  if (!slug) return false;
  return DEMO_ORG_SLUGS.includes(slug);
};

/**
 * A aba "Arguto · BAI" é exclusiva do cliente Arguto. Para os demais clientes
 * ela some do menu lateral e o landing padrão passa de `/arguto` para `/dashboard`.
 * Usa o UUID hardcoded + fallback por slug (igual ao isDemoOrg) para sobreviver
 * a UUIDs diferentes entre dev/staging/prod.
 */
export const isArgutoOrg = (orgId?: string | null): boolean => {
  if (!orgId) return false;
  if (orgId === ARGUTO_ORG_ID) return true;
  if (typeof window !== 'undefined' && window.__pinnActiveOrgSlug) {
    return window.__pinnActiveOrgSlug === ARGUTO_ORG_SLUG;
  }
  return false;
};
