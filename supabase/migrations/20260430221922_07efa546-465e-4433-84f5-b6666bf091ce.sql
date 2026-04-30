
-- 1. Add unidades_vendidas to marketplace_products and inventory
ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS unidades_vendidas INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS unidades_vendidas INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS unidades_vendidas INTEGER NOT NULL DEFAULT 0;

-- Idempotency guard column on pedidos to prevent double restock
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS stock_reabastecido BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Trigger: descuento de stock en INSERT order_items
CREATE OR REPLACE FUNCTION public.handle_order_item_stock_deduction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty INTEGER := COALESCE(NEW.quantity, 1);
BEGIN
  IF v_qty <= 0 THEN
    RETURN NEW;
  END IF;

  -- Marketplace product
  IF NEW.marketplace_product_id IS NOT NULL THEN
    UPDATE public.marketplace_products
      SET stock_available   = GREATEST(0, stock_available - v_qty),
          unidades_vendidas = unidades_vendidas + v_qty,
          updated_at        = NOW()
      WHERE id = NEW.marketplace_product_id;
  END IF;

  -- Variant
  IF NEW.variant_id IS NOT NULL THEN
    UPDATE public.product_variants
      SET stock_available   = GREATEST(0, stock_available - v_qty),
          unidades_vendidas = unidades_vendidas + v_qty,
          updated_at        = NOW()
      WHERE id = NEW.variant_id;
  END IF;

  -- Inventory propio
  IF NEW.inventory_item_id IS NOT NULL THEN
    UPDATE public.inventory
      SET stock_available   = GREATEST(0, stock_available - v_qty),
          unidades_vendidas = unidades_vendidas + v_qty,
          updated_at        = NOW()
      WHERE id = NEW.inventory_item_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_item_stock_deduction ON public.order_items;
CREATE TRIGGER trg_order_item_stock_deduction
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_item_stock_deduction();

-- 3. Trigger: reabastecimiento al pasar a Devolución/Anulado
CREATE OR REPLACE FUNCTION public.handle_pedido_stock_restock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estados_restock text[] := ARRAY['Devolución','devolucion','Devolucion','DEVUELTO','devuelto','Anulado','anulado','ANULADO'];
  v_item RECORD;
  v_qty INTEGER;
BEGIN
  IF NEW.estado = OLD.estado THEN RETURN NEW; END IF;
  IF NOT (NEW.estado = ANY(v_estados_restock)) THEN RETURN NEW; END IF;
  IF COALESCE(NEW.stock_reabastecido, false) THEN RETURN NEW; END IF;

  -- Reabastecer cada order_item
  FOR v_item IN
    SELECT marketplace_product_id, variant_id, inventory_item_id, COALESCE(quantity,1) AS qty
    FROM public.order_items
    WHERE pedido_id = NEW.id
  LOOP
    v_qty := v_item.qty;

    IF v_item.marketplace_product_id IS NOT NULL THEN
      UPDATE public.marketplace_products
        SET stock_available = stock_available + v_qty,
            unidades_vendidas = GREATEST(0, unidades_vendidas - v_qty),
            updated_at = NOW()
        WHERE id = v_item.marketplace_product_id;
    END IF;

    IF v_item.variant_id IS NOT NULL THEN
      UPDATE public.product_variants
        SET stock_available = stock_available + v_qty,
            unidades_vendidas = GREATEST(0, unidades_vendidas - v_qty),
            updated_at = NOW()
        WHERE id = v_item.variant_id;
    END IF;

    IF v_item.inventory_item_id IS NOT NULL THEN
      UPDATE public.inventory
        SET stock_available = stock_available + v_qty,
            unidades_vendidas = GREATEST(0, unidades_vendidas - v_qty),
            updated_at = NOW()
        WHERE id = v_item.inventory_item_id;
    END IF;
  END LOOP;

  -- Fallback: si pedido tiene inventory_item_id directo (legacy single-item) y NO hay order_items
  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE pedido_id = NEW.id)
     AND NEW.inventory_item_id IS NOT NULL THEN
    UPDATE public.inventory
      SET stock_available = stock_available + COALESCE(NEW.quantity, 1),
          unidades_vendidas = GREATEST(0, unidades_vendidas - COALESCE(NEW.quantity, 1)),
          updated_at = NOW()
      WHERE id = NEW.inventory_item_id;
  END IF;

  NEW.stock_reabastecido := true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedido_stock_restock ON public.pedidos;
CREATE TRIGGER trg_pedido_stock_restock
BEFORE UPDATE ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.handle_pedido_stock_restock();
