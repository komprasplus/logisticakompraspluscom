import { supabase } from "@/integrations/supabase/client";

/**
 * Returns true if the given user is the Dropium ally (Jamv Drive),
 * detected by either the role 'aliado_logistico' or the full_name match.
 */
export async function isDropiumAlly(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    // Primary: check integration_provider flag on profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, integration_provider")
      .eq("user_id", userId)
      .maybeSingle();

    if ((profile as any)?.integration_provider === "dropium") return true;

    // Fallback by name (legacy)
    const name = (profile?.full_name || "").toLowerCase().trim();
    return name.includes("jamv drive");
  } catch {
    return false;
  }
}

/**
 * Fire-and-forget: pushes a pedido to Dropium via the edge function.
 * Failures are surfaced as toasts inside the caller; here we just attempt.
 */
export async function syncPedidoToDropium(pedidoId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke("dropium-sync", {
      body: { pedido_id: pedidoId },
    });
    if (error) return { success: false, error: error.message };
    if (data?.success) return { success: true };
    return { success: false, error: data?.error || `HTTP ${data?.http_status ?? "?"}` };
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) };
  }
}

/**
 * Convenience: if the assigned user is the Dropium ally, push to Dropium.
 * Non-blocking from the caller's perspective; returns immediately and shows
 * toast feedback via the optional callback.
 */
export async function maybeSyncOnAssignment(
  pedidoId: number,
  assignedUserId: string | null,
  toastFns?: { success?: (m: string) => void; error?: (m: string) => void },
) {
  const isAlly = await isDropiumAlly(assignedUserId);
  if (!isAlly) return;
  toastFns?.success?.("Enviando pedido a Dropium...");
  const res = await syncPedidoToDropium(pedidoId);
  if (res.success) {
    toastFns?.success?.("Pedido sincronizado con Dropium ✓");
  } else {
    toastFns?.error?.(`No se pudo enviar a Dropium: ${res.error ?? "desconocido"}`);
  }
}
