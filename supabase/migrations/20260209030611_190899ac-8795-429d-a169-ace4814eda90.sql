
-- PASO 1: Solo crear tabla organizaciones y seed
CREATE TABLE IF NOT EXISTS public.organizaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  color_primario text DEFAULT '#6366f1',
  color_secundario text DEFAULT '#8b5cf6',
  dominio_personalizado text,
  plan_activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.organizaciones ENABLE ROW LEVEL SECURITY;

INSERT INTO public.organizaciones (id, nombre, slug, logo_url, color_primario, color_secundario)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Kompras Plus', 'kompras-plus', '/logo-kompras-plus.png', '#6366f1', '#8b5cf6')
ON CONFLICT (id) DO NOTHING;
