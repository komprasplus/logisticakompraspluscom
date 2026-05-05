-- Add POD evidence columns
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS evidencia_foto_url TEXT,
  ADD COLUMN IF NOT EXISTS evidencia_firma_url TEXT,
  ADD COLUMN IF NOT EXISTS evidencia_llamada_url TEXT;

-- Create public bucket for delivery evidence
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidencias-logistica', 'evidencias-logistica', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Public read evidencias-logistica" ON storage.objects;
CREATE POLICY "Public read evidencias-logistica"
ON storage.objects FOR SELECT
USING (bucket_id = 'evidencias-logistica');

DROP POLICY IF EXISTS "Authenticated upload evidencias-logistica" ON storage.objects;
CREATE POLICY "Authenticated upload evidencias-logistica"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'evidencias-logistica'
  AND (
    public.has_role(auth.uid(), 'motorizado'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_super_admin()
  )
);

DROP POLICY IF EXISTS "Authenticated update evidencias-logistica" ON storage.objects;
CREATE POLICY "Authenticated update evidencias-logistica"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'evidencias-logistica'
  AND (
    public.has_role(auth.uid(), 'motorizado'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_super_admin()
  )
);

DROP POLICY IF EXISTS "Authenticated delete evidencias-logistica" ON storage.objects;
CREATE POLICY "Authenticated delete evidencias-logistica"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'evidencias-logistica'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_super_admin()
  )
);