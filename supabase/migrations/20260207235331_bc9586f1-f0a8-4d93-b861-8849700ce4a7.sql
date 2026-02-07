
-- Create wallet transactions table for granular payment tracking
CREATE TABLE public.transacciones_billetera (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_user_id UUID NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'PAGO_TIENDA',
  monto NUMERIC NOT NULL,
  saldo_anterior NUMERIC NOT NULL DEFAULT 0,
  saldo_nuevo NUMERIC NOT NULL DEFAULT 0,
  notas TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transacciones_billetera ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins full access to transacciones_billetera"
ON public.transacciones_billetera
FOR ALL
USING (is_admin());

-- Clients can view their own transactions
CREATE POLICY "Clients can view own transactions"
ON public.transacciones_billetera
FOR SELECT
USING (has_role(auth.uid(), 'cliente'::app_role) AND client_user_id = auth.uid());

-- Index for fast client lookups
CREATE INDEX idx_transacciones_billetera_client ON public.transacciones_billetera (client_user_id, created_at DESC);
