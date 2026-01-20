-- Create storage bucket for store logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos_tiendas', 'logos_tiendas', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for logos_tiendas bucket
CREATE POLICY "Logos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'logos_tiendas');

CREATE POLICY "Clients can upload their own logo" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'logos_tiendas' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Clients can update their own logo" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'logos_tiendas' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Clients can delete their own logo" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'logos_tiendas' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add NIT/RUT field to profiles table for stores
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS nit_rut TEXT;

-- Add logo_url field to profiles table (separate from avatar)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS logo_url TEXT;