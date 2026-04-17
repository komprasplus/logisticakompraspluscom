-- Add integration_partner column to pedidos
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS integration_partner text;

CREATE INDEX IF NOT EXISTS idx_pedidos_integration_partner
  ON public.pedidos(integration_partner)
  WHERE integration_partner IS NOT NULL;

-- Audit table for Dropium sync (push + webhook)
CREATE TABLE IF NOT EXISTS public.dropium_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id bigint,
  numero_guia text,
  action text NOT NULL, -- 'push_create', 'push_cancel', 'webhook_received'
  detail_code text,
  external_status text,
  internal_status text,
  request_payload jsonb,
  response_payload jsonb,
  http_status integer,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  organizacion_id uuid DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dropium_sync_logs_pedido ON public.dropium_sync_logs(pedido_id);
CREATE INDEX IF NOT EXISTS idx_dropium_sync_logs_guia ON public.dropium_sync_logs(numero_guia);
CREATE INDEX IF NOT EXISTS idx_dropium_sync_logs_created ON public.dropium_sync_logs(created_at DESC);

ALTER TABLE public.dropium_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own org dropium_sync_logs"
  ON public.dropium_sync_logs
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND organizacion_id = get_user_org_id()
  );

CREATE POLICY "Super admins full access to dropium_sync_logs"
  ON public.dropium_sync_logs
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
