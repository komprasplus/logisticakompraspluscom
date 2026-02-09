
-- Table for outbound webhook endpoints (clients configure their callback URLs)
CREATE TABLE public.webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id UUID NOT NULL,
  url TEXT NOT NULL,
  label TEXT DEFAULT 'Mi Webhook',
  secret TEXT, -- shared secret for HMAC signature verification
  events TEXT[] DEFAULT ARRAY['status_change']::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  last_status_code INTEGER,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for rate limiting tracking
CREATE TABLE public.api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID NOT NULL REFERENCES api_credentials(id) ON DELETE CASCADE,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(credential_id, window_start)
);

-- Enable RLS
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Webhook endpoints policies
CREATE POLICY "Clients can manage their own webhooks"
ON public.webhook_endpoints
FOR ALL
USING (has_role(auth.uid(), 'cliente') AND client_user_id = auth.uid())
WITH CHECK (has_role(auth.uid(), 'cliente') AND client_user_id = auth.uid());

CREATE POLICY "Admins full access to webhook_endpoints"
ON public.webhook_endpoints
FOR ALL
USING (is_admin());

-- Rate limits policies (service role only via edge functions, admin can view)
CREATE POLICY "Admins can view rate limits"
ON public.api_rate_limits
FOR SELECT
USING (is_admin());

-- Indexes
CREATE INDEX idx_webhook_endpoints_client ON public.webhook_endpoints(client_user_id) WHERE is_active = true;
CREATE INDEX idx_rate_limits_credential ON public.api_rate_limits(credential_id, window_start);

-- Trigger for updated_at
CREATE TRIGGER update_webhook_endpoints_updated_at
BEFORE UPDATE ON public.webhook_endpoints
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
