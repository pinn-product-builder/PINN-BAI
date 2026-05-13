// Catálogo de planos comerciais Pinn — fonte central usada por
// NewOrganization, Settings → Planos, lista de Organizações etc.
//
// Origem dos dados: tabela `plans` no Supabase. Caso a request falhe
// (sem rede, sem permissão), caímos no DEFAULT_PLANS abaixo — mesmos
// IDs que a migration semeia, então a UI sempre renderiza algo coerente.

export interface Plan {
  id: number;
  name: string;
  full_name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
}

export const DEFAULT_PLANS: Plan[] = [
  { id: 1, name: 'Agent Sales',      full_name: 'Pinn Agent Sales',            description: 'Lead tracking & conversion',     is_active: true, sort_order: 1 },
  { id: 2, name: 'Revenue OS',       full_name: 'Pinn Revenue OS',             description: 'Revenue forecasting & pipeline', is_active: true, sort_order: 2 },
  { id: 3, name: 'Growth Engine',    full_name: 'Pinn Growth Engine',          description: 'Attribution & LTV/CAC',          is_active: true, sort_order: 3 },
  { id: 4, name: 'Automation Hub',   full_name: 'Pinn Process Automation Hub', description: 'Bot ROI & throughput',           is_active: true, sort_order: 4 },
  { id: 5, name: 'MicroSaaS Studio', full_name: 'Pinn MicroSaaS Studio',       description: 'Universal BI & Semantic Layer',  is_active: true, sort_order: 5 },
];

/** Lookup helper que sobrevive a planos deletados (cai no full_name fallback). */
export const getPlanLabel = (plans: Plan[] | undefined, planId: number): string => {
  const list = plans && plans.length > 0 ? plans : DEFAULT_PLANS;
  const found = list.find((p) => p.id === planId);
  return found?.full_name ?? `Plano ${planId}`;
};

export const getPlanShortName = (plans: Plan[] | undefined, planId: number): string => {
  const list = plans && plans.length > 0 ? plans : DEFAULT_PLANS;
  const found = list.find((p) => p.id === planId);
  return found?.name ?? `Plano ${planId}`;
};
