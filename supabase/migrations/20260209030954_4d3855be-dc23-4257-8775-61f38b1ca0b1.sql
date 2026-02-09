
-- PASO 2: Columnas + funciones (sin depender de enum super_admin)

-- Columnas organizacion_id
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organizacion_id uuid REFERENCES public.organizaciones(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS organizacion_id uuid REFERENCES public.organizaciones(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS organizacion_id uuid REFERENCES public.organizaciones(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS organizacion_id uuid REFERENCES public.organizaciones(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.transacciones_billetera ADD COLUMN IF NOT EXISTS organizacion_id uuid REFERENCES public.organizaciones(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.pedido_messages ADD COLUMN IF NOT EXISTS organizacion_id uuid REFERENCES public.organizaciones(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.pedido_status_logs ADD COLUMN IF NOT EXISTS organizacion_id uuid REFERENCES public.organizaciones(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.notification_logs ADD COLUMN IF NOT EXISTS organizacion_id uuid REFERENCES public.organizaciones(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.location_history ADD COLUMN IF NOT EXISTS organizacion_id uuid REFERENCES public.organizaciones(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.api_credentials ADD COLUMN IF NOT EXISTS organizacion_id uuid REFERENCES public.organizaciones(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.webhook_endpoints ADD COLUMN IF NOT EXISTS organizacion_id uuid REFERENCES public.organizaciones(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';

-- Migrar datos existentes
UPDATE public.profiles SET organizacion_id = 'a0000000-0000-0000-0000-000000000001' WHERE organizacion_id IS NULL;
UPDATE public.pedidos SET organizacion_id = 'a0000000-0000-0000-0000-000000000001' WHERE organizacion_id IS NULL;
UPDATE public.user_roles SET organizacion_id = 'a0000000-0000-0000-0000-000000000001' WHERE organizacion_id IS NULL;
UPDATE public.inventory SET organizacion_id = 'a0000000-0000-0000-0000-000000000001' WHERE organizacion_id IS NULL;
UPDATE public.transacciones_billetera SET organizacion_id = 'a0000000-0000-0000-0000-000000000001' WHERE organizacion_id IS NULL;
UPDATE public.pedido_messages SET organizacion_id = 'a0000000-0000-0000-0000-000000000001' WHERE organizacion_id IS NULL;
UPDATE public.pedido_status_logs SET organizacion_id = 'a0000000-0000-0000-0000-000000000001' WHERE organizacion_id IS NULL;
UPDATE public.notification_logs SET organizacion_id = 'a0000000-0000-0000-0000-000000000001' WHERE organizacion_id IS NULL;
UPDATE public.location_history SET organizacion_id = 'a0000000-0000-0000-0000-000000000001' WHERE organizacion_id IS NULL;
UPDATE public.api_credentials SET organizacion_id = 'a0000000-0000-0000-0000-000000000001' WHERE organizacion_id IS NULL;
UPDATE public.webhook_endpoints SET organizacion_id = 'a0000000-0000-0000-0000-000000000001' WHERE organizacion_id IS NULL;

-- Función org helper
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT organizacion_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1 $$;

-- Super admin check usando cast a text para evitar error de enum
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'super_admin') $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_org ON public.pedidos(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_org ON public.user_roles(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_inventory_org ON public.inventory(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_location_history_org ON public.location_history(organizacion_id);

-- RLS
CREATE POLICY "Super admins full access" ON public.organizaciones FOR ALL USING (is_super_admin());
CREATE POLICY "Users can view their own org" ON public.organizaciones FOR SELECT USING (id = get_user_org_id());

-- Trigger
DROP TRIGGER IF EXISTS update_organizaciones_updated_at ON public.organizaciones;
CREATE TRIGGER update_organizaciones_updated_at BEFORE UPDATE ON public.organizaciones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
