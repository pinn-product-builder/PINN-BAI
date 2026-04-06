CREATE TABLE public.ploomes_sync_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  snapshot_type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ploomes_sync_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage ploomes snapshots"
  ON public.ploomes_sync_snapshots FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Org users view ploomes snapshots"
  ON public.ploomes_sync_snapshots FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));