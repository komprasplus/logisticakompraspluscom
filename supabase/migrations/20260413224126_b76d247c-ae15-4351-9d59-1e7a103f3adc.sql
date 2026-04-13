-- Add soft delete column to inventory
ALTER TABLE public.inventory ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false;

-- Add soft delete column to marketplace_products
ALTER TABLE public.marketplace_products ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false;

-- Index for fast filtering of non-deleted items
CREATE INDEX idx_inventory_not_deleted ON public.inventory (is_deleted) WHERE is_deleted = false;
CREATE INDEX idx_marketplace_not_deleted ON public.marketplace_products (is_deleted) WHERE is_deleted = false;