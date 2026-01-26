-- Add fulfillment_rate to profiles for store-level pricing control by admin
ALTER TABLE public.profiles 
ADD COLUMN fulfillment_rate numeric DEFAULT 1900;

-- Add fulfillment_cost to pedidos to preserve the rate at order creation time
ALTER TABLE public.pedidos 
ADD COLUMN fulfillment_cost numeric DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.fulfillment_rate IS 'Admin-controlled fulfillment rate per order for this store (COP)';
COMMENT ON COLUMN public.pedidos.fulfillment_cost IS 'Fulfillment cost applied at order creation time (locked from store profile)';