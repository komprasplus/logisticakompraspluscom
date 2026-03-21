
-- 1. Admin Wallet Ledger (immutable financial log)
CREATE TABLE IF NOT EXISTS public.admin_wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id BIGINT REFERENCES public.pedidos(id),
  transaction_type TEXT NOT NULL DEFAULT 'CREDIT',
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  organizacion_id UUID DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_wallet_created ON public.admin_wallet_ledger(created_at DESC);
CREATE INDEX idx_admin_wallet_org ON public.admin_wallet_ledger(organizacion_id);
CREATE UNIQUE INDEX idx_admin_wallet_pedido_unique ON public.admin_wallet_ledger(pedido_id) WHERE pedido_id IS NOT NULL;

ALTER TABLE public.admin_wallet_ledger ENABLE ROW LEVEL SECURITY;

-- Only admins can read; nobody can update/delete (immutable)
CREATE POLICY "Admins can view admin_wallet_ledger"
  ON public.admin_wallet_ledger FOR SELECT
  USING (public.is_admin());

-- 2. Trigger function to calculate admin profit on delivery
CREATE OR REPLACE FUNCTION public.calculate_admin_profit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_flete NUMERIC;
  v_fulfillment NUMERIC;
  v_profit NUMERIC;
BEGIN
  -- Only on state change to delivered/liquidado
  IF NEW.estado = OLD.estado THEN RETURN NEW; END IF;
  IF NEW.estado NOT IN ('Entregado', 'entregado', 'Liquidado', 'liquidado') THEN RETURN NEW; END IF;

  v_flete       := COALESCE(NEW.valor_flete, 0);
  v_fulfillment := COALESCE(NEW.fulfillment_cost, 0);
  v_profit      := v_flete - v_fulfillment;

  -- Skip zero or negative margins
  IF v_profit <= 0 THEN RETURN NEW; END IF;

  INSERT INTO public.admin_wallet_ledger (
    pedido_id, transaction_type, amount, description, organizacion_id
  ) VALUES (
    NEW.id,
    'CREDIT',
    v_profit,
    'Margen Guía ' || COALESCE(NEW.numero_guia, '#' || NEW.id::text)
      || ' | Flete ' || v_flete || ' - Costo ' || v_fulfillment,
    NEW.organizacion_id
  )
  ON CONFLICT (pedido_id) WHERE pedido_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. Trigger
DROP TRIGGER IF EXISTS trg_admin_profit_on_delivery ON public.pedidos;
CREATE TRIGGER trg_admin_profit_on_delivery
  AFTER UPDATE OF estado ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_admin_profit();
