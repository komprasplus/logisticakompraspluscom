-- Update generator to produce 6-digit numeric IDs (no REF- prefix)
CREATE OR REPLACE FUNCTION public.generate_marketplace_short_id()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_id text;
  v_exists boolean;
  v_attempts int := 0;
BEGIN
  LOOP
    -- Random 6-digit numeric (100000 - 999999)
    v_id := LPAD((100000 + floor(random() * 900000)::int)::text, 6, '0');

    SELECT EXISTS(SELECT 1 FROM public.marketplace_products WHERE short_id = v_id)
      INTO v_exists;

    EXIT WHEN NOT v_exists;
    v_attempts := v_attempts + 1;
    IF v_attempts > 20 THEN
      -- Fallback: append timestamp-based digits
      v_id := LPAD((floor(random() * 1000000)::int)::text, 6, '0');
      EXIT;
    END IF;
  END LOOP;

  RETURN v_id;
END;
$function$;

-- Backfill existing products that still have REF- prefix or non-numeric short_id
DO $$
DECLARE
  rec RECORD;
  v_new text;
BEGIN
  FOR rec IN
    SELECT id FROM public.marketplace_products
    WHERE short_id IS NULL OR short_id !~ '^[0-9]{6}$'
  LOOP
    v_new := public.generate_marketplace_short_id();
    UPDATE public.marketplace_products SET short_id = v_new WHERE id = rec.id;
  END LOOP;
END $$;