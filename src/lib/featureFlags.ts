const RFM_CHURN_MODULE_ENABLED = true;

// Quando o módulo estiver pronto para rollout, manter o global true
// e liberar apenas as organizações dessa lista.
const RFM_CHURN_ALLOWED_ORG_IDS: string[] = [
  'b72718e7-6a54-4ff8-9bbf-24d1573ddb43', // Arguto · Demo (Desafio 1)
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
  'b72718e7-6a54-4ff8-9bbf-24d1573ddb43', // Arguto · Demo (id local de dev)
];

const DEMO_ORG_SLUGS: string[] = ['arguto'];

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
