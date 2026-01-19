-- Add columns for freight, product cost and utility calculation
ALTER TABLE public.pedidos 
ADD COLUMN IF NOT EXISTS valor_producto numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS valor_flete numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS utilidad numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS municipio text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.pedidos.valor_producto IS 'Costo del producto para el cliente (proveeduría)';
COMMENT ON COLUMN public.pedidos.valor_flete IS 'Costo del flete automático basado en zona/municipio';
COMMENT ON COLUMN public.pedidos.utilidad IS 'Utilidad calculada: valor_recaudar - valor_producto - valor_flete';
COMMENT ON COLUMN public.pedidos.municipio IS 'Municipio para cálculo de tarifa de envío';