
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS flete_tienda numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS flete_aliado numeric DEFAULT NULL;

COMMENT ON COLUMN public.pedidos.flete_tienda IS 'Flete cobrado a la tienda (visible para el cliente)';
COMMENT ON COLUMN public.pedidos.flete_aliado IS 'Flete cobrado por el aliado logístico (interno, no visible para tiendas)';
