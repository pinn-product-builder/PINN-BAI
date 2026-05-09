-- CRM Auditor module: multi-tenant CRM mirror + sync + analysis (Kommo via Composio — preparado para outros providers)
-- tenant_id = organização (mesmo conceito de org no BAI)

CREATE TYPE public.crm_connection_status AS ENUM (
  'disconnected',
  'pending',
  'connected',
  'error'
);

CREATE TYPE public.crm_sync_run_status AS ENUM (
  'running',
  'success',
  'failed'
);

CREATE TABLE public.crm_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'kommo',
  composio_connected_account_id TEXT,
  status public.crm_connection_status NOT NULL DEFAULT 'disconnected',
  last_sync_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

CREATE TABLE public.crm_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'kommo',
  status public.crm_sync_run_status NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  error_message TEXT,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_sync_runs_tenant_started ON public.crm_sync_runs(tenant_id, started_at DESC);

CREATE TABLE public.crm_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'kommo',
  external_id TEXT NOT NULL,
  name TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_id)
);

CREATE TABLE public.crm_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'kommo',
  external_id TEXT NOT NULL,
  pipeline_external_id TEXT,
  name TEXT,
  sort_order INTEGER,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_id)
);

CREATE INDEX idx_crm_stages_pipeline ON public.crm_stages(tenant_id, provider, pipeline_external_id);

CREATE TABLE public.crm_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'kommo',
  external_id TEXT NOT NULL,
  name TEXT,
  email TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_id)
);

CREATE TABLE public.crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'kommo',
  external_id TEXT NOT NULL,
  name TEXT,
  price NUMERIC(18, 2),
  status TEXT,
  pipeline_external_id TEXT,
  stage_external_id TEXT,
  responsible_external_id TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_id)
);

CREATE INDEX idx_crm_leads_tenant_stage ON public.crm_leads(tenant_id, provider, stage_external_id);

CREATE TABLE public.crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'kommo',
  external_id TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  email TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_id)
);

CREATE TABLE public.crm_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'kommo',
  external_id TEXT NOT NULL,
  name TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_id)
);

CREATE TABLE public.crm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'kommo',
  external_id TEXT NOT NULL,
  title TEXT,
  due_at TIMESTAMPTZ,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  responsible_external_id TEXT,
  entity_type TEXT,
  entity_external_id TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_id)
);

CREATE INDEX idx_crm_tasks_tenant_due ON public.crm_tasks(tenant_id, provider, due_at);

CREATE TABLE public.crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'kommo',
  external_id TEXT NOT NULL,
  activity_type TEXT,
  occurred_at TIMESTAMPTZ,
  entity_type TEXT,
  entity_external_id TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_id)
);

CREATE TABLE public.crm_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'kommo',
  sync_run_id UUID REFERENCES public.crm_sync_runs(id) ON DELETE SET NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_snapshots_tenant_captured ON public.crm_snapshots(tenant_id, captured_at DESC);

CREATE TABLE public.crm_analysis_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'kommo',
  model TEXT,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_analysis_reports_tenant_created ON public.crm_analysis_reports(tenant_id, created_at DESC);

CREATE TABLE public.crm_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'kommo',
  severity TEXT NOT NULL DEFAULT 'info',
  code TEXT,
  message TEXT NOT NULL,
  dedupe_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_alerts_tenant ON public.crm_alerts(tenant_id, created_at DESC);

-- RLS: leitura por tenant; escrita preferencialmente via Edge Function (service role)
ALTER TABLE public.crm_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_analysis_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_tenant_select_connections"
  ON public.crm_connections FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_org_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "crm_tenant_select_sync_runs"
  ON public.crm_sync_runs FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_org_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "crm_tenant_select_pipelines"
  ON public.crm_pipelines FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_org_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "crm_tenant_select_stages"
  ON public.crm_stages FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_org_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "crm_tenant_select_users"
  ON public.crm_users FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_org_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "crm_tenant_select_leads"
  ON public.crm_leads FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_org_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "crm_tenant_select_contacts"
  ON public.crm_contacts FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_org_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "crm_tenant_select_companies"
  ON public.crm_companies FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_org_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "crm_tenant_select_tasks"
  ON public.crm_tasks FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_org_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "crm_tenant_select_activities"
  ON public.crm_activities FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_org_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "crm_tenant_select_snapshots"
  ON public.crm_snapshots FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_org_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "crm_tenant_select_analysis_reports"
  ON public.crm_analysis_reports FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_org_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "crm_tenant_select_alerts"
  ON public.crm_alerts FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_org_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE TRIGGER update_crm_connections_updated_at
  BEFORE UPDATE ON public.crm_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_sync_runs_updated_at
  BEFORE UPDATE ON public.crm_sync_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_pipelines_updated_at
  BEFORE UPDATE ON public.crm_pipelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_stages_updated_at
  BEFORE UPDATE ON public.crm_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_users_updated_at
  BEFORE UPDATE ON public.crm_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_leads_updated_at
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_contacts_updated_at
  BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_companies_updated_at
  BEFORE UPDATE ON public.crm_companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_tasks_updated_at
  BEFORE UPDATE ON public.crm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_activities_updated_at
  BEFORE UPDATE ON public.crm_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_snapshots_updated_at
  BEFORE UPDATE ON public.crm_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_analysis_reports_updated_at
  BEFORE UPDATE ON public.crm_analysis_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_alerts_updated_at
  BEFORE UPDATE ON public.crm_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
