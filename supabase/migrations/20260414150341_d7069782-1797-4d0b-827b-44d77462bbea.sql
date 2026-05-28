CREATE TABLE public.smartlead_sync_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  snapshot_type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.smartlead_sync_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org users view smartlead snapshots"
  ON public.smartlead_sync_snapshots FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Platform admins manage smartlead snapshots"
  ON public.smartlead_sync_snapshots FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()));