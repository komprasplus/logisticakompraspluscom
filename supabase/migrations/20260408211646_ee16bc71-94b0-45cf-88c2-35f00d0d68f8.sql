
-- Create product_variants table
CREATE TABLE public.product_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  price NUMERIC DEFAULT NULL,
  cost_price NUMERIC DEFAULT NULL,
  stock_available INTEGER NOT NULL DEFAULT 0,
  image_url TEXT DEFAULT NULL,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  organizacion_id UUID DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- Admins can manage variants in their org
CREATE POLICY "Admins can manage own org product_variants"
  ON public.product_variants FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND organizacion_id = get_user_org_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND organizacion_id = get_user_org_id());

-- Super admins full access
CREATE POLICY "Super admins full access to product_variants"
  ON public.product_variants FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Clients can view active variants in their org
CREATE POLICY "Clients can view active product_variants"
  ON public.product_variants FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'cliente'::app_role) AND is_active = true AND organizacion_id = get_user_org_id());

-- Index for fast lookups
CREATE INDEX idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX idx_product_variants_org_id ON public.product_variants(organizacion_id);
