
-- 1. Add B2B/B2C price visibility toggle on provider profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mostrar_precios_catalogo BOOLEAN NOT NULL DEFAULT true;

-- 2. Add wholesale cost price on inventory (separate from suggested PVP "price")
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- 3. Update slug-based catalog RPC to include description, cost_price, and price visibility
CREATE OR REPLACE FUNCTION public.get_public_provider_catalog_by_slug(slug TEXT)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid;
  v_show_prices boolean;
  v_provider jsonb;
  v_products jsonb;
  v_categories jsonb;
BEGIN
  SELECT p.user_id, COALESCE(p.mostrar_precios_catalogo, true)
    INTO v_provider_id, v_show_prices
  FROM public.profiles p
  WHERE p.catalog_slug = slug
    AND p.tipo_cuenta = 'proveedor'
    AND COALESCE(p.catalog_public_enabled, false) = true
    AND p.status = 'activo'
  LIMIT 1;

  IF v_provider_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT jsonb_build_object(
    'user_id',                  p.user_id,
    'slug',                     p.catalog_slug,
    'full_name',                p.full_name,
    'store_name',               COALESCE(p.store_name, p.full_name),
    'phone',                    p.phone,
    'logo_url',                 p.logo_url,
    'avatar_url',               p.avatar_url,
    'description',              p.catalog_description,
    'template',                 COALESCE(p.catalog_template, 'minimal'),
    'color_primary',            COALESCE(p.catalog_color_primary, '#00D1FF'),
    'color_secondary',          COALESCE(p.catalog_color_secondary, '#0099CC'),
    'mostrar_precios_catalogo', v_show_prices
  )
  INTO v_provider
  FROM public.profiles p
  WHERE p.user_id = v_provider_id;

  SELECT COALESCE(jsonb_agg(DISTINCT cat ORDER BY cat), '[]'::jsonb)
  INTO v_categories
  FROM (
    SELECT NULLIF(trim(i.category), '') AS cat
    FROM public.inventory i
    WHERE i.client_user_id = v_provider_id
      AND i.is_public = true
      AND COALESCE(i.is_deleted, false) = false
      AND i.stock_available > 0
      AND i.category IS NOT NULL
      AND trim(i.category) <> ''
  ) c
  WHERE cat IS NOT NULL;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',              i.id,
      'sku',             i.sku,
      'product_name',    i.product_name,
      'description',     i.description,
      'image_url',       i.image_url,
      'image_url_2',     i.image_url_2,
      'image_url_3',     i.image_url_3,
      'stock_available', i.stock_available,
      'price',           CASE WHEN v_show_prices THEN COALESCE(i.cost_price, i.price) ELSE NULL END,
      'category',        i.category,
      'short_id',        UPPER(SUBSTRING(REPLACE(i.id::text, '-', ''), 1, 6))
    )
    ORDER BY i.created_at DESC
  ), '[]'::jsonb)
  INTO v_products
  FROM public.inventory i
  WHERE i.client_user_id = v_provider_id
    AND i.is_public = true
    AND COALESCE(i.is_deleted, false) = false
    AND i.stock_available > 0;

  RETURN jsonb_build_object(
    'found',      true,
    'provider',   v_provider,
    'categories', v_categories,
    'products',   v_products
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_provider_catalog_by_slug(TEXT) TO anon, authenticated;

-- 4. Update product detail RPC for cost_price + description + visibility
CREATE OR REPLACE FUNCTION public.get_public_product_detail(slug TEXT, product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid;
  v_show_prices boolean;
  v_provider jsonb;
  v_product jsonb;
  v_related jsonb;
  v_category TEXT;
BEGIN
  SELECT p.user_id, COALESCE(p.mostrar_precios_catalogo, true)
    INTO v_provider_id, v_show_prices
  FROM public.profiles p
  WHERE p.catalog_slug = slug
    AND p.tipo_cuenta = 'proveedor'
    AND COALESCE(p.catalog_public_enabled, false) = true
    AND p.status = 'activo'
  LIMIT 1;

  IF v_provider_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT jsonb_build_object(
    'user_id',                  p.user_id,
    'slug',                     p.catalog_slug,
    'store_name',               COALESCE(p.store_name, p.full_name),
    'phone',                    p.phone,
    'logo_url',                 p.logo_url,
    'avatar_url',               p.avatar_url,
    'color_primary',            COALESCE(p.catalog_color_primary, '#00D1FF'),
    'color_secondary',          COALESCE(p.catalog_color_secondary, '#0099CC'),
    'mostrar_precios_catalogo', v_show_prices
  )
  INTO v_provider
  FROM public.profiles p
  WHERE p.user_id = v_provider_id;

  SELECT
    jsonb_build_object(
      'id',              i.id,
      'sku',             i.sku,
      'product_name',    i.product_name,
      'description',     i.description,
      'image_url',       i.image_url,
      'image_url_2',     i.image_url_2,
      'image_url_3',     i.image_url_3,
      'stock_available', i.stock_available,
      'price',           CASE WHEN v_show_prices THEN COALESCE(i.cost_price, i.price) ELSE NULL END,
      'category',        i.category,
      'short_id',        UPPER(SUBSTRING(REPLACE(i.id::text, '-', ''), 1, 6))
    ),
    i.category
  INTO v_product, v_category
  FROM public.inventory i
  WHERE i.id = product_id
    AND i.client_user_id = v_provider_id
    AND i.is_public = true
    AND COALESCE(i.is_deleted, false) = false;

  IF v_product IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT COALESCE(jsonb_agg(prod ORDER BY rnk), '[]'::jsonb)
  INTO v_related
  FROM (
    SELECT
      jsonb_build_object(
        'id',              i.id,
        'sku',             i.sku,
        'product_name',    i.product_name,
        'image_url',       i.image_url,
        'stock_available', i.stock_available,
        'price',           CASE WHEN v_show_prices THEN COALESCE(i.cost_price, i.price) ELSE NULL END,
        'category',        i.category,
        'short_id',        UPPER(SUBSTRING(REPLACE(i.id::text, '-', ''), 1, 6))
      ) AS prod,
      CASE WHEN v_category IS NOT NULL AND i.category = v_category THEN 0 ELSE 1 END AS rnk
    FROM public.inventory i
    WHERE i.client_user_id = v_provider_id
      AND i.is_public = true
      AND COALESCE(i.is_deleted, false) = false
      AND i.stock_available > 0
      AND i.id <> product_id
    ORDER BY rnk, i.created_at DESC
    LIMIT 6
  ) r;

  RETURN jsonb_build_object(
    'found',    true,
    'provider', v_provider,
    'product',  v_product,
    'related',  v_related
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_product_detail(TEXT, uuid) TO anon, authenticated;
