import { supabase } from "@/integrations/supabase/client";

/**
 * Deduct inventory stock when an order is marked as "Entregado"
 * This should be called after successfully updating order status to Entregado
 */
export const deductInventoryOnDelivery = async (
  pedidoId: number,
  inventoryItemId: string | null,
  quantity: number = 1
): Promise<{ success: boolean; error?: string }> => {
  if (!inventoryItemId) {
    // Order not linked to inventory - skip deduction
    return { success: true };
  }

  try {
    // Get current stock - use 'as any' since types may not be updated yet
    const { data: item, error: fetchError } = await (supabase as any)
      .from("inventory")
      .select("stock_available, product_name")
      .eq("id", inventoryItemId)
      .single();

    if (fetchError) {
      console.error("Error fetching inventory item:", fetchError);
      return { success: false, error: "Error al buscar producto en inventario" };
    }

    if (!item) {
      return { success: false, error: "Producto no encontrado en inventario" };
    }

    // Calculate new stock (don't allow negative)
    const newStock = Math.max(0, item.stock_available - quantity);

    // Update inventory
    const { error: updateError } = await (supabase as any)
      .from("inventory")
      .update({ stock_available: newStock })
      .eq("id", inventoryItemId);

    if (updateError) {
      console.error("Error updating inventory:", updateError);
      return { success: false, error: "Error al actualizar inventario" };
    }

    console.log(
      `✅ Inventory deducted: ${item.product_name} (${item.stock_available} → ${newStock})`
    );
    return { success: true };
  } catch (error) {
    console.error("Error in deductInventoryOnDelivery:", error);
    return { success: false, error: "Error inesperado" };
  }
};

/**
 * Restore inventory stock when a return is received at warehouse
 * This should be called when order status changes to "Recibido en Bodega" (from Devolución)
 */
export const restoreInventoryOnReturn = async (
  pedidoId: number,
  inventoryItemId: string | null,
  quantity: number = 1
): Promise<{ success: boolean; error?: string }> => {
  if (!inventoryItemId) {
    // Order not linked to inventory - skip restoration
    return { success: true };
  }

  try {
    // Get current stock - use 'as any' since types may not be updated yet
    const { data: item, error: fetchError } = await (supabase as any)
      .from("inventory")
      .select("stock_available, product_name")
      .eq("id", inventoryItemId)
      .single();

    if (fetchError) {
      console.error("Error fetching inventory item:", fetchError);
      return { success: false, error: "Error al buscar producto en inventario" };
    }

    if (!item) {
      return { success: false, error: "Producto no encontrado en inventario" };
    }

    // Calculate new stock (add back the returned quantity)
    const newStock = item.stock_available + quantity;

    // Update inventory
    const { error: updateError } = await (supabase as any)
      .from("inventory")
      .update({ stock_available: newStock })
      .eq("id", inventoryItemId);

    if (updateError) {
      console.error("Error updating inventory:", updateError);
      return { success: false, error: "Error al actualizar inventario" };
    }

    console.log(
      `✅ Inventory restored: ${item.product_name} (${item.stock_available} → ${newStock})`
    );
    return { success: true };
  } catch (error) {
    console.error("Error in restoreInventoryOnReturn:", error);
    return { success: false, error: "Error inesperado" };
  }
};

/**
 * Check if product has sufficient stock before creating an order
 */
export const checkStockAvailability = async (
  inventoryItemId: string,
  requiredQuantity: number = 1
): Promise<{ available: boolean; currentStock: number; productName: string }> => {
  try {
    const { data: item, error } = await (supabase as any)
      .from("inventory")
      .select("stock_available, product_name")
      .eq("id", inventoryItemId)
      .single();

    if (error || !item) {
      return { available: false, currentStock: 0, productName: "" };
    }

    return {
      available: item.stock_available >= requiredQuantity,
      currentStock: item.stock_available,
      productName: item.product_name,
    };
  } catch (error) {
    console.error("Error checking stock:", error);
    return { available: false, currentStock: 0, productName: "" };
  }
};
