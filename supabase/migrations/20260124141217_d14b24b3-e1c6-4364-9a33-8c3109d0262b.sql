-- Add image_url and fulfillment_value columns to inventory table
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS fulfillment_value NUMERIC DEFAULT 1900;

-- Create storage bucket for inventory images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('inventory-images', 'inventory-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own inventory images
CREATE POLICY "Users can upload inventory images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'inventory-images' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own images
CREATE POLICY "Users can update own inventory images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'inventory-images' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own images
CREATE POLICY "Users can delete own inventory images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'inventory-images' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Public read access since bucket is public
CREATE POLICY "Public read access for inventory images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'inventory-images');