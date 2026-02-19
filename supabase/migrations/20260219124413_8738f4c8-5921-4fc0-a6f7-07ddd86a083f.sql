-- Allow client_admin users to update their own organization (for white-label settings)
CREATE POLICY "Client admins can update their own organization"
ON public.organizations
FOR UPDATE
USING (
  id = get_user_org_id(auth.uid())
  AND has_role(auth.uid(), 'client_admin')
)
WITH CHECK (
  id = get_user_org_id(auth.uid())
  AND has_role(auth.uid(), 'client_admin')
);