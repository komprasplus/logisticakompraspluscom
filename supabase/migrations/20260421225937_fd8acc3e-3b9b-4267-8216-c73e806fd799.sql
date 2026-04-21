-- Create manifiestos table for pickup manifest auditing
CREATE TABLE public.manifiestos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manifiesto_numero TEXT NOT NULL UNIQUE,
  client_user_id UUID NOT NULL,
  organizacion_id UUID DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  pedido_ids BIGINT[] NOT NULL DEFAULT '{}',
  total_paquetes INTEGER NOT NULL DEFAULT 0,
  store_name TEXT,
  estado TEXT NOT NULL DEFAULT 'generado',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.manifiestos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Clients can view own manifiestos"
ON public.manifiestos FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'cliente'::app_role) AND client_user_id = auth.uid());

CREATE POLICY "Clients can insert own manifiestos"
ON public.manifiestos FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'cliente'::app_role) AND client_user_id = auth.uid());

CREATE POLICY "Admins can view own org manifiestos"
ON public.manifiestos FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND organizacion_id = get_user_org_id());

CREATE POLICY "Admins can manage own org manifiestos"
ON public.manifiestos FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND organizacion_id = get_user_org_id())
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND organizacion_id = get_user_org_id());

CREATE POLICY "Super admins full access manifiestos"
ON public.manifiestos FOR ALL
TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- Index for fast lookups
CREATE INDEX idx_manifiestos_client_user_id ON public.manifiestos(client_user_id);
CREATE INDEX idx_manifiestos_organizacion_id ON public.manifiestos(organizacion_id);
CREATE INDEX idx_manifiestos_created_at ON public.manifiestos(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_manifiestos_updated_at
BEFORE UPDATE ON public.manifiestos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();