-- Ensure fast lookups for client pedidos list (client_user_id + newest first)
CREATE INDEX IF NOT EXISTS idx_pedidos_client_user_created_at
ON public.pedidos (client_user_id, fecha_creacion DESC);

-- Optional: if you frequently filter by estado in client view, this helps combined filters
CREATE INDEX IF NOT EXISTS idx_pedidos_client_user_estado
ON public.pedidos (client_user_id, estado);
