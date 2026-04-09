
-- Create order_items table for multi-product orders
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id BIGINT NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  organizacion_id UUID DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid REFERENCES public.organizaciones(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_order_items_pedido_id ON public.order_items(pedido_id);
CREATE INDEX idx_order_items_inventory_item_id ON public.order_items(inventory_item_id) WHERE inventory_item_id IS NOT NULL;
CREATE INDEX idx_order_items_organizacion_id ON public.order_items(organizacion_id);

-- Enable RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Super admins full access to order_items"
ON public.order_items FOR ALL TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE POLICY "Admins can manage own org order_items"
ON public.order_items FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND organizacion_id = get_user_org_id())
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND organizacion_id = get_user_org_id());

CREATE POLICY "Clients can view own order items"
ON public.order_items FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'cliente'::app_role) AND pedido_id IN (
  SELECT id FROM public.pedidos WHERE client_user_id = auth.uid()
));

CREATE POLICY "Clients can insert own order items"
ON public.order_items FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'cliente'::app_role) AND pedido_id IN (
  SELECT id FROM public.pedidos WHERE client_user_id = auth.uid()
));

CREATE POLICY "Aliados logisticos can view order_items"
ON public.order_items FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'aliado_logistico'::app_role));

CREATE POLICY "Despachadores can view order_items"
ON public.order_items FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'despachador'::app_role));

CREATE POLICY "Motorizados can view assigned order items"
ON public.order_items FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'motorizado'::app_role) AND pedido_id IN (
  SELECT id FROM public.pedidos WHERE motorizado_id = auth.uid()
));
