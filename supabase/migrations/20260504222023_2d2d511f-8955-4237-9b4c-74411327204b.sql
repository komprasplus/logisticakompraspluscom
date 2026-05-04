-- 1. Tabla manifiestos_ruta
CREATE TABLE public.manifiestos_ruta (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_manifiesto BIGSERIAL NOT NULL UNIQUE,
  aliado_logistico_id UUID NOT NULL,
  motorizado_id UUID,
  organizacion_id UUID,
  cantidad_paquetes INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'Activo',
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_manifiestos_aliado ON public.manifiestos_ruta(aliado_logistico_id);
CREATE INDEX idx_manifiestos_motorizado ON public.manifiestos_ruta(motorizado_id);
CREATE INDEX idx_manifiestos_estado ON public.manifiestos_ruta(estado);

-- 2. Columna manifiesto_id en pedidos
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS manifiesto_id UUID REFERENCES public.manifiestos_ruta(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_manifiesto ON public.pedidos(manifiesto_id);

-- 3. Trigger updated_at
CREATE TRIGGER trg_manifiestos_ruta_updated_at
BEFORE UPDATE ON public.manifiestos_ruta
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. RLS
ALTER TABLE public.manifiestos_ruta ENABLE ROW LEVEL SECURITY;

-- Helper: detectar si un usuario es aliado_logistico
CREATE OR REPLACE FUNCTION public.is_aliado_logistico(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'aliado_logistico'
  )
$$;

-- SELECT
CREATE POLICY "Aliado puede ver sus manifiestos"
ON public.manifiestos_ruta FOR SELECT
USING (
  aliado_logistico_id = auth.uid()
  OR motorizado_id = auth.uid()
  OR public.is_admin()
  OR public.is_super_admin()
);

-- INSERT
CREATE POLICY "Aliado puede crear sus manifiestos"
ON public.manifiestos_ruta FOR INSERT
WITH CHECK (
  aliado_logistico_id = auth.uid()
  AND public.is_aliado_logistico(auth.uid())
);

-- UPDATE
CREATE POLICY "Aliado puede actualizar sus manifiestos"
ON public.manifiestos_ruta FOR UPDATE
USING (
  aliado_logistico_id = auth.uid()
  OR public.is_admin()
  OR public.is_super_admin()
);

-- DELETE
CREATE POLICY "Aliado puede eliminar sus manifiestos"
ON public.manifiestos_ruta FOR DELETE
USING (
  aliado_logistico_id = auth.uid()
  OR public.is_super_admin()
);