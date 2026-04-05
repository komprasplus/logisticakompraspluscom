
-- Create marketplace_products table
CREATE TABLE public.marketplace_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organizacion_id UUID DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid REFERENCES public.organizaciones(id),
  created_by UUID REFERENCES auth.users(id),
  product_name TEXT NOT NULL,
  description TEXT,
  sku TEXT NOT NULL,
  cost_price NUMERIC NOT NULL DEFAULT 0,
  suggested_price NUMERIC NOT NULL DEFAULT 0,
  stock_available INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketplace_products ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins full access marketplace_products"
  ON public.marketplace_products FOR ALL
  USING (public.is_admin());

-- Clients can view active products in their org
CREATE POLICY "Clients can view active marketplace products"
  ON public.marketplace_products FOR SELECT
  USING (
    public.has_role(auth.uid(), 'cliente'::app_role)
    AND is_active = true
    AND organizacion_id = public.get_user_org_id()
  );

-- Trigger for updated_at
CREATE TRIGGER update_marketplace_products_updated_at
  BEFORE UPDATE ON public.marketplace_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RPC to atomically reserve stock
CREATE OR REPLACE FUNCTION public.marketplace_reserve_stock(
  p_product_id UUID,
  p_quantity INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_stock INTEGER;
  v_product_name TEXT;
BEGIN
  -- Lock the row to prevent race conditions
  SELECT stock_available, product_name
  INTO v_current_stock, v_product_name
  FROM public.marketplace_products
  WHERE id = p_product_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Producto no encontrado o inactivo');
  END IF;

  IF v_current_stock < p_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stock insuficiente. Disponible: ' || v_current_stock, 'stock', v_current_stock);
  END IF;

  UPDATE public.marketplace_products
  SET stock_available = stock_available - p_quantity
  WHERE id = p_product_id;

  RETURN jsonb_build_object('success', true, 'product_name', v_product_name, 'new_stock', v_current_stock - p_quantity);
END;
$$;
