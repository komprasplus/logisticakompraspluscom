-- Table for internal chat messages per order (motorizado <-> tienda communication)
CREATE TABLE public.pedido_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id BIGINT NOT NULL,
  sender_id UUID NOT NULL,
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('motorizado', 'cliente', 'admin', 'despachador')),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pedido_messages ENABLE ROW LEVEL SECURITY;

-- Index for fast lookups by pedido
CREATE INDEX idx_pedido_messages_pedido_id ON public.pedido_messages (pedido_id, created_at);

-- Admins full access
CREATE POLICY "Admins full access to pedido_messages"
  ON public.pedido_messages FOR ALL
  USING (is_admin());

-- Motorizados can view/insert messages for their assigned orders
CREATE POLICY "Motorizados can view messages for their orders"
  ON public.pedido_messages FOR SELECT
  USING (
    has_role(auth.uid(), 'motorizado') AND 
    pedido_id IN (SELECT id FROM pedidos WHERE motorizado_id = auth.uid())
  );

CREATE POLICY "Motorizados can send messages for their orders"
  ON public.pedido_messages FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'motorizado') AND 
    sender_id = auth.uid() AND
    pedido_id IN (SELECT id FROM pedidos WHERE motorizado_id = auth.uid())
  );

-- Clients can view/insert messages for their orders
CREATE POLICY "Clients can view messages for their orders"
  ON public.pedido_messages FOR SELECT
  USING (
    has_role(auth.uid(), 'cliente') AND 
    pedido_id IN (SELECT id FROM pedidos WHERE client_user_id = auth.uid())
  );

CREATE POLICY "Clients can send messages for their orders"
  ON public.pedido_messages FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'cliente') AND 
    sender_id = auth.uid() AND
    pedido_id IN (SELECT id FROM pedidos WHERE client_user_id = auth.uid())
  );

-- Despachadores can view messages
CREATE POLICY "Despachadores can view messages"
  ON public.pedido_messages FOR SELECT
  USING (has_role(auth.uid(), 'despachador'));

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedido_messages;
