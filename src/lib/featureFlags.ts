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

export const isDemoOrg = (orgId?: string | null): boolean => {
  if (!orgId) return false;
  return DEMO_ORG_IDS.includes(orgId);
};

export const isDemoSlug = (slug?: string | null): boolean => {
  if (!slug) return false;
  return DEMO_ORG_SLUGS.includes(slug);
};
