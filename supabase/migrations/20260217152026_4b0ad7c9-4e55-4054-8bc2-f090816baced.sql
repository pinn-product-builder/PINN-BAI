
-- Create storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public) VALUES ('org-logos', 'org-logos', true);

-- Allow authenticated users to upload logos
CREATE POLICY "Authenticated users can upload org logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'org-logos' AND auth.uid() IS NOT NULL);

-- Allow public read access to logos
CREATE POLICY "Public can view org logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'org-logos');

-- Allow authenticated users to update their logos
CREATE POLICY "Authenticated users can update org logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'org-logos' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to delete their logos
CREATE POLICY "Authenticated users can delete org logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'org-logos' AND auth.uid() IS NOT NULL);
