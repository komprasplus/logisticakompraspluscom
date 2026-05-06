ALTER TABLE public.connected_stores
  ADD COLUMN IF NOT EXISTS meli_user_id text,
  ADD COLUMN IF NOT EXISTS meli_refresh_token text,
  ADD COLUMN IF NOT EXISTS meli_token_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_connected_stores_meli_user_id
  ON public.connected_stores(meli_user_id)
  WHERE meli_user_id IS NOT NULL;