/**
 * Backward-compatibility helpers for the new account-type system.
 *
 * Legacy users in the database may carry the role "cliente" or the legacy
 * label "tienda" without a `tipo_cuenta` value. The new public registration
 * flow assigns "dropshipper" or "proveedor" via `profiles.tipo_cuenta`,
 * but the underlying role in `user_roles` remains "cliente" for both, so
 * route protection and dashboards keep working unchanged.
 *
 * Use these helpers anywhere you need to:
 *  - Check if a user behaves as a dropshipper (covers cliente/tienda legacy)
 *  - Check if a user is a marketplace provider
 *  - Render a friendly label including a "(Legacy)" hint
 */

export type AccountType = "dropshipper" | "proveedor" | null | undefined;

/**
 * True for new dropshippers AND legacy users (role cliente/tienda without tipo_cuenta).
 * This is the canonical check for "should I show the store / dropshipper experience?".
 */
export const isDropshipperLike = (
  role: string | null | undefined,
  tipoCuenta?: string | null,
): boolean => {
  if (tipoCuenta === "dropshipper") return true;
  // Legacy: role "cliente" or "tienda" with no tipo_cuenta set yet
  if ((role === "cliente" || role === "tienda") && !tipoCuenta) return true;
  return false;
};

/** True only for explicit marketplace providers. */
export const isProveedor = (tipoCuenta?: string | null): boolean =>
  tipoCuenta === "proveedor";

/** True if this user predates the dropshipper/proveedor split. */
export const isLegacyAccount = (
  role: string | null | undefined,
  tipoCuenta?: string | null,
): boolean => (role === "cliente" || role === "tienda") && !tipoCuenta;

/**
 * Visual label for tables and badges. Always returns something safe to render,
 * even for unknown role strings, so admin tables never collapse on bad data.
 */
export const getAccountTypeLabel = (
  role: string | null | undefined,
  tipoCuenta?: string | null,
): string => {
  if (tipoCuenta === "dropshipper") return "Dropshipper";
  if (tipoCuenta === "proveedor") return "Proveedor";
  if (role === "cliente" || role === "tienda") return "Dropshipper (Legacy)";
  if (!role) return "Usuario";
  return role;
};
