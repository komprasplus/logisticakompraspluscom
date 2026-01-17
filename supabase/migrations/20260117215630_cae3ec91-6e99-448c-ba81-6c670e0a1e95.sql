-- Add zona column to pedidos table for logistics zoning
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS zona TEXT CHECK (zona IN ('NOR', 'OCC', 'CEN', 'SUR'));