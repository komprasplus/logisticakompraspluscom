
-- Add canal and flex-specific columns to pedidos
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS canal text DEFAULT 'STANDARD',
ADD COLUMN IF NOT EXISTS id_externo text,
ADD COLUMN IF NOT EXISTS hora_cierre_flex time DEFAULT '21:00:00';

-- Index for duplicate detection (same id_externo on same day)
CREATE INDEX IF NOT EXISTS idx_pedidos_id_externo ON public.pedidos (id_externo) WHERE id_externo IS NOT NULL;

-- Index for canal-based filtering
CREATE INDEX IF NOT EXISTS idx_pedidos_canal ON public.pedidos (canal) WHERE canal IS NOT NULL;
