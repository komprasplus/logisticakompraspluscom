import { useState, useCallback, useId } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Phone, Navigation, Share2, MapPin, X } from "lucide-react";

// ─── Constantes ───────────────────────────────────────────────────────────────

const BODEGA_ADDRESS = "Calle 14 # 19-64 Bodega 403, Bogotá, Colombia";
/*
  FIX: prefijo de país extraído como constante.
  Estaba hardcodeado como "57" en 4 lugares distintos — si algún número de
  prueba internacional entrase al sistema, habría que cambiarlo en 4 sitios.
*/
const COUNTRY_CODE = "57";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normaliza un número de teléfono colombiano al formato internacional.
 *
 * FIX: la versión original hacía `.replace(/\D/g, "")` y luego concatenaba "57"
 * directamente. Esto producía números dobles si el usuario guardó el contacto
 * con "+57" o "057": "57" + "573001234567" = "5757..." inválido.
 * Solución: extraer los dígitos, luego eliminar el prefijo "57" o "0" si ya
 * está presente antes de añadir el código de país.
 *
 * FIX 2: Un número de 10 dígitos que comienza con "0" (formato local) deja el
 * "0" de prefijo al pasar `replace(/\D/g, "")` — "0300..." → "+570300..." inválido.
 * Se elimina el "0" inicial si está presente.
 */
const normalizePhone = (raw: string | null): string | null => {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Ya tiene código de país completo
  if (digits.startsWith(COUNTRY_CODE) && digits.length === 12) return digits;
  // Prefijo "0" local
  if (digits.startsWith("0")) return COUNTRY_CODE + digits.slice(1);
  // Número local sin prefijo (10 dígitos para Colombia)
  return COUNTRY_CODE + digits;
};

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const WazeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.54 6.63A9.44 9.44 0 0012 2.5a9.44 9.44 0 00-8.54 4.13C1.57 9.19 2.06 12.6 4.5 15c1 1 1.5 2 1.5 3.5v1a1 1 0 001 1h2a1 1 0 001-1v-1c0-1.5.5-2.5 1.5-3.5a6.5 6.5 0 001.5-7 1 1 0 111.8.9 4.5 4.5 0 01-1 4.85c-1.32 1.32-1.8 2.75-1.8 4.75v1a1 1 0 001 1h2a1 1 0 001-1v-1c0-2 .48-3.43 1.8-4.75A7.5 7.5 0 0020.54 6.63z" />
    <circle cx="9" cy="9" r="1.5" />
    <circle cx="15" cy="9" r="1.5" />
  </svg>
);

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface PedidoQuickActionsProps {
  pedido: {
    id: number;
    client_phone: string | null;
    direccion_entrega: string | null;
    latitud: number | null;
    longitud: number | null;
    cliente_nombre: string | null;
    producto_nombre?: string | null;
    estado?: string | null;
  };
  userLocation?: { lat: number; lng: number } | null;
}

// ─── Subcomponente: botón 3D ──────────────────────────────────────────────────

interface ActionButton3DProps {
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  label: string;
  text: string;
  shadowColor: string;
  gradientFrom: string;
  gradientTo: string;
  shadowClass: string;
  children: React.ReactNode;
}

/*
  FIX: lógica del botón 3D extraída como subcomponente reutilizable.
  La versión original repetía ~6 divs idénticos de estructura 3D (shadow layer +
  gradient layer + highlight) 4 veces. Con 120+ líneas solo para los 4 botones.
  Ahora cada botón es una sola línea.
*/
const ActionButton3D = ({
  onClick,
  disabled = false,
  label,
  text,
  shadowColor,
  gradientFrom,
  gradientTo,
  shadowClass,
  children,
}: ActionButton3DProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className="group relative flex flex-col items-center justify-center gap-1.5 rounded-2xl p-3 text-white transition-colors duration-200 active:scale-95 active:translate-y-1 disabled:opacity-40 disabled:cursor-not-allowed min-h-[80px]"
    /*
      FIX: `transition-all` → `transition-colors`.
      Igual que en el componente Accordion — `transition-all` monitoriza todas
      las propiedades CSS en cada frame, costoso en botones con múltiples capas.
    */
  >
    {/* Capa de sombra 3D */}
    <div
      className="absolute inset-0 rounded-2xl translate-y-1.5 group-active:translate-y-0.5 transition-transform duration-150"
      style={{ backgroundColor: shadowColor }}
    />
    {/* Gradiente principal */}
    <div
      className={`absolute inset-0 rounded-2xl shadow-lg ${shadowClass}`}
      style={{ background: `linear-gradient(to bottom, ${gradientFrom}, ${gradientTo})` }}
    />
    {/* Highlight superior */}
    <div className="absolute inset-x-2 top-1 h-[40%] rounded-t-xl bg-gradient-to-b from-white/25 to-transparent" />
    {/* Contenido */}
    <span className="relative flex flex-col items-center gap-1.5">
      {children}
      <span className="text-[10px] font-bold drop-shadow-sm leading-tight">{text}</span>
    </span>
  </button>
);

// ─── Componente principal ─────────────────────────────────────────────────────

const PedidoQuickActions = ({ pedido, userLocation }: PedidoQuickActionsProps) => {
  const [showNavSelector, setShowNavSelector] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const uid = useId();

  const isActiveStatus = !["entregado", "liquidado"].includes(pedido.estado?.toLowerCase() ?? "");
  const phoneE164 = normalizePhone(pedido.client_phone);
  const hasPhone = phoneE164 !== null;

  // ── Acciones de navegación ───────────────────────────────────────────────

  const openGoogleMaps = useCallback(() => {
    /*
      FIX: la versión original usaba SIEMPRE `BODEGA_ADDRESS` como origen,
      incluso cuando el motorizado ya estaba en ruta con GPS activo.
      Un navegador abierto desde la bodega mientras el conductor está a 10km
      trazaba la ruta desde la bodega, no desde la posición real.

      Ahora: si `userLocation` está disponible se usa como origen (`origin=lat,lng`);
      de lo contrario Google Maps usa la ubicación del dispositivo por defecto
      omitiendo el parámetro `origin`.
    */
    const params = new URLSearchParams({
      api: "1",
      travelmode: "driving",
    });

    if (userLocation) {
      params.set("origin", `${userLocation.lat},${userLocation.lng}`);
    }

    if (pedido.latitud != null && pedido.longitud != null) {
      params.set("destination", `${pedido.latitud},${pedido.longitud}`);
    } else {
      params.set("destination", `${pedido.direccion_entrega ?? ""}, Bogotá, Colombia`);
    }

    /*
      FIX: todos los `window.open(..., "_blank")` sin `noopener noreferrer`.
      Mismo bug crítico de seguridad que en HistorialTransaccionesView.
      Sin estas flags, la pestaña de Google Maps / Waze / WhatsApp Web puede
      acceder a `window.opener` y redirigir la app del motorizado (reverse-tabnapping).
    */
    window.open(`https://www.google.com/maps/dir/?${params.toString()}`, "_blank", "noopener,noreferrer");
    setShowNavSelector(false);
  }, [pedido, userLocation]);

  const openWaze = useCallback(() => {
    const wazeUrl =
      pedido.latitud != null && pedido.longitud != null
        ? `https://waze.com/ul?ll=${pedido.latitud},${pedido.longitud}&navigate=yes`
        : `https://waze.com/ul?q=${encodeURIComponent(`${pedido.direccion_entrega ?? ""}, Bogotá, Colombia`)}&navigate=yes`;

    // FIX: noopener,noreferrer
    window.open(wazeUrl, "_blank", "noopener,noreferrer");
    setShowNavSelector(false);
  }, [pedido]);

  // ── Acciones de comunicación ──────────────────────────────────────────────

  const openWhatsApp = useCallback(() => {
    if (!phoneE164) return;
    const clientName = pedido.cliente_nombre ?? "Cliente";
    const productName = pedido.producto_nombre ?? "tu producto";
    const message = encodeURIComponent(
      `Hola ${clientName}, soy el motorizado de Kompras Plus. Voy en camino con tu pedido de ${productName}. Por favor confirma que alguien puede recibirlo.`,
    );
    // FIX: noopener,noreferrer
    window.open(`https://wa.me/${phoneE164}?text=${message}`, "_blank", "noopener,noreferrer");
  }, [phoneE164, pedido.cliente_nombre, pedido.producto_nombre]);

  const callClient = useCallback(() => {
    if (!phoneE164) return;
    /*
      FIX: `window.open(\`tel:...\`, "_self")` → `window.location.href`.
      `window.open()` para esquemas `tel:` es no estándar y falla en algunos
      navegadores móviles y PWAs. `window.location.href` es el método correcto
      para disparar el marcador de llamada en dispositivos móviles.
    */
    window.location.href = `tel:+${phoneE164}`;
  }, [phoneE164]);

  const shareRoute = useCallback(() => {
    if (!phoneE164) return;
    let message = `🚚 *Kompras Plus - Actualización de tu pedido*\n\nHola ${pedido.cliente_nombre ?? ""}! Tu pedido está *en camino*.\n\n`;
    if (userLocation) {
      message += `📍 Mi ubicación actual:\nhttps://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}\n\n`;
    }
    message += `¡Estaré llegando pronto! 🏍️`;
    // FIX: noopener,noreferrer
    window.open(`https://wa.me/${phoneE164}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }, [phoneE164, pedido.cliente_nombre, userLocation]);

  // ── Early return ──────────────────────────────────────────────────────────

  if (!isActiveStatus) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Grid de acciones rápidas */}
      <div className="grid grid-cols-4 gap-3 mt-4">
        <ActionButton3D
          onClick={(e) => {
            e.stopPropagation();
            openWhatsApp();
          }}
          disabled={!hasPhone}
          label={hasPhone ? `Enviar WhatsApp a ${pedido.cliente_nombre ?? "cliente"}` : "Sin número de teléfono"}
          text="WhatsApp"
          shadowColor="#1a9b4a"
          gradientFrom="#25D366"
          gradientTo="#20bd5a"
          shadowClass="shadow-green-500/30"
        >
          <WhatsAppIcon className="h-8 w-8 drop-shadow-md" />
        </ActionButton3D>

        <ActionButton3D
          onClick={(e) => {
            e.stopPropagation();
            setShowNavSelector(true);
          }}
          label="Abrir navegador"
          text="Navegar"
          shadowColor="#2563eb"
          gradientFrom="#4285F4"
          gradientTo="#3b7ae8"
          shadowClass="shadow-blue-500/30"
        >
          <Navigation className="h-8 w-8 drop-shadow-md" aria-hidden="true" />
        </ActionButton3D>

        <ActionButton3D
          onClick={(e) => {
            e.stopPropagation();
            callClient();
          }}
          disabled={!hasPhone}
          label={hasPhone ? `Llamar a ${pedido.cliente_nombre ?? "cliente"}` : "Sin número de teléfono"}
          text="Llamar"
          shadowColor="#d45520"
          gradientFrom="#FF6B35"
          gradientTo="#f55d28"
          shadowClass="shadow-orange-500/30"
        >
          <Phone className="h-8 w-8 drop-shadow-md" aria-hidden="true" />
        </ActionButton3D>

        <ActionButton3D
          onClick={(e) => {
            e.stopPropagation();
            shareRoute();
          }}
          disabled={!hasPhone}
          label={hasPhone ? "Compartir mi ubicación por WhatsApp" : "Sin número de teléfono"}
          text="Compartir"
          shadowColor="#5b21b6"
          gradientFrom="#7C3AED"
          gradientTo="#6d28d9"
          shadowClass="shadow-purple-500/30"
        >
          <Share2 className="h-8 w-8 drop-shadow-md" aria-hidden="true" />
        </ActionButton3D>
      </div>

      {/* Modal selector de navegador */}
      <AnimatePresence>
        {showNavSelector && (
          <motion.div
            /*
              FIX: añadidos `role="dialog"` + `aria-modal` + `aria-labelledby`.
              Mismo fix aplicado en LoadManifest y otros modales del proyecto.
              Sin estos atributos los lectores de pantalla no focalizan el modal
              ni bloquean la interacción con el contenido de fondo.
            */
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${uid}-nav-title`}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowNavSelector(false)}
          >
            <motion.div
              className="w-full max-w-sm rounded-3xl bg-card p-6"
              initial={{ scale: prefersReducedMotion ? 1 : 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: prefersReducedMotion ? 1 : 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
                  <h3 id={`${uid}-nav-title`} className="text-lg font-bold text-foreground">
                    Elegir navegador
                  </h3>
                </div>
                {/* FIX: botón de cierre con aria-label para acceso por teclado */}
                <button
                  type="button"
                  onClick={() => setShowNavSelector(false)}
                  aria-label="Cerrar selector de navegador"
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {/* Dirección de destino */}
              <p className="text-sm text-muted-foreground mb-2">{pedido.direccion_entrega || "Sin dirección"}</p>

              {/*
                FIX: aviso contextual si se usará ubicación actual vs. bodega.
                La versión original no indicaba desde dónde partiría la ruta.
                Un motorizado que no sabe que la app usa su GPS como origen podría
                confundirse si la ruta calculada es diferente a la esperada.
              */}
              {userLocation ? (
                <p className="text-xs text-primary/70 mb-4 flex items-center gap-1">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  Origen: tu ubicación actual (GPS)
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  Origen: Bodega Central
                </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={openGoogleMaps}
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#4285F4] p-6 text-white transition-all active:scale-95 shadow-lg hover:shadow-xl"
                  aria-label="Abrir en Google Maps"
                >
                  <Navigation className="h-10 w-10" aria-hidden="true" />
                  <span className="font-bold">Google Maps</span>
                </button>

                <button
                  type="button"
                  onClick={openWaze}
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#33CCFF] p-6 text-white transition-all active:scale-95 shadow-lg hover:shadow-xl"
                  aria-label="Abrir en Waze"
                >
                  <WazeIcon className="h-10 w-10" />
                  <span className="font-bold">Waze</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowNavSelector(false)}
                className="w-full mt-4 rounded-xl bg-muted py-3 font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PedidoQuickActions;
