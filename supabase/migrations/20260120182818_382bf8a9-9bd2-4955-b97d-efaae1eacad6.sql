-- Create audit log table for order status changes
CREATE TABLE public.pedido_status_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id BIGINT NOT NULL,
  estado_anterior TEXT,
  estado_nuevo TEXT NOT NULL,
  usuario_id UUID,
  usuario_nombre TEXT,
  motivo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_pedido_status_logs_pedido_id ON public.pedido_status_logs(pedido_id);
CREATE INDEX idx_pedido_status_logs_created_at ON public.pedido_status_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.pedido_status_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view and insert logs
CREATE POLICY "Admins can manage status logs" 
ON public.pedido_status_logs 
FOR ALL 
USING (is_admin());

-- Motorizados can view logs for their assigned orders
CREATE POLICY "Motorizados can view their order logs" 
ON public.pedido_status_logs 
FOR SELECT 
USING (
  has_role(auth.uid(), 'motorizado') 
  AND pedido_id IN (
    SELECT id FROM public.pedidos WHERE motorizado_id = auth.uid()
  )
);

-- Clients can view logs for their orders
CREATE POLICY "Clients can view their order logs" 
ON public.pedido_status_logs 
FOR SELECT 
USING (
  has_role(auth.uid(), 'cliente') 
  AND pedido_id IN (
    SELECT id FROM public.pedidos WHERE client_user_id = auth.uid()
  )
);

-- Allow authenticated users (motorizados) to insert logs for their orders
CREATE POLICY "Motorizados can insert logs for their orders" 
ON public.pedido_status_logs 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'motorizado')
  AND pedido_id IN (
    SELECT id FROM public.pedidos WHERE motorizado_id = auth.uid()
  )
);

-- Comment for documentation
COMMENT ON TABLE public.pedido_status_logs IS 'Audit log for tracking order status changes including who made the change and when';