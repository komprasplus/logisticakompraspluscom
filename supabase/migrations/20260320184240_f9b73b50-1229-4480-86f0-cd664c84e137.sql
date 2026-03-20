-- Phase 1: Shadow table for incoming webhooks (completely isolated)
CREATE TABLE IF NOT EXISTS public.webhook_logs_incoming (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'unknown',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processing_status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_logs_status ON public.webhook_logs_incoming(processing_status);
CREATE INDEX idx_webhook_logs_created ON public.webhook_logs_incoming(created_at DESC);

ALTER TABLE public.webhook_logs_incoming ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage webhook logs"
  ON public.webhook_logs_incoming
  FOR ALL
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Allow public inserts for webhooks"
  ON public.webhook_logs_incoming
  FOR INSERT
  TO anon
  WITH CHECK (true);