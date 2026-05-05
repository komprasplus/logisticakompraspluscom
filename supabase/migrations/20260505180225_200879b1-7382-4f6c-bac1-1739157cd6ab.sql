CREATE OR REPLACE FUNCTION public.reconcile_order_supplier_ownership(p_pedido_id bigint)
RETURNS TABLE(matched int, total int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_matched int := 0;
  v_total int := 0;
  r record;
  inv record;
BEGIN
  SELECT organizacion_id INTO v_org FROM pedidos WHERE id = p_pedido_id;
  IF v_org IS NULL THEN
    v_org := 'a0000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  FOR r IN
    SELECT id, sku FROM order_items
    WHERE pedido_id = p_pedido_id
      AND (supplier_user_id IS NULL OR inventory_item_id IS NULL)
  LOOP
    v_total := v_total + 1;
    inv := NULL;

    -- Try by exact SKU match first
    IF r.sku IS NOT NULL AND length(trim(r.sku)) > 0 THEN
      SELECT i.id, i.client_user_id, i.cost_price
        INTO inv
        FROM inventory i
       WHERE i.organizacion_id = v_org
         AND i.is_deleted = false
         AND i.sku = r.sku
       LIMIT 1;

      -- Fallback: SKU field contains the inventory UUID (common when integrators
      -- paste the Plus Envíos product ID into Shopify's SKU field)
      IF inv IS NULL AND r.sku ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT i.id, i.client_user_id, i.cost_price
          INTO inv
          FROM inventory i
         WHERE i.organizacion_id = v_org
           AND i.is_deleted = false
           AND i.id::text = r.sku
         LIMIT 1;
      END IF;
    END IF;

    IF inv.id IS NOT NULL THEN
      UPDATE order_items
         SET inventory_item_id = inv.id,
             supplier_user_id = inv.client_user_id,
             supplier_cost_snapshot = inv.cost_price
       WHERE id = r.id;
      v_matched := v_matched + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_matched, v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_order_supplier_ownership(bigint) TO authenticated, service_role;