-- Update default branding colors for root org to blue #00D1FF
UPDATE public.organizaciones 
SET color_primario = '#00D1FF', color_secundario = '#0099CC'
WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- Update column defaults for future orgs
ALTER TABLE public.organizaciones ALTER COLUMN color_primario SET DEFAULT '#00D1FF';
ALTER TABLE public.organizaciones ALTER COLUMN color_secundario SET DEFAULT '#0099CC';