-- Index for instant tracking lookups by guia number
CREATE INDEX IF NOT EXISTS idx_pedidos_numero_guia ON public.pedidos USING btree (numero_guia);
