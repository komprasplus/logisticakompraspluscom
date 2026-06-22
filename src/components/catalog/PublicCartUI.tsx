import { useState } from "react";
import {
  ShoppingCart,
  X,
  Minus,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Package,
  ArrowLeft,
  AlertTriangle,
  Tag,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/tarifas";
import type { CartItem } from "@/hooks/useCart";
import {
  trackInitiateCheckout,
  trackPurchase,
} from "@/components/catalog/TrackingPixels";

type Step = "cart" | "checkout" | "success";

type MetodoPago = "contraentrega" | "transferencia" | "efectivo";

interface PublicCartUIProps {
  slug: string;
  listaSlug?: string | null;
  codigoAcceso?: string | null;
  items: CartItem[];
  total: number;
  count: number;
  updateQty: (productId: string, variantId: string | null, qty: number) => void;
  remove: (productId: string, variantId: string | null) => void;
  clear: () => void;
  colorPrimary: string;
  colorSecondary: string;
  storeName: string;
}

interface SuccessInfo {
  numero_guia: string;
  total: number;
  subtotal: number;
  discount: number;
  items_count: number;
  pedido_id: number;
  coupon_code: string | null;
}

interface CouponApplied {
  code: string;
  tipo: "percent" | "fixed";
  valor: number;
  descuento: number;
}

const PublicCartUI = ({
  slug,
  listaSlug,
  codigoAcceso,
  items,
  total,
  count,
  updateQty,
  remove,
  clear,
  colorPrimary,
  colorSecondary,
  storeName,
}: PublicCartUIProps) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("cart");

  // Form state
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [barrio, setBarrio] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("contraentrega");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);

  // Cupón
  const [couponInput, setCouponInput] = useState("");
  const [couponApplied, setCouponApplied] = useState<CouponApplied | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const discount = couponApplied?.descuento ?? 0;
  const finalTotal = Math.max(0, total - discount);

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setValidatingCoupon(true);
    setCouponError(null);
    try {
      const { data, error } = await (supabase.rpc as any)("validate_coupon", {
        p_slug: slug,
        p_code: code,
        p_subtotal: total,
      });
      if (error) throw error;
      const r = data as { ok: boolean; error?: string; code?: string; tipo?: "percent" | "fixed"; valor?: number; descuento?: number };
      if (!r?.ok) {
        setCouponApplied(null);
        setCouponError(r?.error || "Cupón inválido");
        return;
      }
      setCouponApplied({
        code: r.code!,
        tipo: r.tipo!,
        valor: r.valor!,
        descuento: Number(r.descuento ?? 0),
      });
      setCouponError(null);
      toast.success(`Cupón ${r.code} aplicado · -${formatCOP(Number(r.descuento ?? 0))}`);
    } catch (e: any) {
      setCouponError(e?.message || "Error validando cupón");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setCouponApplied(null);
    setCouponInput("");
    setCouponError(null);
  };

  const openCart = () => {
    setStep(items.length > 0 ? "cart" : "cart");
    setOpen(true);
  };

  const goCheckout = () => {
    if (items.length === 0) return;
    trackInitiateCheckout(finalTotal, count);
    setStep("checkout");
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        p_slug: slug,
        p_lista_slug: listaSlug ?? null,
        p_codigo_acceso: codigoAcceso ?? null,
        p_customer: { nombre: nombre.trim(), telefono: telefono.trim() },
        p_shipping: {
          direccion: direccion.trim(),
          ciudad: ciudad.trim(),
          municipio: ciudad.trim(),
          barrio: barrio.trim(),
          observaciones: observaciones.trim(),
        },
        p_metodo_pago: metodoPago,
        p_items: items.map((it) => ({
          product_id: it.productId,
          variant_id: it.variantId,
          qty: it.qty,
          unit_price: it.unitPrice,
        })),
      };
      if (couponApplied) payload.p_coupon_code = couponApplied.code;
      const { data, error } = await (supabase.rpc as any)(
        "public_create_order_from_cart",
        payload,
      );
      if (error) throw error;
      const result = data as {
        ok: boolean;
        error?: string;
        pedido_id?: number;
        numero_guia?: string;
        subtotal?: number;
        discount?: number;
        total?: number;
        items_count?: number;
        coupon_code?: string | null;
      };
      if (!result?.ok) {
        toast.error(result?.error || "No se pudo crear el pedido");
        setSubmitting(false);
        return;
      }
      const successInfo: SuccessInfo = {
        numero_guia: result.numero_guia!,
        subtotal: Number(result.subtotal ?? total),
        discount: Number(result.discount ?? 0),
        total: Number(result.total ?? finalTotal),
        items_count: Number(result.items_count ?? items.length),
        pedido_id: Number(result.pedido_id ?? 0),
        coupon_code: result.coupon_code ?? null,
      };
      setSuccess(successInfo);
      trackPurchase({
        orderId: successInfo.pedido_id || successInfo.numero_guia,
        total: successInfo.total,
        itemsCount: successInfo.items_count,
        coupon: successInfo.coupon_code,
      });
      setStep("success");
      clear();
      removeCoupon();
    } catch (e: any) {
      toast.error(e?.message || "Error al crear el pedido. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const closeAndReset = () => {
    setOpen(false);
    setTimeout(() => {
      setStep("cart");
      setSuccess(null);
      setNombre("");
      setTelefono("");
      setDireccion("");
      setCiudad("");
      setBarrio("");
      setObservaciones("");
      setMetodoPago("contraentrega");
    }, 250);
  };

  // ── FAB ───────────────────────────────────────────────
  return (
    <>
      {count > 0 && step !== "success" && !open && (
        <button
          type="button"
          onClick={openCart}
          className="fixed bottom-24 right-4 z-40 h-14 rounded-full shadow-lg px-5 flex items-center gap-2 text-white font-bold hover:scale-105 active:scale-95 transition-transform"
          style={{ background: `linear-gradient(135deg, ${colorPrimary}, ${colorSecondary})` }}
          aria-label="Ver carrito"
        >
          <span className="relative">
            <ShoppingCart className="h-5 w-5" />
            <span className="absolute -top-2 -right-2 bg-white text-[10px] font-bold rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center" style={{ color: colorPrimary }}>
              {count}
            </span>
          </span>
          <span className="text-sm tabular-nums">{formatCOP(finalTotal)}</span>
        </button>
      )}

      <Sheet open={open} onOpenChange={(o) => (o ? setOpen(true) : closeAndReset())}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          {/* Header */}
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
            <SheetTitle className="flex items-center gap-2 text-base">
              {step === "checkout" && (
                <button
                  type="button"
                  onClick={() => setStep("cart")}
                  className="p-1 -ml-1 rounded hover:bg-muted"
                  aria-label="Volver al carrito"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              {step === "cart" && <ShoppingCart className="h-5 w-5" style={{ color: colorPrimary }} />}
              {step === "checkout" && "Datos de envío"}
              {step === "success" && (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Pedido confirmado
                </>
              )}
              {step === "cart" && "Tu pedido"}
            </SheetTitle>
            {step === "cart" && (
              <p className="text-xs text-muted-foreground">
                {count > 0 ? `${count} producto${count !== 1 ? "s" : ""} en el carrito` : "Tu carrito está vacío"}
              </p>
            )}
          </SheetHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {step === "cart" && (
              items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-10">
                  <Package className="h-16 w-16 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Aún no has agregado productos.</p>
                  <Button variant="outline" onClick={closeAndReset}>Seguir comprando</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((it) => (
                    <div
                      key={`${it.productId}:${it.variantId ?? ""}`}
                      className="flex gap-3 p-3 rounded-lg border border-border bg-card"
                    >
                      <div className="h-16 w-16 rounded-md bg-muted flex-shrink-0 overflow-hidden">
                        {it.imageUrl ? (
                          <img src={it.imageUrl} alt={it.productName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                            <Package className="h-6 w-6" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{it.productName}</p>
                        {it.variantName && (
                          <p className="text-[11px] text-muted-foreground truncate">{it.variantName}</p>
                        )}
                        <p className="text-[11px] font-mono text-muted-foreground">{it.sku}</p>
                        <p className="text-sm font-bold mt-0.5" style={{ color: colorPrimary }}>
                          {formatCOP(it.unitPrice * it.qty)}
                          {it.qty > 1 && (
                            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                              ({formatCOP(it.unitPrice)} c/u)
                            </span>
                          )}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateQty(it.productId, it.variantId, it.qty - 1)}
                              className="h-7 w-7 rounded-md border border-border hover:bg-muted flex items-center justify-center"
                              aria-label="Disminuir"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-8 text-center text-sm font-semibold tabular-nums">{it.qty}</span>
                            <button
                              type="button"
                              onClick={() => updateQty(it.productId, it.variantId, it.qty + 1)}
                              disabled={it.qty >= it.stockAtAdd}
                              className="h-7 w-7 rounded-md border border-border hover:bg-muted flex items-center justify-center disabled:opacity-40"
                              aria-label="Aumentar"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => remove(it.productId, it.variantId)}
                            className="text-muted-foreground hover:text-destructive p-1"
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {it.qty >= it.stockAtAdd && (
                          <p className="text-[10px] text-amber-600 mt-1">Stock máx: {it.stockAtAdd}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {step === "checkout" && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs">Nombre completo *</Label>
                  <Input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Juan Pérez"
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-xs">Teléfono / WhatsApp *</Label>
                  <Input
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="3001234567"
                    inputMode="tel"
                  />
                </div>
                <div>
                  <Label className="text-xs">Dirección de entrega *</Label>
                  <Input
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Calle 123 #45-67, apto 401"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Ciudad *</Label>
                    <Input
                      value={ciudad}
                      onChange={(e) => setCiudad(e.target.value)}
                      placeholder="Bogotá"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Barrio</Label>
                    <Input
                      value={barrio}
                      onChange={(e) => setBarrio(e.target.value)}
                      placeholder="Chapinero"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Observaciones (opcional)</Label>
                  <Textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Referencias, instrucciones especiales..."
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <div>
                  <Label className="text-xs">Método de pago *</Label>
                  <Select value={metodoPago} onValueChange={(v) => setMetodoPago(v as MetodoPago)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contraentrega">Contraentrega (pago en efectivo al recibir)</SelectItem>
                      <SelectItem value="transferencia">Transferencia (Nequi/Bancolombia)</SelectItem>
                      <SelectItem value="efectivo">Efectivo (pago anticipado)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {metodoPago !== "contraentrega" && (
                  <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      El proveedor te contactará al WhatsApp para coordinar el pago antes del envío.
                    </span>
                  </div>
                )}
              </div>
            )}

            {step === "success" && success && (
              <div className="flex flex-col items-center text-center gap-3 py-6">
                <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-foreground">¡Pedido recibido!</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {storeName} recibió tu pedido y te contactará al WhatsApp.
                </p>
                <div className="bg-muted rounded-lg p-4 w-full max-w-xs space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">N° de guía</span>
                    <span className="font-mono font-bold">{success.numero_guia}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Productos</span>
                    <span className="font-semibold">{success.items_count}</span>
                  </div>
                  {success.discount > 0 && (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="tabular-nums">{formatCOP(success.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-emerald-600">
                        <span>Cupón {success.coupon_code}</span>
                        <span className="tabular-nums">-{formatCOP(success.discount)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-sm pt-2 border-t border-border">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold" style={{ color: colorPrimary }}>{formatCOP(success.total)}</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground max-w-xs">
                  Guarda tu número de guía para consultar el estado del envío.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {step === "cart" && items.length > 0 && (
            <div className="border-t border-border p-4 space-y-3">
              {/* Cupón */}
              {!couponApplied ? (
                <div>
                  <div className="flex gap-2">
                    <Input
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="Código de descuento"
                      className="font-mono uppercase h-9 text-sm"
                      maxLength={32}
                      onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={applyCoupon}
                      disabled={validatingCoupon || !couponInput.trim()}
                      className="h-9 gap-1"
                    >
                      {validatingCoupon ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Tag className="h-3.5 w-3.5" />
                      )}
                      Aplicar
                    </Button>
                  </div>
                  {couponError && (
                    <p className="text-[11px] text-destructive mt-1">{couponError}</p>
                  )}
                </div>
              ) : (
                <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center justify-between">
                  <div className="text-xs flex items-center gap-1.5 text-emerald-700">
                    <Check className="h-3.5 w-3.5" />
                    <span>
                      Cupón <strong className="font-mono">{couponApplied.code}</strong>:{" "}
                      <strong>-{formatCOP(couponApplied.descuento)}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="text-[11px] text-emerald-700/70 hover:text-destructive font-medium"
                  >
                    Quitar
                  </button>
                </div>
              )}

              {/* Totales */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatCOP(total)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Descuento</span>
                    <span className="tabular-nums">-{formatCOP(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-1 border-t border-border">
                  <span className="text-sm font-semibold text-foreground">Total</span>
                  <span className="text-2xl font-bold tabular-nums" style={{ color: colorPrimary }}>
                    {formatCOP(finalTotal)}
                  </span>
                </div>
              </div>

              <Button
                onClick={goCheckout}
                className="w-full h-12 text-base font-bold"
                style={{ backgroundColor: colorPrimary, color: "white" }}
              >
                Continuar al pago →
              </Button>
              <button
                type="button"
                onClick={() => { clear(); removeCoupon(); }}
                className="text-xs text-muted-foreground hover:text-destructive w-full"
              >
                Vaciar carrito
              </button>
            </div>
          )}

          {step === "checkout" && (
            <div className="border-t border-border p-5 space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-muted-foreground">
                  {count} producto{count !== 1 ? "s" : ""}
                  {couponApplied && ` · cupón ${couponApplied.code}`}
                </span>
                <div className="text-right">
                  {discount > 0 && (
                    <p className="text-[11px] text-muted-foreground line-through tabular-nums">
                      {formatCOP(total)}
                    </p>
                  )}
                  <span className="text-xl font-bold tabular-nums" style={{ color: colorPrimary }}>
                    {formatCOP(finalTotal)}
                  </span>
                </div>
              </div>
              <Button
                onClick={submit}
                disabled={submitting}
                className="w-full h-12 text-base font-bold"
                style={{ backgroundColor: colorPrimary, color: "white" }}
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Confirmar pedido"
                )}
              </Button>
            </div>
          )}

          {step === "success" && (
            <div className="border-t border-border p-5">
              <Button onClick={closeAndReset} variant="outline" className="w-full">
                Seguir explorando catálogo
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default PublicCartUI;
