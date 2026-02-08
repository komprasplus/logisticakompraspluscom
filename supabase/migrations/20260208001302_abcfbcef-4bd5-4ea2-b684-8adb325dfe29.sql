
-- Add comprobante_url column to transacciones_billetera
ALTER TABLE public.transacciones_billetera
ADD COLUMN comprobante_url TEXT;

-- Create storage bucket for payment receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes-pagos', 'comprobantes-pagos', false)
ON CONFLICT (id) DO NOTHING;

-- Admins can upload comprobantes
CREATE POLICY "Admins can upload comprobantes"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'comprobantes-pagos' AND public.is_admin());

-- Admins can view all comprobantes
CREATE POLICY "Admins can view comprobantes"
ON storage.objects FOR SELECT
USING (bucket_id = 'comprobantes-pagos' AND public.is_admin());

-- Clients can view comprobantes in their own folder (folder = client_user_id)
CREATE POLICY "Clients can view own comprobantes"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'comprobantes-pagos' 
  AND public.has_role(auth.uid(), 'cliente')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can delete comprobantes
CREATE POLICY "Admins can delete comprobantes"
ON storage.objects FOR DELETE
USING (bucket_id = 'comprobantes-pagos' AND public.is_admin());
