CREATE TABLE IF NOT EXISTS public.oauth_states (
  state UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  shop_domain TEXT NOT NULL,
  nombre_tienda TEXT,
  provider TEXT NOT NULL DEFAULT 'shopify',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON public.oauth_states(expires_at);

ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- No policies = no access for anon/authenticated users. Only service role bypasses RLS.