-- Allow anonymous and authenticated users to read non-sensitive branding columns from organizaciones
-- This enables the white-label login screen to fetch org branding before authentication
CREATE POLICY "Public can view org branding"
  ON public.organizaciones FOR SELECT
  TO anon, authenticated
  USING (true);
