-- Add new columns to pedidos table for the order form
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS producto_nombre TEXT,
ADD COLUMN IF NOT EXISTS valor_recaudar NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS metodo_pago TEXT CHECK (metodo_pago IN ('efectivo', 'anticipado')),
ADD COLUMN IF NOT EXISTS fecha_entrega DATE,
ADD COLUMN IF NOT EXISTS barrio TEXT;