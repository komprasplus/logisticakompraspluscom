-- Create inventory table for client products
CREATE TABLE public.inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_user_id UUID NOT NULL,
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  stock_available INTEGER NOT NULL DEFAULT 0,
  price NUMERIC DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_client_sku UNIQUE (client_user_id, sku)
);

-- Enable Row Level Security
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Clients can view their own inventory" 
ON public.inventory 
FOR SELECT 
USING (has_role(auth.uid(), 'cliente') AND client_user_id = auth.uid());

CREATE POLICY "Clients can insert their own inventory" 
ON public.inventory 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'cliente') AND client_user_id = auth.uid());

CREATE POLICY "Clients can update their own inventory" 
ON public.inventory 
FOR UPDATE 
USING (has_role(auth.uid(), 'cliente') AND client_user_id = auth.uid());

CREATE POLICY "Clients can delete their own inventory" 
ON public.inventory 
FOR DELETE 
USING (has_role(auth.uid(), 'cliente') AND client_user_id = auth.uid());

CREATE POLICY "Admins full access to inventory" 
ON public.inventory 
FOR ALL 
USING (is_admin());

-- Create trigger for updated_at
CREATE TRIGGER update_inventory_updated_at
BEFORE UPDATE ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_inventory_client_user_id ON public.inventory(client_user_id);
CREATE INDEX idx_inventory_sku ON public.inventory(sku);

-- Add inventory_item_id to pedidos for linking orders to inventory
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES public.inventory(id);
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;