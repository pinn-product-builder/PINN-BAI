const RFM_CHURN_MODULE_ENABLED = false;

// Quando o módulo estiver pronto para rollout, manter o global true
// e liberar apenas as organizações dessa lista.
const RFM_CHURN_ALLOWED_ORG_IDS: string[] = [];

export const isRfmChurnEnabledForOrg = (orgId?: string | null): boolean => {
  if (!RFM_CHURN_MODULE_ENABLED) return false;
  if (!orgId) return false;
  if (RFM_CHURN_ALLOWED_ORG_IDS.length === 0) return false;
  return RFM_CHURN_ALLOWED_ORG_IDS.includes(orgId);
};

export const isRfmChurnEnabledForAdmin = (): boolean => RFM_CHURN_MODULE_ENABLED;
