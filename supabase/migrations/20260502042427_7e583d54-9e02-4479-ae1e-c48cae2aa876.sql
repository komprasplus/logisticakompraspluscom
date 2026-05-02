ALTER TABLE public.marketplace_products ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS subcategory TEXT;
CREATE INDEX IF NOT EXISTS idx_marketplace_products_category_subcategory ON public.marketplace_products(category, subcategory);