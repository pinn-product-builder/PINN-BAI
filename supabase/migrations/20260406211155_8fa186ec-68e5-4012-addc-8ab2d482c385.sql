
-- Cold Mail Hackers cached data tables for Pinn SDR dashboard

CREATE TABLE public.cmh_sync_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  snapshot_type text NOT NULL, -- 'stats', 'campaigns', 'pipeline', 'linkedin_metrics', 'timeline'
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cmh_snapshots_org_type ON public.cmh_sync_snapshots(org_id, snapshot_type);
CREATE INDEX idx_cmh_snapshots_synced ON public.cmh_sync_snapshots(synced_at DESC);

ALTER TABLE public.cmh_sync_snapshots ENABLE ROW LEVEL SECURITY;

-- Platform admins can do everything
CREATE POLICY "Platform admins manage cmh snapshots"
  ON public.cmh_sync_snapshots FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()));

-- Org users can view their own snapshots
CREATE POLICY "Org users view cmh snapshots"
  ON public.cmh_sync_snapshots FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

-- Service role (edge functions) can insert via bypassing RLS
-- We also allow authenticated platform admins to insert
CREATE POLICY "Platform admins insert cmh snapshots"
  ON public.cmh_sync_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (is_platform_admin(auth.uid()));
