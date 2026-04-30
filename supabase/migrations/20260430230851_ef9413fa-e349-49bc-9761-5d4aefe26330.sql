-- 1. Add short_id column to marketplace_products
ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS short_id text UNIQUE;

-- 2. Function to generate a short readable ID like REF-AB12CD
CREATE OR REPLACE FUNCTION public.generate_marketplace_short_id()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- omit confusing chars (I,O,0,1)
  v_id text;
  v_exists boolean;
  v_attempts int := 0;
BEGIN
  LOOP
    v_id := 'REF-';
    FOR i IN 1..6 LOOP
      v_id := v_id || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    END LOOP;

    SELECT EXISTS(SELECT 1 FROM public.marketplace_products WHERE short_id = v_id)
      INTO v_exists;

    EXIT WHEN NOT v_exists;
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      v_id := 'REF-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      EXIT;
    END IF;
  END LOOP;

  RETURN v_id;
END;
$$;

-- 3. Trigger to auto-assign short_id on insert and prevent updates
CREATE OR REPLACE FUNCTION public.handle_marketplace_short_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.short_id IS NULL OR NEW.short_id = '' THEN
      NEW.short_id := public.generate_marketplace_short_id();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Make short_id immutable
    IF OLD.short_id IS NOT NULL AND NEW.short_id IS DISTINCT FROM OLD.short_id THEN
      NEW.short_id := OLD.short_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marketplace_short_id ON public.marketplace_products;
CREATE TRIGGER trg_marketplace_short_id
  BEFORE INSERT OR UPDATE ON public.marketplace_products
  FOR EACH ROW EXECUTE FUNCTION public.handle_marketplace_short_id();

-- 4. Backfill existing rows
UPDATE public.marketplace_products
  SET short_id = public.generate_marketplace_short_id()
  WHERE short_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketplace_products_short_id
  ON public.marketplace_products (short_id);

-- 5. Favorites table
CREATE TABLE IF NOT EXISTS public.marketplace_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  organizacion_id uuid DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_favorites_user
  ON public.marketplace_favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_favorites_product
  ON public.marketplace_favorites (product_id);

ALTER TABLE public.marketplace_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
  ON public.marketplace_favorites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
  ON public.marketplace_favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
  ON public.marketplace_favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view org favorites"
  ON public.marketplace_favorites FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND organizacion_id = public.get_user_org_id());

CREATE POLICY "Super admins full access favorites"
  ON public.marketplace_favorites FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());