
-- 1. Slug column on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS catalog_slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_catalog_slug_unique
  ON public.profiles (catalog_slug)
  WHERE catalog_slug IS NOT NULL;

-- 2. Slug helper: lowercase, ascii, hyphenated, max 60 chars
CREATE OR REPLACE FUNCTION public.slugify(input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s TEXT;
BEGIN
  IF input IS NULL OR length(trim(input)) = 0 THEN
    RETURN NULL;
  END IF;
  s := lower(trim(input));
  -- Replace common accented chars
  s := translate(s,
    'áàäâãéèëêíìïîóòöôõúùüûñç',
    'aaaaaeeeeiiiiooooouuuunc');
  -- Strip non alnum -> hyphen
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
  s := regexp_replace(s, '(^-+|-+$)', '', 'g');
  s := substring(s, 1, 60);
  IF length(s) = 0 THEN
    s := NULL;
  END IF;
  RETURN s;
END;
$$;

-- 3. Backfill slugs for existing providers (uniqueness via short user_id suffix)
UPDATE public.profiles p
SET catalog_slug = base.slug || '-' || substring(replace(p.user_id::text, '-', ''), 1, 6)
FROM (
  SELECT user_id, COALESCE(public.slugify(store_name), public.slugify(full_name), 'tienda') AS slug
  FROM public.profiles
  WHERE tipo_cuenta = 'proveedor' AND catalog_slug IS NULL
) base
WHERE p.user_id = base.user_id
  AND p.catalog_slug IS NULL;

-- 4. Trigger: autogenerate slug on insert/update if missing or store_name changed
CREATE OR REPLACE FUNCTION public.profiles_autogen_catalog_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  base TEXT;
  candidate TEXT;
  suffix TEXT;
BEGIN
  IF NEW.tipo_cuenta IS DISTINCT FROM 'proveedor' THEN
    RETURN NEW;
  END IF;

  IF NEW.catalog_slug IS NOT NULL AND NEW.catalog_slug <> '' THEN
    -- Normalise whatever was provided
    NEW.catalog_slug := public.slugify(NEW.catalog_slug);
  END IF;

  IF NEW.catalog_slug IS NULL OR NEW.catalog_slug = '' THEN
    base := COALESCE(public.slugify(NEW.store_name), public.slugify(NEW.full_name), 'tienda');
    suffix := substring(replace(NEW.user_id::text, '-', ''), 1, 6);
    candidate := base || '-' || suffix;
    NEW.catalog_slug := candidate;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_autogen_catalog_slug ON public.profiles;
CREATE TRIGGER trg_profiles_autogen_catalog_slug
BEFORE INSERT OR UPDATE OF store_name, full_name, tipo_cuenta, catalog_slug
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_autogen_catalog_slug();

-- 5. Inventory enrichments for catalog UX
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS image_url_2 TEXT,
  ADD COLUMN IF NOT EXISTS image_url_3 TEXT;

-- 6. Slug-based public RPC
CREATE OR REPLACE FUNCTION public.get_public_provider_catalog_by_slug(slug TEXT)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid;
  v_provider jsonb;
  v_products jsonb;
  v_categories jsonb;
BEGIN
  SELECT p.user_id INTO v_provider_id
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
    'user_id',         p.user_id,
    'slug',            p.catalog_slug,
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
      'image_url',       i.image_url,
      'image_url_2',     i.image_url_2,
      'image_url_3',     i.image_url_3,
      'stock_available', i.stock_available,
      'price',           i.price,
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

-- 7. Product detail + related products RPC
CREATE OR REPLACE FUNCTION public.get_public_product_detail(slug TEXT, product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid;
  v_provider jsonb;
  v_product jsonb;
  v_related jsonb;
  v_category TEXT;
BEGIN
  SELECT p.user_id INTO v_provider_id
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
    'user_id',         p.user_id,
    'slug',            p.catalog_slug,
    'store_name',      COALESCE(p.store_name, p.full_name),
    'phone',           p.phone,
    'logo_url',        p.logo_url,
    'avatar_url',      p.avatar_url,
    'color_primary',   COALESCE(p.catalog_color_primary, '#00D1FF'),
    'color_secondary', COALESCE(p.catalog_color_secondary, '#0099CC')
  )
  INTO v_provider
  FROM public.profiles p
  WHERE p.user_id = v_provider_id;

  SELECT
    jsonb_build_object(
      'id',              i.id,
      'sku',             i.sku,
      'product_name',    i.product_name,
      'description',     NULL,
      'image_url',       i.image_url,
      'image_url_2',     i.image_url_2,
      'image_url_3',     i.image_url_3,
      'stock_available', i.stock_available,
      'price',           i.price,
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
        'price',           i.price,
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
