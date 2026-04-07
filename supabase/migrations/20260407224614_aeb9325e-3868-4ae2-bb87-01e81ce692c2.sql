
-- Create the org-logos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY "Anyone can view org logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'org-logos');

-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload org logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'org-logos');

-- Authenticated users can update their uploads
CREATE POLICY "Authenticated users can update org logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'org-logos');

-- Authenticated users can delete org logos
CREATE POLICY "Authenticated users can delete org logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'org-logos');
