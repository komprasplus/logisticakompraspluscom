import { useState, useRef, useCallback, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  MoreVertical,
  Share2,
  PackageCheck,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  DollarSign,
} from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NOVEDAD_OPTIONS, type NovedadType } from "@/lib/orderStatuses";
import { cn } from "@/lib/utils";
import SignatureCanvas from "@/components/SignatureCanvas";
import { Eraser } from "lucide-react";

const COUNTRY_CODE = "57";
const BODEGA_ADDRESS = "Calle 14 # 19-64 Bodega 403, Bogotá, Colombia";

const normalizePhone = (raw?: string | null): string | null => {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith(COUNTRY_CODE) && digits.length === 12) return digits;
  if (digits.startsWith("0")) return COUNTRY_CODE + digits.slice(1);
  return COUNTRY_CODE + digits;
};

export interface MotorizadoOrderCardPedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  estado: string | null;
  client_phone: string | null;
  latitud: number | null;
  longitud: number | null;
  valor_recaudar?: number | null;
  metodo_pago?: string | null;
  canal?: string | null;
}

interface Props {
  pedido: MotorizadoOrderCardPedido;
  userLocation: { lat: number; lng: number } | null;
  distanceText?: string | null;
  borderColor?: string;
  onSelect?: () => void;
  onDeliver: (
    pedido: MotorizadoOrderCardPedido,
    photoBase64: string,
    signatureBase64: string,
  ) => Promise<void> | void;
  onNovedad: (
    pedido: MotorizadoOrderCardPedido,
    novedadType: NovedadType,
    note: string,
    photoBase64: string,
  ) => Promise<void> | void;
}

const MotorizadoOrderCard = ({
  pedido,
  userLocation,
  distanceText,
  borderColor,
  onSelect,
  onDeliver,
  onNovedad,
}: Props) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [activeTab, setActiveTab] = useState<"entregar" | "novedad">("entregar");
  const [photo, setPhoto] = useState<string | null>(null);
  const [novedadType, setNovedadType] = useState<NovedadType | "">("");
  const [novedadNote, setNovedadNote] = useState("");
  const [novedadPhoto, setNovedadPhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [showSigPad, setShowSigPad] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const novedadPhotoInputRef = useRef<HTMLInputElement>(null);
  const uid = useId();

  const phoneE164 = normalizePhone(pedido.client_phone);
  const hasPhone = phoneE164 !== null;
  const isCOD =
    pedido.metodo_pago?.toLowerCase() === "efectivo" &&
    !!pedido.valor_recaudar &&
    Number(pedido.valor_recaudar) > 0;
  const isPaid =
    !!pedido.metodo_pago &&
    !["efectivo", "contraentrega", "cod"].includes(
      pedido.metodo_pago.toLowerCase(),
    );

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const openWhatsApp = useCallback(
    (e: React.MouseEvent) => {
      stop(e);
      if (!phoneE164) return;
      const msg = encodeURIComponent(
        `Hola ${pedido.cliente_nombre ?? "Cliente"}, soy el motorizado de Kompras Plus. Voy en camino con tu pedido.`,
      );
      window.open(
        `https://wa.me/${phoneE164}?text=${msg}`,
        "_blank",
        "noopener,noreferrer",
      );
    },
    [phoneE164, pedido.cliente_nombre],
  );

  const openNavigate = useCallback(
    (e: React.MouseEvent) => {
      stop(e);
      const params = new URLSearchParams({ api: "1", travelmode: "driving" });
      if (userLocation) {
        params.set("origin", `${userLocation.lat},${userLocation.lng}`);
      }
      if (pedido.latitud != null && pedido.longitud != null) {
        params.set("destination", `${pedido.latitud},${pedido.longitud}`);
      } else {
        params.set(
          "destination",
          `${pedido.direccion_entrega ?? ""}, Bogotá, Colombia`,
        );
      }
      window.open(
        `https://www.google.com/maps/dir/?${params.toString()}`,
        "_blank",
        "noopener,noreferrer",
      );
    },
    [pedido, userLocation],
  );

  const callClient = useCallback(
    (e: React.MouseEvent) => {
      stop(e);
      if (!phoneE164) return;
      window.location.href = `tel:+${phoneE164}`;
    },
    [phoneE164],
  );

  const shareRoute = useCallback(
    (e: React.MouseEvent) => {
      stop(e);
      setShowMenu(false);
      if (!phoneE164) return;
      let message = `🚚 *Kompras Plus*\n\nHola ${pedido.cliente_nombre ?? ""}! Tu pedido está *en camino*.\n\n`;
      if (userLocation) {
        message += `📍 Mi ubicación:\nhttps://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}\n\n`;
      }
      message += `¡Estaré llegando pronto! 🏍️`;
      window.open(
        `https://wa.me/${phoneE164}?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer",
      );
    },
    [phoneE164, pedido.cliente_nombre, userLocation],
  );

  const handlePhotoChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string | null) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { compressImage } = await import("@/lib/imageCompression");
      const result = await compressImage(file);
      setter(result.base64);
    } catch {
      const reader = new FileReader();
      reader.onloadend = () => setter(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!photo || !signature) return;
    setSubmitting(true);
    try {
      await onDeliver(pedido, photo, signature);
      setShowDrawer(false);
      setPhoto(null);
      setSignature(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmNovedad = async () => {
    if (!novedadType) return;
    if (!novedadPhoto) return;
    if (!novedadNote.trim()) return;
    setSubmitting(true);
    try {
      await onNovedad(pedido, novedadType as NovedadType, novedadNote.trim(), novedadPhoto);
      setShowDrawer(false);
      setNovedadType("");
      setNovedadNote("");
      setNovedadPhoto(null);
    } finally {
      setSubmitting(false);
    }
  };

  const isDelivered = pedido.estado?.toLowerCase() === "entregado";
  const isNovedad = pedido.estado?.toLowerCase().includes("novedad");
  const canManage = !isDelivered && !isNovedad;

  return (
    <>
      <motion.div
        layout
        className="rounded-2xl bg-card p-3.5 shadow-card border-l-4 relative"
        style={{ borderLeftColor: borderColor || "hsl(var(--primary))" }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Top row: identifiers + COD badge */}
        <div className="flex items-start justify-between gap-2">
          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={onSelect}
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm text-foreground truncate">
                {pedido.numero_guia || `#${pedido.id}`}
              </span>
              {distanceText && (
                <span className="rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-[10px] font-semibold">
                  📍 {distanceText}
                </span>
              )}
              {pedido.canal === "FLEX" && (
                <span className="rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[10px] font-bold">
                  ⚡ FLEX
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground truncate">
              {pedido.cliente_nombre || "Cliente sin nombre"}
            </p>
            <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span className="line-clamp-2">
                {pedido.direccion_entrega || "Sin dirección"}
              </span>
            </div>
          </div>

          {/* COD / Paid Badge */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {isCOD ? (
              <Badge className="bg-amber-500 hover:bg-amber-500 text-white border-0 text-[11px] font-bold shadow-sm">
                <DollarSign className="h-3 w-3 mr-0.5" />
                Recaudar ${Number(pedido.valor_recaudar).toLocaleString("es-CO")}
              </Badge>
            ) : isPaid ? (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 hover:bg-emerald-100 border-0 text-[11px] font-medium">
                <CheckCircle2 className="h-3 w-3 mr-0.5" />
                Pagado
              </Badge>
            ) : null}
          </div>
        </div>

        {/* Action bar: ghost-style circular buttons */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={openWhatsApp}
              disabled={!hasPhone}
              aria-label="WhatsApp"
              className="h-9 w-9 rounded-full bg-muted/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-colors disabled:opacity-40"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={openNavigate}
              aria-label="Navegar"
              className="h-9 w-9 rounded-full bg-muted/60 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-colors"
            >
              <Navigation className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={callClient}
              disabled={!hasPhone}
              aria-label="Llamar"
              className="h-9 w-9 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors disabled:opacity-40"
            >
              <Phone className="h-4 w-4" />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  setShowMenu((v) => !v);
                }}
                aria-label="Más opciones"
                aria-expanded={showMenu}
                className="h-9 w-9 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              <AnimatePresence>
                {showMenu && (
                  <>
                    <button
                      className="fixed inset-0 z-40"
                      aria-hidden="true"
                      onClick={(e) => {
                        stop(e);
                        setShowMenu(false);
                      }}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.95 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-10 z-50 min-w-[180px] rounded-xl border border-border bg-popover shadow-elevated p-1"
                      onClick={stop}
                    >
                      <button
                        type="button"
                        onClick={shareRoute}
                        disabled={!hasPhone}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Share2 className="h-4 w-4" />
                        Compartir ubicación
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {isDelivered && (
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Entregado
            </span>
          )}
          {isNovedad && (
            <span className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Novedad
            </span>
          )}
        </div>

        {/* Manage Delivery Button (slim full-width) */}
        {canManage && (
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              setActiveTab("entregar");
              setShowDrawer(true);
            }}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary py-2 text-sm font-semibold transition-colors border border-primary/20"
          >
            <PackageCheck className="h-4 w-4" />
            Gestionar Entrega
          </button>
        )}
      </motion.div>

      {/* Bottom Sheet Drawer for P.O.D */}
      <Drawer open={showDrawer} onOpenChange={setShowDrawer}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center justify-between">
              <span>
                {pedido.numero_guia || `Pedido #${pedido.id}`}
              </span>
              <button
                type="button"
                onClick={() => setShowDrawer(false)}
                aria-label="Cerrar"
                className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </DrawerTitle>
            <p className="text-sm text-muted-foreground">
              {pedido.cliente_nombre} · {pedido.direccion_entrega}
            </p>
          </DrawerHeader>

          <div className="px-4 pb-6 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="entregar" className="gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Entregar
                </TabsTrigger>
                <TabsTrigger value="novedad" className="gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  Reportar Novedad
                </TabsTrigger>
              </TabsList>

              {/* Entregar Tab */}
              <TabsContent value="entregar" className="mt-4 space-y-3">
                {isCOD && (
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                        Recaudar al cliente
                      </p>
                      <p className="text-base font-bold text-amber-700 dark:text-amber-400">
                        ${Number(pedido.valor_recaudar).toLocaleString("es-CO")}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label
                    htmlFor={`${uid}-photo`}
                    className="text-sm font-medium text-foreground mb-2 block"
                  >
                    📷 Foto de evidencia (obligatoria)
                  </label>
                  <input
                    id={`${uid}-photo`}
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handlePhotoChange(e, setPhoto)}
                    className="hidden"
                  />
                  {photo ? (
                    <div className="relative">
                      <img
                        src={photo}
                        alt="Evidencia"
                        className="w-full h-44 object-cover rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="absolute bottom-2 right-2 bg-background/90 px-3 py-1 rounded-lg text-xs font-medium border border-border"
                      >
                        Volver a tomar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-10 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      <Camera className="h-10 w-10" />
                      <span className="font-medium text-sm">Tomar foto</span>
                    </button>
                  )}
                </div>

                {/* Signature Pad - Required */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    ✍️ Firma del cliente (obligatoria)
                  </label>
                  {signature ? (
                    <div className="relative rounded-xl border border-border bg-white p-2">
                      <img
                        src={signature}
                        alt="Firma"
                        className="w-full h-28 object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSignature(null);
                          setShowSigPad(true);
                        }}
                        className="absolute bottom-2 right-2 bg-background/90 px-3 py-1 rounded-lg text-xs font-medium border border-border flex items-center gap-1"
                      >
                        <Eraser className="h-3 w-3" /> Volver a firmar
                      </button>
                    </div>
                  ) : showSigPad ? (
                    <div className="rounded-xl border border-border bg-card p-2">
                      <SignatureCanvas
                        onSave={(sig) => {
                          setSignature(sig);
                          setShowSigPad(false);
                        }}
                        onCancel={() => setShowSigPad(false)}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowSigPad(true)}
                      className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-8 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      <Eraser className="h-8 w-8" />
                      <span className="font-medium text-sm">Capturar firma</span>
                    </button>
                  )}
                </div>

                <Button
                  type="button"
                  onClick={handleConfirmDelivery}
                  disabled={!photo || !signature || submitting}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Subiendo evidencias...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      Confirmar Entrega
                    </>
                  )}
                </Button>
              </TabsContent>

              {/* Novedad Tab */}
              <TabsContent value="novedad" className="mt-4 space-y-3">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Razón de la novedad
                  </label>
                  <Select
                    value={novedadType}
                    onValueChange={(v) => setNovedadType(v as NovedadType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una razón" />
                    </SelectTrigger>
                    <SelectContent>
                      {NOVEDAD_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                          {opt.requiresPhoto ? " 📷" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label
                    htmlFor={`${uid}-note`}
                    className="text-sm font-medium text-foreground mb-2 block"
                  >
                    Nota adicional (opcional)
                  </label>
                  <Textarea
                    id={`${uid}-note`}
                    placeholder="Detalles que ayuden a la tienda a resolver..."
                    value={novedadNote}
                    onChange={(e) => setNovedadNote(e.target.value)}
                    rows={3}
                  />
                </div>

                {novedadType &&
                  NOVEDADES_REQUIRE_PHOTO.includes(novedadType as NovedadType) && (
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        📷 Foto de evidencia (obligatoria)
                      </label>
                      <input
                        ref={novedadPhotoInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) =>
                          handlePhotoChange(e, setNovedadPhoto)
                        }
                        className="hidden"
                      />
                      {novedadPhoto ? (
                        <div className="relative">
                          <img
                            src={novedadPhoto}
                            alt="Evidencia"
                            className="w-full h-36 object-cover rounded-xl"
                          />
                          <button
                            type="button"
                            onClick={() => novedadPhotoInputRef.current?.click()}
                            className="absolute bottom-2 right-2 bg-background/90 px-3 py-1 rounded-lg text-xs font-medium border border-border"
                          >
                            Cambiar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => novedadPhotoInputRef.current?.click()}
                          className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-orange-400 py-8 text-orange-600"
                        >
                          <Camera className="h-8 w-8" />
                          <span className="font-medium text-sm">
                            Tomar foto de evidencia
                          </span>
                        </button>
                      )}
                    </div>
                  )}

                <Button
                  type="button"
                  onClick={handleConfirmNovedad}
                  disabled={
                    !novedadType ||
                    submitting ||
                    (NOVEDADES_REQUIRE_PHOTO.includes(novedadType as NovedadType) &&
                      !novedadPhoto)
                  }
                  className={cn(
                    "w-full text-white",
                    "bg-orange-500 hover:bg-orange-600",
                  )}
                  size="lg"
                >
                  {submitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5" />
                      Marcar Novedad
                    </>
                  )}
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default MotorizadoOrderCard;
