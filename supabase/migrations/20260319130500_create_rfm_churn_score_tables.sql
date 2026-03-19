-- RFM and churn score tables for per-org analytics

CREATE TABLE IF NOT EXISTS public.customer_rfm_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_key TEXT NOT NULL,
  customer_name TEXT,
  customer_email TEXT,
  source_table TEXT,
  recency_days INTEGER NOT NULL DEFAULT 0,
  frequency INTEGER NOT NULL DEFAULT 0,
  monetary NUMERIC(14,2) NOT NULL DEFAULT 0,
  r_score INTEGER NOT NULL CHECK (r_score BETWEEN 1 AND 5),
  f_score INTEGER NOT NULL CHECK (f_score BETWEEN 1 AND 5),
  m_score INTEGER NOT NULL CHECK (m_score BETWEEN 1 AND 5),
  rfm_score TEXT NOT NULL,
  rfm_segment TEXT NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, customer_key)
);

CREATE TABLE IF NOT EXISTS public.customer_churn_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_key TEXT NOT NULL,
  source_table TEXT,
  churn_probability NUMERIC(6,5) NOT NULL DEFAULT 0,
  churn_risk_band TEXT NOT NULL DEFAULT 'baixo',
  churn_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, customer_key)
);

CREATE INDEX IF NOT EXISTS idx_customer_rfm_scores_org_id ON public.customer_rfm_scores(org_id);
CREATE INDEX IF NOT EXISTS idx_customer_rfm_scores_segment ON public.customer_rfm_scores(org_id, rfm_segment);
CREATE INDEX IF NOT EXISTS idx_customer_churn_scores_org_id ON public.customer_churn_scores(org_id);
CREATE INDEX IF NOT EXISTS idx_customer_churn_scores_risk ON public.customer_churn_scores(org_id, churn_risk_band);

ALTER TABLE public.customer_rfm_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_churn_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org rfm scores"
  ON public.customer_rfm_scores FOR SELECT
  TO authenticated
  USING (
    org_id = public.get_user_org_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Users can view org churn scores"
  ON public.customer_churn_scores FOR SELECT
  TO authenticated
  USING (
    org_id = public.get_user_org_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE TRIGGER update_customer_rfm_scores_updated_at
  BEFORE UPDATE ON public.customer_rfm_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_churn_scores_updated_at
  BEFORE UPDATE ON public.customer_churn_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
