-- Multi-store integration table (1 user : N stores)
CREATE TABLE public.connected_stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  organizacion_id UUID,
  plataforma TEXT NOT NULL DEFAULT 'shopify',
  nombre_tienda TEXT NOT NULL,
  url_tienda TEXT NOT NULL,
  api_access_token TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'Activo',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT connected_stores_url_unique UNIQUE (url_tienda),
  CONSTRAINT connected_stores_estado_chk CHECK (estado IN ('Activo','Inactivo'))
);

CREATE INDEX idx_connected_stores_user ON public.connected_stores(user_id);
CREATE INDEX idx_connected_stores_url ON public.connected_stores(url_tienda);
CREATE INDEX idx_connected_stores_org ON public.connected_stores(organizacion_id);

ALTER TABLE public.connected_stores ENABLE ROW LEVEL SECURITY;

-- Owner policies
CREATE POLICY "Owners can view their stores"
  ON public.connected_stores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can insert their stores"
  ON public.connected_stores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update their stores"
  ON public.connected_stores FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete their stores"
  ON public.connected_stores FOR DELETE
  USING (auth.uid() = user_id);

-- Admin / Super Admin visibility within org
CREATE POLICY "Admins view org stores"
  ON public.connected_stores FOR SELECT
  USING (
    public.is_super_admin()
    OR (public.is_admin() AND organizacion_id = public.get_user_org_id())
  );

-- Auto-update updated_at
CREATE TRIGGER trg_connected_stores_updated_at
  BEFORE UPDATE ON public.connected_stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-fill organizacion_id from owner profile if missing
CREATE OR REPLACE FUNCTION public.connected_stores_fill_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organizacion_id IS NULL THEN
    SELECT organizacion_id INTO NEW.organizacion_id
    FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;
  END IF;
  -- Normalise URL (lowercase, strip protocol/trailing slash)
  NEW.url_tienda := lower(regexp_replace(regexp_replace(NEW.url_tienda, '^https?://', ''), '/+$', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_connected_stores_fill_org
  BEFORE INSERT OR UPDATE ON public.connected_stores
  FOR EACH ROW EXECUTE FUNCTION public.connected_stores_fill_org();

-- Resolver function for Edge Functions (webhook → owner)
CREATE OR REPLACE FUNCTION public.resolve_store_owner(p_shop_domain TEXT)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT id, user_id, organizacion_id, plataforma, nombre_tienda, url_tienda, estado
  INTO v_row
  FROM public.connected_stores
  WHERE url_tienda = lower(regexp_replace(regexp_replace(p_shop_domain, '^https?://', ''), '/+$', ''))
    AND estado = 'Activo'
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'store_id', v_row.id,
    'user_id', v_row.user_id,
    'organizacion_id', v_row.organizacion_id,
    'plataforma', v_row.plataforma,
    'nombre_tienda', v_row.nombre_tienda,
    'url_tienda', v_row.url_tienda
  );
END;
$$;