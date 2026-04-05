-- Add new columns to marketplace_products
ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'Simple',
  ADD COLUMN IF NOT EXISTS category text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS image_url_2 text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS image_url_3 text DEFAULT NULL;

-- Create storage bucket for marketplace images
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketplace-images', 'marketplace-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Marketplace images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'marketplace-images');

CREATE POLICY "Authenticated users can upload marketplace images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'marketplace-images');

CREATE POLICY "Authenticated users can update marketplace images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'marketplace-images');

CREATE POLICY "Authenticated users can delete marketplace images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'marketplace-images');