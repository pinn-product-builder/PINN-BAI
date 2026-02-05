-- Tabela para métricas customizadas salvas
CREATE TABLE public.saved_custom_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  display_label TEXT NOT NULL,
  description TEXT,
  transformation TEXT DEFAULT 'none',
  usage_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, metric_name)
);

-- Enable RLS
ALTER TABLE public.saved_custom_metrics ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage all metrics
CREATE POLICY "Platform admins can manage all metrics"
  ON public.saved_custom_metrics FOR ALL
  USING (public.is_platform_admin(auth.uid()));

-- Org users can view their metrics
CREATE POLICY "Org users can view their metrics"
  ON public.saved_custom_metrics FOR SELECT
  USING (org_id = public.get_user_org_id(auth.uid()));

-- Org admins can insert their own metrics
CREATE POLICY "Org admins can insert metrics"
  ON public.saved_custom_metrics FOR INSERT
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

-- Org admins can update their own metrics
CREATE POLICY "Org admins can update metrics"
  ON public.saved_custom_metrics FOR UPDATE
  USING (org_id = public.get_user_org_id(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_saved_custom_metrics_updated_at
  BEFORE UPDATE ON public.saved_custom_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();