-- Add observaciones field to pedidos table for critical notes
ALTER TABLE public.pedidos 
ADD COLUMN IF NOT EXISTS observaciones TEXT NULL;

-- Add delivery attempts counter
ALTER TABLE public.pedidos 
ADD COLUMN IF NOT EXISTS intentos_entrega INTEGER DEFAULT 0;

-- Add return charge tracking field  
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS costo_devolucion NUMERIC DEFAULT 0;

-- Add flag to track if return charge was applied
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS devolucion_cobrada BOOLEAN DEFAULT false;

-- Create notification logs table for WhatsApp simulation
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    pedido_id BIGINT NOT NULL,
    tipo TEXT NOT NULL, -- 'whatsapp', 'sms', 'email'
    mensaje TEXT NOT NULL,
    destinatario TEXT NOT NULL,
    estado TEXT DEFAULT 'simulado', -- 'simulado', 'enviado', 'error'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on notification_logs
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification_logs
CREATE POLICY "Admins can manage notification logs" 
ON public.notification_logs 
FOR ALL 
USING (is_admin());

CREATE POLICY "Clients can view their order notifications" 
ON public.notification_logs 
FOR SELECT 
USING (
    has_role(auth.uid(), 'cliente'::app_role) AND 
    pedido_id IN (SELECT id FROM pedidos WHERE client_user_id = auth.uid())
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notification_logs_pedido_id ON public.notification_logs(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_intentos ON public.pedidos(intentos_entrega);