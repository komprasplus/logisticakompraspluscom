import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Navigation, Share2, MapPin } from "lucide-react";

interface PedidoQuickActionsProps {
  pedido: {
    id: number;
    client_phone: string | null;
    direccion_entrega: string | null;
    latitud: number | null;
    longitud: number | null;
    cliente_nombre: string | null;
  };
  userLocation?: { lat: number; lng: number } | null;
}

const BODEGA_ADDRESS = "Carrera 20 # 14-30 local 212, Bogotá, Colombia";

// WhatsApp SVG Icon
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// Waze SVG Icon
const WazeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.54 6.63A9.44 9.44 0 0012 2.5a9.44 9.44 0 00-8.54 4.13C1.57 9.19 2.06 12.6 4.5 15c1 1 1.5 2 1.5 3.5v1a1 1 0 001 1h2a1 1 0 001-1v-1c0-1.5.5-2.5 1.5-3.5a6.5 6.5 0 001.5-7 1 1 0 111.8.9 4.5 4.5 0 01-1 4.85c-1.32 1.32-1.8 2.75-1.8 4.75v1a1 1 0 001 1h2a1 1 0 001-1v-1c0-2 .48-3.43 1.8-4.75A7.5 7.5 0 0020.54 6.63z"/>
    <circle cx="9" cy="9" r="1.5"/>
    <circle cx="15" cy="9" r="1.5"/>
  </svg>
);

const PedidoQuickActions = ({ pedido, userLocation }: PedidoQuickActionsProps) => {
  const [showNavSelector, setShowNavSelector] = useState(false);

  const openGoogleMaps = () => {
    const encodedOrigin = encodeURIComponent(BODEGA_ADDRESS);
    let destination: string;

    if (pedido.latitud != null && pedido.longitud != null) {
      destination = `${pedido.latitud},${pedido.longitud}`;
    } else {
      destination = encodeURIComponent((pedido.direccion_entrega || "") + ", Bogotá, Colombia");
    }

    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&destination=${destination}&travelmode=driving`;
    window.open(mapsUrl, "_blank");
    setShowNavSelector(false);
  };

  const openWaze = () => {
    let wazeUrl: string;

    if (pedido.latitud != null && pedido.longitud != null) {
      wazeUrl = `https://waze.com/ul?ll=${pedido.latitud},${pedido.longitud}&navigate=yes`;
    } else {
      const address = encodeURIComponent((pedido.direccion_entrega || "") + ", Bogotá, Colombia");
      wazeUrl = `https://waze.com/ul?q=${address}&navigate=yes`;
    }

    window.open(wazeUrl, "_blank");
    setShowNavSelector(false);
  };

  const openWhatsApp = () => {
    const phoneNumber = pedido.client_phone?.replace(/\D/g, "") || "";
    if (!phoneNumber) return;
    
    const message = encodeURIComponent(
      `Hola, soy el motorizado de Kompras Plus, voy en camino con tu pedido.`
    );
    window.open(`https://wa.me/57${phoneNumber}?text=${message}`, "_blank");
  };

  const callClient = () => {
    const phoneNumber = pedido.client_phone?.replace(/\D/g, "") || "";
    if (!phoneNumber) return;
    window.open(`tel:+57${phoneNumber}`, "_self");
  };

  const shareRoute = () => {
    const phoneNumber = pedido.client_phone?.replace(/\D/g, "") || "";
    if (!phoneNumber) return;

    let message = `🚚 *Kompras Plus - Actualización de tu pedido*\n\n`;
    message += `Hola ${pedido.cliente_nombre || ""}! Tu pedido está *en camino*.\n\n`;
    
    if (userLocation) {
      message += `📍 Mi ubicación actual:\nhttps://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}\n\n`;
    }
    
    message += `¡Estaré llegando pronto! 🏍️`;

    window.open(`https://wa.me/57${phoneNumber}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const hasPhone = !!pedido.client_phone;

  return (
    <>
      {/* Quick Actions Grid - Large touch-friendly buttons */}
      <div className="grid grid-cols-4 gap-2 mt-3">
        {/* WhatsApp Button - Green */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            openWhatsApp();
          }}
          disabled={!hasPhone}
          className="flex flex-col items-center justify-center gap-1 rounded-xl bg-[#25D366] p-3 text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg min-h-[72px]"
          aria-label="Enviar WhatsApp"
        >
          <WhatsAppIcon className="h-7 w-7" />
          <span className="text-[10px] font-bold">WhatsApp</span>
        </button>

        {/* Navigate Button - Blue */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowNavSelector(true);
          }}
          className="flex flex-col items-center justify-center gap-1 rounded-xl bg-[#4285F4] p-3 text-white transition-all active:scale-95 shadow-md hover:shadow-lg min-h-[72px]"
          aria-label="Navegar"
        >
          <Navigation className="h-7 w-7" />
          <span className="text-[10px] font-bold">Navegar</span>
        </button>

        {/* Call Button - Orange */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            callClient();
          }}
          disabled={!hasPhone}
          className="flex flex-col items-center justify-center gap-1 rounded-xl bg-[#FF6B35] p-3 text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg min-h-[72px]"
          aria-label="Llamar cliente"
        >
          <Phone className="h-7 w-7" />
          <span className="text-[10px] font-bold">Llamar</span>
        </button>

        {/* Share Route Button - Purple */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            shareRoute();
          }}
          disabled={!hasPhone}
          className="flex flex-col items-center justify-center gap-1 rounded-xl bg-[#7C3AED] p-3 text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg min-h-[72px]"
          aria-label="Compartir ruta"
        >
          <Share2 className="h-7 w-7" />
          <span className="text-[10px] font-bold leading-tight">Compartir</span>
        </button>
      </div>

      {/* Navigation Selector Modal */}
      <AnimatePresence>
        {showNavSelector && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowNavSelector(false)}
          >
            <motion.div
              className="w-full max-w-sm rounded-3xl bg-card p-6"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">
                  Elegir navegador
                </h3>
              </div>

              <p className="text-sm text-muted-foreground mb-6">
                {pedido.direccion_entrega || "Sin dirección"}
              </p>

              <div className="grid grid-cols-2 gap-4">
                {/* Google Maps */}
                <button
                  onClick={openGoogleMaps}
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#4285F4] p-6 text-white transition-all active:scale-95 shadow-lg hover:shadow-xl"
                >
                  <Navigation className="h-10 w-10" />
                  <span className="font-bold">Google Maps</span>
                </button>

                {/* Waze */}
                <button
                  onClick={openWaze}
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#33CCFF] p-6 text-white transition-all active:scale-95 shadow-lg hover:shadow-xl"
                >
                  <WazeIcon className="h-10 w-10" />
                  <span className="font-bold">Waze</span>
                </button>
              </div>

              <button
                onClick={() => setShowNavSelector(false)}
                className="w-full mt-4 rounded-xl bg-muted py-3 font-medium text-muted-foreground"
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
