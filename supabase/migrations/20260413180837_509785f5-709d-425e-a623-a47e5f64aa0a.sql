-- Add tipo_servicio column to pedidos for reverse logistics
ALTER TABLE public.pedidos
ADD COLUMN tipo_servicio TEXT NOT NULL DEFAULT 'ENVIO';

-- Add check constraint for valid values
ALTER TABLE public.pedidos
ADD CONSTRAINT pedidos_tipo_servicio_check CHECK (tipo_servicio IN ('ENVIO', 'RECOGIDA'));