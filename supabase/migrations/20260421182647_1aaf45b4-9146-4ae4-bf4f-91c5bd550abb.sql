-- Tabla de anuncios de plataforma (Billboard del Super Admin)
CREATE TABLE public.anuncios_plataforma (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  contenido TEXT,
  tipo TEXT NOT NULL DEFAULT 'banner' CHECK (tipo IN ('banner', 'noticia', 'mapa_cobertura')),
  imagen_url TEXT,
  link_url TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para consulta rápida
CREATE INDEX idx_anuncios_activo ON public.anuncios_plataforma(activo, orden);
CREATE INDEX idx_anuncios_tipo ON public.anuncios_plataforma(tipo);

-- Enable RLS
ALTER TABLE public.anuncios_plataforma ENABLE ROW LEVEL SECURITY;

-- Súper Admin: acceso total
CREATE POLICY "Super admins full access anuncios"
ON public.anuncios_plataforma
FOR ALL
TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- Admins: lectura
CREATE POLICY "Admins can view anuncios"
ON public.anuncios_plataforma
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Clientes (tiendas): solo activos
CREATE POLICY "Clientes can view active anuncios"
ON public.anuncios_plataforma
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'cliente'::app_role) AND activo = true);

-- Motorizados: solo activos
CREATE POLICY "Motorizados can view active anuncios"
ON public.anuncios_plataforma
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'motorizado'::app_role) AND activo = true);

-- Aliados logísticos: solo activos
CREATE POLICY "Aliados can view active anuncios"
ON public.anuncios_plataforma
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'aliado_logistico'::app_role) AND activo = true);

-- Trigger updated_at
CREATE TRIGGER trg_anuncios_updated_at
BEFORE UPDATE ON public.anuncios_plataforma
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket para imágenes de anuncios
INSERT INTO storage.buckets (id, name, public)
VALUES ('anuncios-media', 'anuncios-media', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas storage: lectura pública
CREATE POLICY "Public read anuncios media"
ON storage.objects FOR SELECT
USING (bucket_id = 'anuncios-media');

-- Súper Admin sube/edita/borra
CREATE POLICY "Super admin manage anuncios media"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'anuncios-media' AND is_super_admin())
WITH CHECK (bucket_id = 'anuncios-media' AND is_super_admin());