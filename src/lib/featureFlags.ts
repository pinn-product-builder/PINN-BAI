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
  // Banco manda quando a org ativa está carregada.
  const g = gatingFor(orgId);
  if (g) return !!g.featureFlags['rfm_churn'];
  // Fallback legado.
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

/**
 * Snapshot de gating da org ATIVA, vindo do banco (tabelas org_feature_flags /
 * org_menu_visibility + colunas org_type/is_demo_org/default_landing_path).
 * Populado pelo OrganizationBrandingContext quando o usuário entra numa org.
 *
 * Os helpers abaixo leem daqui quando o orgId bate com a org ativa; senão
 * caem no hardcode legado (ARGUTO_ORG_ID, DEMO_ORG_*, RFM_CHURN_ALLOWED_*),
 * que vira só FALLBACK — o banco é a fonte de verdade quando semeado.
 */
export interface OrgGatingSnapshot {
  orgId: string;
  slug: string | null;
  orgType: string | null;
  isDemoOrg: boolean;
  defaultLandingPath: string | null;
  featureFlags: Record<string, boolean>;
  menuVisibility: Record<string, boolean>;
}

let activeOrgGating: OrgGatingSnapshot | null = null;

export const setActiveOrgGating = (gating: OrgGatingSnapshot | null): void => {
  activeOrgGating = gating;
};

/** Gating do banco SÓ se o orgId pedido é o da org ativa carregada. */
const gatingFor = (orgId?: string | null): OrgGatingSnapshot | null =>
  orgId && activeOrgGating && activeOrgGating.orgId === orgId ? activeOrgGating : null;

/**
 * Override de visibilidade de item de menu (org_menu_visibility) para a org
 * ativa. Retorna undefined quando não há override → usar o default do código.
 */
export const getMenuVisibilityOverride = (
  orgId: string | undefined | null,
  menuKey: string,
): boolean | undefined => {
  const g = gatingFor(orgId);
  if (!g) return undefined;
  return menuKey in g.menuVisibility ? g.menuVisibility[menuKey] : undefined;
};

/**
 * Leaf do path de landing pós-login (default_landing_path). Substitui o
 * `if (isArgutoOrg) -> /arguto` hardcoded no ClientRootRedirect.
 */
export const getOrgLandingLeaf = (orgId?: string | null): string => {
  const g = gatingFor(orgId);
  if (g) return g.defaultLandingPath || 'dashboard';
  // Fallback legado: só Arguto tinha landing != dashboard.
  return isArgutoOrg(orgId) ? 'arguto' : 'dashboard';
};

export const isDemoOrg = (orgId?: string | null): boolean => {
  if (!orgId) return false;
  // Banco manda quando a org ativa está carregada (coluna is_demo_org).
  const g = gatingFor(orgId);
  if (g) return g.isDemoOrg;
  // Fallback legado (DB ainda não semeado / org não ativa).
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
  // Banco manda: org "arguto" é a que tem landing dedicada em /arguto.
  const g = gatingFor(orgId);
  if (g) return g.defaultLandingPath === 'arguto';
  // Fallback legado.
  if (orgId === ARGUTO_ORG_ID) return true;
  if (typeof window !== 'undefined' && window.__pinnActiveOrgSlug) {
    return window.__pinnActiveOrgSlug === ARGUTO_ORG_SLUG;
  }
  return false;
};

/**
 * Telas que ainda dependem de dados mockados, tabelas vazias em prod ou
 * integrações OAuth não finalizadas — escondidas por padrão para não
 * mostrar "esqueleto" em demo investidor.
 *
 * Override via env (`VITE_ENABLE_MOCK_SCREENS=true`) ou para platform_admin
 * que precisa enxergar mesmo desligado.
 *
 * Cada feature key documenta a tela e a razão para não estar em prod.
 */
export type MockScreenFeature =
  | 'goals'          // /client/:orgId/goals — DEMO_KPI_GOALS hardcoded
  | 'gamification'  // /client/:orgId/gamification — achievement tables empty
  | 'customer-health' // /client/:orgId/customer-health — DEMO_HEALTH_* hardcoded
  | 'paid-traffic'  // /client/:orgId/paid-traffic — OAuth Meta/Google não finalizado
  | 'paid-traffic-connect' // /paid-traffic/connect — esqueleto
  | 'pinn-smart-config'; // aba "config" do PinnSmart — placeholder

const MOCK_SCREENS_ENABLED_VIA_ENV = (() => {
  try {
    return import.meta.env?.VITE_ENABLE_MOCK_SCREENS === 'true';
  } catch {
    return false;
  }
})();

/**
 * Pra a demo investidor: false. Pinn admin pode setar
 * VITE_ENABLE_MOCK_SCREENS=true no .env local pra ver as telas em
 * desenvolvimento.
 */
export const isMockScreenEnabled = (
  _feature: MockScreenFeature,
  opts?: { isPlatformAdmin?: boolean; isDemoOrg?: boolean },
): boolean => {
  // Modo demo Arguto mantém todas as telas (apresentação pronta).
  if (opts?.isDemoOrg) return true;
  // Env override (dev/staging) — vê tudo.
  if (MOCK_SCREENS_ENABLED_VIA_ENV) return true;
  // Platform admin (consultor Pinn) sempre vê pra trabalhar nas telas.
  if (opts?.isPlatformAdmin) return true;
  // Cliente normal em prod: escondido.
  return false;
};

/**
 * Provedores CRM/ERP visíveis no Provider Hub do Auditor.
 *
 * Hub multi-provider: cada provedor é uma conexão independente em
 * `crm_auditor_connections` (chave composta tenant_id + provider). Não há
 * mais "atual" — uma org pode ter Kommo + Omie simultaneamente.
 */
export type CrmProviderKey = 'kommo' | 'ploomes' | 'omie' | 'linkedin_mari';

export const isCrmProviderVisible = (
  _provider: CrmProviderKey,
  _opts?: { currentProvider?: string | null },
): boolean => true;
