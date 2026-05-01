-- 1. Add catalog branding fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS catalog_template TEXT NOT NULL DEFAULT 'minimal',
  ADD COLUMN IF NOT EXISTS catalog_color_primary TEXT NOT NULL DEFAULT '#00D1FF',
  ADD COLUMN IF NOT EXISTS catalog_color_secondary TEXT NOT NULL DEFAULT '#0099CC',
  ADD COLUMN IF NOT EXISTS catalog_description TEXT,
  ADD COLUMN IF NOT EXISTS catalog_public_enabled BOOLEAN NOT NULL DEFAULT false;

-- 2. Public RPC for the catalog page (no auth required)
CREATE OR REPLACE FUNCTION public.get_public_provider_catalog(provider_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider jsonb;
  v_products jsonb;
BEGIN
  -- Fetch provider profile (only providers with public catalog enabled)
  SELECT jsonb_build_object(
    'user_id',         p.user_id,
    'full_name',       p.full_name,
    'store_name',      COALESCE(p.store_name, p.full_name),
    'phone',           p.phone,
    'logo_url',        p.logo_url,
    'avatar_url',      p.avatar_url,
    'description',     p.catalog_description,
    'template',        COALESCE(p.catalog_template, 'minimal'),
    'color_primary',   COALESCE(p.catalog_color_primary, '#00D1FF'),
    'color_secondary', COALESCE(p.catalog_color_secondary, '#0099CC')
  )
  INTO v_provider
  FROM public.profiles p
  WHERE p.user_id = provider_id
    AND p.tipo_cuenta = 'proveedor'
    AND COALESCE(p.catalog_public_enabled, false) = true
    AND p.status = 'activo'
  LIMIT 1;

  IF v_provider IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Fetch active public inventory items for this provider
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',                i.id,
      'sku',               i.sku,
      'product_name',      i.product_name,
      'image_url',         i.image_url,
      'stock_available',   i.stock_available,
      'price',             i.price,
      'short_id',          UPPER(SUBSTRING(REPLACE(i.id::text, '-', ''), 1, 6))
    )
    ORDER BY i.created_at DESC
  ), '[]'::jsonb)
  INTO v_products
  FROM public.inventory i
  WHERE i.client_user_id = provider_id
    AND i.is_public = true
    AND COALESCE(i.is_deleted, false) = false
    AND i.stock_available > 0;

  RETURN jsonb_build_object(
    'found',    true,
    'provider', v_provider,
    'products', v_products
  );
END;
$$;

-- 3. Allow anonymous + authenticated execution
GRANT EXECUTE ON FUNCTION public.get_public_provider_catalog(uuid) TO anon, authenticated;