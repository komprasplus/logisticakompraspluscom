import { motion, useReducedMotion } from "framer-motion";
import { LogOut, Phone, Store, Truck } from "lucide-react";
import WeatherWidget from "@/components/WeatherWidget";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "@/contexts/ThemeContext";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ClienteHeaderProps {
  storeName: string | null;
  logoUrl: string | null;
  supportPhone: string;
  onSignOut: () => void;
  isWarehouseOpen: boolean;
  userName?: string | null;
  avatarUrl?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/*
  FIX: `getInitials` movida fuera del componente.
  Estaba declarada dentro de ClienteHeader, recreándose en cada render.
  Al ser una función pura sin dependencias del componente, va a nivel de módulo.

  FIX: manejo robusto de edge cases:
  - Nombres con espacios múltiples / leading-trailing spaces
  - Caracteres no ASCII (nombres con tildes)
  - Cadena vacía o solo espacios → devuelve ""
*/
const getInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

/*
  FIX: sanitización más completa del número de teléfono para href `tel:`.
  `supportPhone.replace(/\s/g, "")` solo quitaba espacios.
  Guiones, paréntesis y puntos son caracteres de presentación que algunos
  formatos incluyen (ej. "300-123-4567", "(601) 234 5678") y deben
  eliminarse del href aunque se muestren en pantalla.
*/
const sanitizePhone = (phone: string): string => phone.replace(/[\s\-().+]/g, "");

// ─── Componente ───────────────────────────────────────────────────────────────

const ClienteHeader = ({
  storeName,
  logoUrl,
  supportPhone,
  onSignOut,
  isWarehouseOpen,
  userName,
  avatarUrl,
}: ClienteHeaderProps) => {
  /*
    FIX: respetar la preferencia de accesibilidad `prefers-reduced-motion`.
    La animación de pulso infinita (`repeat: Infinity`) puede causar malestar
    a usuarios con trastornos vestibulares o sensibilidad al movimiento.
    `useReducedMotion()` de framer-motion lee automáticamente el media query.
  */
  const prefersReducedMotion = useReducedMotion();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-white/20">
      {/* Fila principal */}
      <div className="flex h-16 items-center justify-between px-4 py-3">
        {/* Logo y nombre de tienda */}
        <div className="flex items-center gap-3">
          {/* Logo de la plataforma — branding dinámico del tenant */}
          <PlatformBrand />


          {/* Branding de la tienda — solo desktop */}
          <div className="hidden md:flex items-center gap-3 ml-3 pl-4 border-l border-white/20">
            {logoUrl ? (
              <img
                src={logoUrl}
                /*
                  FIX: alt genérico "Logo tienda" reemplazado con el nombre
                  real para que lectores de pantalla lo anuncien correctamente.
                */
                alt={`Logo de ${storeName ?? "la tienda"}`}
                className="h-10 w-10 rounded-xl object-cover border-2 border-white/30 shadow-md"
              />
            ) : (
              <div className="h-10 w-10 rounded-xl neu-flat flex items-center justify-center">
                <Store className="h-5 w-5 text-primary" />
              </div>
            )}
            <span className="text-sm font-bold text-foreground truncate max-w-[150px]">{storeName ?? "Mi Tienda"}</span>
          </div>
        </div>

        {/* Acciones lado derecho */}
        <div className="flex items-center gap-3">
          {/* Estado de bodega */}
          <motion.div
            className={`hidden lg:flex items-center gap-2 px-4 py-2 rounded-2xl neu-flat text-xs font-bold ${
              isWarehouseOpen ? "text-emerald-600" : "text-red-500"
            }`}
            /*
              FIX: cuando `prefersReducedMotion` es true no aplicar ninguna
              animación. El estado sigue siendo visible, solo sin el pulso.
            */
            animate={prefersReducedMotion ? undefined : { opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 2, repeat: Infinity }}
            aria-label={`Bodega ${isWarehouseOpen ? "abierta" : "cerrada"}`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${isWarehouseOpen ? "bg-emerald-500" : "bg-red-500"}`} />
            Bodega {isWarehouseOpen ? "Abierta" : "Cerrada"}
          </motion.div>

          {/* Teléfono de soporte */}
          <a
            href={`tel:${sanitizePhone(supportPhone)}`}
            className="hidden sm:flex items-center gap-2 rounded-2xl neu-flat px-4 py-2 text-sm font-bold text-primary hover:shadow-elevated transition-all"
            /*
              FIX: aria-label descriptivo en el enlace de teléfono.
              Sin esto, el lector de pantalla solo anunciaría el número
              sin contexto de que es un enlace para llamar a soporte.
            */
            aria-label={`Llamar a soporte: ${supportPhone}`}
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            {supportPhone}
          </a>

          {/* Perfil de usuario */}
          <div className="flex items-center gap-2">
            <Avatar className="h-9 w-9 border-2 border-primary/20 shadow-sm">
              <AvatarImage src={avatarUrl ?? undefined} alt={userName ?? "Avatar"} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                {/*
                  FIX: getInitials ahora es estable (fuera del componente)
                  y maneja edge cases de nombre vacío.
                */}
                {userName ? getInitials(userName) : "?"}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-bold text-foreground hidden sm:inline truncate max-w-[120px]">
              {userName ?? "Usuario"}
            </span>
          </div>

          {/* Cerrar sesión */}
          <button
            /*
              FIX: `type="button"` explícito.
              Sin él, el browser puede asumir `type="submit"` si el header
              estuviera dentro de un form (ej. en un layout wrapper),
              disparando un submit inesperado.
            */
            type="button"
            onClick={onSignOut}
            className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors border border-red-200 dark:border-red-800"
            /*
              FIX: el texto "Salir" se oculta en móvil con `hidden sm:inline`.
              Sin aria-label, en pantallas pequeñas el botón es solo un ícono
              sin nombre accesible — los lectores de pantalla lo anuncian como
              "botón" sin ningún contexto. Añadido aria-label siempre visible.
            */
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>

      {/* Fila secundaria — título y clima */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 bg-white/5">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-bold text-foreground">Panel de Control</h1>
          <span className="text-muted-foreground" aria-hidden="true">
            —
          </span>
          <span className="text-sm font-bold text-gradient-brand truncate max-w-[200px]">
            {storeName ?? "Mi Tienda"}
          </span>
        </div>
        <div className="hidden sm:block">
          <WeatherWidget compact />
        </div>
      </div>
    </header>
  );
};

export default ClienteHeader;
