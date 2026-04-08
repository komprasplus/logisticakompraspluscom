
ALTER TABLE public.pedidos
ADD COLUMN variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL DEFAULT NULL;

CREATE INDEX idx_pedidos_variant_id ON public.pedidos (variant_id) WHERE variant_id IS NOT NULL;
