-- Create state_mappings table for external platform state mapping
CREATE TABLE IF NOT EXISTS public.state_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_state TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('dropi', 'mastershop', 'shopify', 'woocommerce')),
  external_state TEXT NOT NULL,
  external_code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(internal_state, platform)
);

-- Create api_logs table for tracking API activity
CREATE TABLE IF NOT EXISTS public.api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID REFERENCES public.api_credentials(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  action TEXT NOT NULL,
  request_payload JSONB,
  response_status INTEGER,
  response_message TEXT,
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for efficient log queries
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON public.api_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_credential ON public.api_logs(credential_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_platform ON public.api_logs(platform);

-- Enable RLS
ALTER TABLE public.state_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for state_mappings (admin only)
CREATE POLICY "Admins can manage state mappings"
ON public.state_mappings
FOR ALL
USING (is_admin());

-- RLS policies for api_logs
CREATE POLICY "Admins can view all api logs"
ON public.api_logs
FOR ALL
USING (is_admin());

CREATE POLICY "Clients can view their own api logs"
ON public.api_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'cliente'::app_role) AND 
  credential_id IN (
    SELECT id FROM public.api_credentials WHERE client_user_id = auth.uid()
  )
);

-- Insert default state mappings
INSERT INTO public.state_mappings (internal_state, platform, external_state, external_code) VALUES
-- Dropi mappings
('Recibido en Bodega', 'dropi', 'Procesando', '1'),
('Asignado', 'dropi', 'En Preparación', '2'),
('En Ruta', 'dropi', 'En Tránsito', '3'),
('Entregado', 'dropi', 'Entregado', '4'),
('Novedad', 'dropi', 'Novedad', '5'),
('Rechazado', 'dropi', 'Rechazado', '6'),
('Devolución', 'dropi', 'Devolución', '7'),
-- Mastershop mappings
('Recibido en Bodega', 'mastershop', 'In-Warehouse', 'WH'),
('Asignado', 'mastershop', 'Assigned', 'AS'),
('En Ruta', 'mastershop', 'Out-For-Delivery', 'OFD'),
('Entregado', 'mastershop', 'Delivered', 'DLV'),
('Novedad', 'mastershop', 'Exception', 'EXC'),
('Rechazado', 'mastershop', 'Rejected', 'REJ'),
('Devolución', 'mastershop', 'Returned', 'RET')
ON CONFLICT (internal_state, platform) DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER update_state_mappings_updated_at
BEFORE UPDATE ON public.state_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();