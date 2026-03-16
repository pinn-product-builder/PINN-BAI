-- ===========================================
-- PINN BAI - Complete Database Schema
-- Phase 1: Foundation
-- ===========================================

-- 1. ENUM TYPES
-- ===========================================

-- User roles (security-isolated)
CREATE TYPE public.app_role AS ENUM ('platform_admin', 'client_admin', 'analyst', 'viewer');

-- Organization status
CREATE TYPE public.org_status AS ENUM ('active', 'suspended', 'trial');

-- Integration types
CREATE TYPE public.integration_type AS ENUM ('supabase', 'google_sheets', 'csv', 'api');

-- Integration status
CREATE TYPE public.integration_status AS ENUM ('pending', 'connected', 'error', 'syncing');

-- Lead source
CREATE TYPE public.lead_source AS ENUM ('google_ads', 'linkedin', 'referral', 'organic', 'email', 'other');

-- Lead status
CREATE TYPE public.lead_status AS ENUM ('new', 'qualified', 'in_analysis', 'proposal', 'converted', 'lost');

-- Widget types
CREATE TYPE public.widget_type AS ENUM ('metric_card', 'area_chart', 'bar_chart', 'line_chart', 'pie_chart', 'funnel', 'table', 'insight_card');

-- ===========================================
-- 2. CORE TABLES
-- ===========================================

-- Organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan INTEGER NOT NULL DEFAULT 1 CHECK (plan >= 1 AND plan <= 4),
  status public.org_status NOT NULL DEFAULT 'trial',
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3B82F6',
  secondary_color TEXT DEFAULT '#1E293B',
  font_family TEXT DEFAULT 'Inter',
  custom_domain TEXT UNIQUE,
  admin_name TEXT,
  admin_email TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  full_name TEXT,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Integrations table
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type public.integration_type NOT NULL,
  status public.integration_status NOT NULL DEFAULT 'pending',
  config JSONB NOT NULL DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Selected tables from integrations
CREATE TABLE public.selected_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES public.integrations(id) ON DELETE CASCADE NOT NULL,
  table_name TEXT NOT NULL,
  selected_columns TEXT[] NOT NULL DEFAULT '{}',
  column_types JSONB DEFAULT '{}',
  is_primary BOOLEAN DEFAULT false,
  row_count INTEGER,
  sample_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Data mappings for metrics
CREATE TABLE public.data_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  integration_id UUID REFERENCES public.integrations(id) ON DELETE CASCADE NOT NULL,
  source_table TEXT NOT NULL,
  source_column TEXT NOT NULL,
  target_metric TEXT NOT NULL,
  transform_type TEXT DEFAULT 'direct',
  transform_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dashboards configuration
CREATE TABLE public.dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Dashboard Principal',
  description TEXT,
  is_default BOOLEAN DEFAULT true,
  layout JSONB DEFAULT '{}',
  filters JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dashboard widgets
CREATE TABLE public.dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID REFERENCES public.dashboards(id) ON DELETE CASCADE NOT NULL,
  type public.widget_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 4,
  height INTEGER NOT NULL DEFAULT 2,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leads (synced data)
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  integration_id UUID REFERENCES public.integrations(id) ON DELETE SET NULL,
  external_id TEXT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  source public.lead_source DEFAULT 'other',
  status public.lead_status DEFAULT 'new',
  value DECIMAL(12, 2) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, external_id)
);

-- Activity logs
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- 3. INDEXES
-- ===========================================

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_org_id ON public.profiles(org_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_integrations_org_id ON public.integrations(org_id);
CREATE INDEX idx_selected_tables_integration_id ON public.selected_tables(integration_id);
CREATE INDEX idx_data_mappings_org_id ON public.data_mappings(org_id);
CREATE INDEX idx_dashboards_org_id ON public.dashboards(org_id);
CREATE INDEX idx_dashboard_widgets_dashboard_id ON public.dashboard_widgets(dashboard_id);
CREATE INDEX idx_leads_org_id ON public.leads(org_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_source ON public.leads(source);
CREATE INDEX idx_leads_created_at ON public.leads(created_at);
CREATE INDEX idx_activity_logs_org_id ON public.activity_logs(org_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at);

-- ===========================================
-- 4. SECURITY DEFINER FUNCTION (has_role)
-- ===========================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Helper function to check if user is platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'platform_admin')
$$;

-- Helper function to get user's org_id
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- ===========================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selected_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- 6. RLS POLICIES
-- ===========================================

-- Organizations policies
CREATE POLICY "Platform admins can view all organizations"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert organizations"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update organizations"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete organizations"
  ON public.organizations FOR DELETE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Users can view their own organization"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (id = public.get_user_org_id(auth.uid()));

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Platform admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- User roles policies (only platform admins can manage)
CREATE POLICY "Platform admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Platform admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- Integrations policies
CREATE POLICY "Users can view org integrations"
  ON public.integrations FOR SELECT
  TO authenticated
  USING (
    org_id = public.get_user_org_id(auth.uid()) 
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Admins can insert integrations"
  ON public.integrations FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id(auth.uid()) 
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Admins can update integrations"
  ON public.integrations FOR UPDATE
  TO authenticated
  USING (
    org_id = public.get_user_org_id(auth.uid()) 
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Admins can delete integrations"
  ON public.integrations FOR DELETE
  TO authenticated
  USING (
    org_id = public.get_user_org_id(auth.uid()) 
    OR public.is_platform_admin(auth.uid())
  );

-- Selected tables policies
CREATE POLICY "Users can view selected tables"
  ON public.selected_tables FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.integrations i 
      WHERE i.id = integration_id 
      AND (i.org_id = public.get_user_org_id(auth.uid()) OR public.is_platform_admin(auth.uid()))
    )
  );

CREATE POLICY "Admins can manage selected tables"
  ON public.selected_tables FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.integrations i 
      WHERE i.id = integration_id 
      AND (i.org_id = public.get_user_org_id(auth.uid()) OR public.is_platform_admin(auth.uid()))
    )
  );

-- Data mappings policies
CREATE POLICY "Users can view org mappings"
  ON public.data_mappings FOR SELECT
  TO authenticated
  USING (
    org_id = public.get_user_org_id(auth.uid()) 
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Admins can manage mappings"
  ON public.data_mappings FOR ALL
  TO authenticated
  USING (
    org_id = public.get_user_org_id(auth.uid()) 
    OR public.is_platform_admin(auth.uid())
  );

-- Dashboards policies
CREATE POLICY "Users can view org dashboards"
  ON public.dashboards FOR SELECT
  TO authenticated
  USING (
    org_id = public.get_user_org_id(auth.uid()) 
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Admins can manage dashboards"
  ON public.dashboards FOR ALL
  TO authenticated
  USING (
    org_id = public.get_user_org_id(auth.uid()) 
    OR public.is_platform_admin(auth.uid())
  );

-- Dashboard widgets policies
CREATE POLICY "Users can view dashboard widgets"
  ON public.dashboard_widgets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboards d 
      WHERE d.id = dashboard_id 
      AND (d.org_id = public.get_user_org_id(auth.uid()) OR public.is_platform_admin(auth.uid()))
    )
  );

CREATE POLICY "Admins can manage widgets"
  ON public.dashboard_widgets FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboards d 
      WHERE d.id = dashboard_id 
      AND (d.org_id = public.get_user_org_id(auth.uid()) OR public.is_platform_admin(auth.uid()))
    )
  );

-- Leads policies
CREATE POLICY "Users can view org leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (
    org_id = public.get_user_org_id(auth.uid()) 
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Admins can manage leads"
  ON public.leads FOR ALL
  TO authenticated
  USING (
    org_id = public.get_user_org_id(auth.uid()) 
    OR public.is_platform_admin(auth.uid())
  );

-- Activity logs policies
CREATE POLICY "Users can view org activity logs"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (
    org_id = public.get_user_org_id(auth.uid()) 
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "System can insert activity logs"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ===========================================
-- 7. TRIGGERS FOR UPDATED_AT
-- ===========================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dashboards_updated_at
  BEFORE UPDATE ON public.dashboards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dashboard_widgets_updated_at
  BEFORE UPDATE ON public.dashboard_widgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- 8. AUTO-CREATE PROFILE ON USER SIGNUP
-- ===========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();