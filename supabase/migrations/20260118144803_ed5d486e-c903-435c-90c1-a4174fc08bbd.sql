-- Add new columns for enhanced logistics tracking

-- Add novedad type column (Cliente Ausente, Dirección Errada, Teléfono no Contesta, Reprogramado)
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS tipo_novedad text;

-- Add coordinates for where novedad was reported
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS novedad_latitud double precision;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS novedad_longitud double precision;

-- Add signature data (base64 encoded)
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS firma_cliente text;

-- Add photo of delivered package
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS foto_paquete text;

-- Add timestamp for delivery/novedad
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS fecha_actualizacion timestamp with time zone;

-- Create index for faster filtering by estado
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON public.pedidos(estado);

-- Create index for faster filtering by motorizado
CREATE INDEX IF NOT EXISTS idx_pedidos_motorizado ON public.pedidos(motorizado_asignado);