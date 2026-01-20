-- Add column to track if shipping guide has been printed
ALTER TABLE public.pedidos ADD COLUMN guia_impresa boolean DEFAULT false;

-- Add column to track when the guide was printed
ALTER TABLE public.pedidos ADD COLUMN guia_impresa_at timestamp with time zone;

-- Create index for filtering printed/unprinted guides
CREATE INDEX idx_pedidos_guia_impresa ON public.pedidos(guia_impresa) WHERE guia_impresa = true;