import { supabase } from "@/integrations/supabase/client";

/**
 * Generates a WhatsApp notification log when an order status changes to "En Ruta"
 * This is a simulation that creates a log entry for future WhatsApp API integration
 */
export const logWhatsAppNotification = async (
  pedidoId: number,
  clientPhone: string,
  storeName: string,
  numeroGuia: string,
  trackingUrl: string
) => {
  const mensaje = `¡Hola! Tu pedido de ${storeName} va en camino. Síguelo aquí: ${trackingUrl}`;
  
  try {
    const { error } = await supabase.from("notification_logs").insert({
      pedido_id: pedidoId,
      tipo: "whatsapp",
      mensaje: mensaje,
      destinatario: clientPhone,
      estado: "simulado", // Will change to 'enviado' when real API is integrated
    });

    if (error) throw error;
    
    return { success: true, mensaje };
  } catch (err) {
    console.error("Error logging WhatsApp notification:", err);
    return { success: false, mensaje: null };
  }
};

/**
 * Generates the tracking URL for a given order
 */
export const getTrackingUrl = (numeroGuia: string) => {
  // Use the published URL or current domain
  const baseUrl = typeof window !== "undefined" 
    ? window.location.origin 
    : "https://logisticakompraspluscom.lovable.app";
  
  return `${baseUrl}/rastreo/${encodeURIComponent(numeroGuia)}`;
};

/**
 * Handles the notification logic when order status changes to "En Ruta"
 * Returns the notification message for display in UI
 */
export const handleEnRutaNotification = async (
  pedidoId: number,
  clientPhone: string | null,
  storeName: string,
  numeroGuia: string | null
): Promise<{ sent: boolean; message: string }> => {
  if (!clientPhone || !numeroGuia) {
    return {
      sent: false,
      message: "No se pudo enviar notificación: falta teléfono o número de guía",
    };
  }

  const trackingUrl = getTrackingUrl(numeroGuia);
  const result = await logWhatsAppNotification(
    pedidoId,
    clientPhone,
    storeName,
    numeroGuia,
    trackingUrl
  );

  if (result.success) {
    return {
      sent: true,
      message: `Notificación simulada: ¡Hola! Tu pedido de ${storeName} va en camino. Síguelo aquí: ${trackingUrl}`,
    };
  }

  return {
    sent: false,
    message: "Error al registrar notificación",
  };
};

/**
 * Handles delivery attempt increment and automatic return logic
 * Returns updated attempt count and whether the order should be marked as return
 */
export const handleDeliveryAttempt = async (
  pedidoId: number,
  currentAttempts: number = 0,
  valorFlete: number = 12000
): Promise<{ 
  newAttempts: number; 
  shouldMarkAsReturn: boolean;
  message: string;
}> => {
  const newAttempts = currentAttempts + 1;
  const shouldMarkAsReturn = newAttempts >= 3;

  try {
    const updateData: Record<string, unknown> = {
      intentos_entrega: newAttempts,
    };

    // If 3rd failed attempt, mark as return and apply charge
    if (shouldMarkAsReturn) {
      updateData.estado = "devolución";
      updateData.costo_devolucion = valorFlete;
      updateData.devolucion_cobrada = true;
      updateData.fecha_actualizacion = new Date().toISOString();
    }

    const { error } = await supabase
      .from("pedidos")
      .update(updateData)
      .eq("id", pedidoId);

    if (error) throw error;

    if (shouldMarkAsReturn) {
      return {
        newAttempts,
        shouldMarkAsReturn: true,
        message: `Tercer intento fallido. Pedido marcado como Devolución. Se descontará ${formatCOP(valorFlete)} del saldo de la tienda.`,
      };
    }

    return {
      newAttempts,
      shouldMarkAsReturn: false,
      message: `Intento ${newAttempts} de 3 registrado. ${3 - newAttempts} intento(s) restante(s) antes de devolución.`,
    };
  } catch (err) {
    console.error("Error handling delivery attempt:", err);
    return {
      newAttempts: currentAttempts,
      shouldMarkAsReturn: false,
      message: "Error al registrar intento de entrega",
    };
  }
};

// Helper function (inline to avoid circular deps)
const formatCOP = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "$0";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};
