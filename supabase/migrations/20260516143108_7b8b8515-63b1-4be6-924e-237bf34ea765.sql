-- =====================================================================
-- BLINDAJE FINANCIERO: Forzar costo oficial del producto en pedidos
-- =====================================================================
-- Ignora cualquier valor enviado desde el frontend (web, white-label, API)
-- y consulta el costo real desde inventory / product_variants / marketplace_products.

-- ---------- TRIGGER 1: pedidos.valor_producto ----------
CREATE OR REPLACE FUNCTION public.enforce_pedido_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  official_cost numeric;
  qty integer;
BEGIN
  qty := COALESCE(NEW.quantity, 1);

  -- Prioridad 1: variante
  IF NEW.variant_id IS NOT NULL THEN
    SELECT cost_price INTO official_cost
    FROM public.product_variants
    WHERE id = NEW.variant_id;

  -- Prioridad 2: inventario propio
  ELSIF NEW.inventory_item_id IS NOT NULL THEN
    SELECT cost_price INTO official_cost
    FROM public.inventory
    WHERE id = NEW.inventory_item_id;
  END IF;

  -- Si encontramos costo oficial, lo forzamos. Caso contrario (multi-producto sin item único),
  -- dejamos que el trigger de order_items recalcule a partir de las líneas.
  IF official_cost IS NOT NULL THEN
    NEW.valor_producto := official_cost * qty;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pedido_cost ON public.pedidos;
CREATE TRIGGER trg_enforce_pedido_cost
BEFORE INSERT OR UPDATE OF valor_producto, inventory_item_id, variant_id, quantity
ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.enforce_pedido_cost();


-- ---------- TRIGGER 2: order_items.unit_price + supplier_cost_snapshot ----------
CREATE OR REPLACE FUNCTION public.enforce_order_item_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  official_cost numeric;
  official_supplier uuid;
BEGIN
  -- Prioridad 1: variante
  IF NEW.variant_id IS NOT NULL THEN
    SELECT pv.cost_price, mp.created_by
      INTO official_cost, official_supplier
    FROM public.product_variants pv
    LEFT JOIN public.marketplace_products mp ON mp.id = pv.product_id
    WHERE pv.id = NEW.variant_id;

  -- Prioridad 2: producto marketplace
  ELSIF NEW.marketplace_product_id IS NOT NULL THEN
    SELECT cost_price, created_by
      INTO official_cost, official_supplier
    FROM public.marketplace_products
    WHERE id = NEW.marketplace_product_id;

  -- Prioridad 3: inventario propio
  ELSIF NEW.inventory_item_id IS NOT NULL THEN
    SELECT cost_price, client_user_id
      INTO official_cost, official_supplier
    FROM public.inventory
    WHERE id = NEW.inventory_item_id;
  END IF;

  IF official_cost IS NOT NULL THEN
    NEW.unit_price := official_cost;
    NEW.supplier_cost_snapshot := official_cost;
  END IF;

  IF official_supplier IS NOT NULL AND NEW.supplier_user_id IS NULL THEN
    NEW.supplier_user_id := official_supplier;
  END IF;

  -- Recalcular line_total con el costo oficial
  NEW.line_total := COALESCE(NEW.unit_price, 0) * COALESCE(NEW.quantity, 1);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_item_cost ON public.order_items;
CREATE TRIGGER trg_enforce_order_item_cost
BEFORE INSERT OR UPDATE OF unit_price, supplier_cost_snapshot, inventory_item_id, variant_id, marketplace_product_id, quantity
ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_order_item_cost();


-- ---------- TRIGGER 3: Sincronizar pedidos.valor_producto desde order_items (multi-producto) ----------
CREATE OR REPLACE FUNCTION public.sync_pedido_cost_from_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_cost numeric;
  pid bigint;
BEGIN
  pid := COALESCE(NEW.pedido_id, OLD.pedido_id);

  SELECT COALESCE(SUM(line_total), 0)
  INTO total_cost
  FROM public.order_items
  WHERE pedido_id = pid;

  IF total_cost > 0 THEN
    UPDATE public.pedidos
    SET valor_producto = total_cost
    WHERE id = pid;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_pedido_cost_from_items ON public.order_items;
CREATE TRIGGER trg_sync_pedido_cost_from_items
AFTER INSERT OR UPDATE OR DELETE
ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_pedido_cost_from_items();
