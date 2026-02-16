import { motion, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  AlertTriangle,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Store,
  RotateCcw,
  Plug,
  Boxes,
  Wallet,
  Book,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ClienteView =
  | "dashboard"
  | "pedidos"
  | "novedades"
  | "devoluciones"
  | "reportes"
  | "tienda"
  | "integraciones"
  | "inventario"
  | "billetera"
  | "retiros"
  | "docs";

interface ClienteSidebarProps {
  activeView: ClienteView;
  onViewChange: (view: ClienteView) => void;
  novedadesCount: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/*
  FIX: el magic number `104px` (altura del header) aparecía dos veces en el
  componente — en `top-[104px]` y en `h-[calc(100vh-104px)]`.
  Si la altura del header cambia (ej. al añadir un aviso de sistema),
  hay que actualizarlo en dos lugares. Centralizado como constante.

  Nota: idealmente esto iría en el design token del proyecto como una
  CSS custom property `--header-height: 104px` compartida con el header.
*/
const HEADER_HEIGHT_PX = 104;

/*
  FIX: badge cap a 99+.
  Un `novedadesCount` de 150 se mostraba como "150" en una insignia
  diseñada para 1-2 dígitos, desbordando visualmente.
*/
const MAX_BADGE_COUNT = 99;
const formatBadge = (count: number): string => (count > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(count));

const navItems = [
  {
    key: "dashboard" as ClienteView,
    label: "Dashboard",
    icon: LayoutDashboard,
    gradient: "from-blue-500 to-blue-600",
    shadow: "shadow-blue-500/30",
  },
  {
    key: "pedidos" as ClienteView,
    label: "Mis Pedidos",
    icon: Package,
    gradient: "from-primary to-primary/80",
    shadow: "shadow-primary/30",
  },
  {
    key: "novedades" as ClienteView,
    label: "Novedades",
    icon: AlertTriangle,
    gradient: "from-orange-500 to-orange-600",
    shadow: "shadow-orange-500/30",
  },
  {
    key: "devoluciones" as ClienteView,
    label: "Devoluciones",
    icon: RotateCcw,
    gradient: "from-red-500 to-red-600",
    shadow: "shadow-red-500/30",
  },
  {
    key: "reportes" as ClienteView,
    label: "Reportes",
    icon: FileSpreadsheet,
    gradient: "from-emerald-500 to-emerald-600",
    shadow: "shadow-emerald-500/30",
  },
  {
    key: "tienda" as ClienteView,
    label: "Mi Tienda",
    icon: Store,
    gradient: "from-purple-500 to-purple-600",
    shadow: "shadow-purple-500/30",
  },
  {
    key: "inventario" as ClienteView,
    label: "Inventario",
    icon: Boxes,
    gradient: "from-indigo-500 to-indigo-600",
    shadow: "shadow-indigo-500/30",
  },
  {
    key: "billetera" as ClienteView,
    label: "Billetera",
    icon: Wallet,
    gradient: "from-teal-500 to-teal-600",
    shadow: "shadow-teal-500/30",
  },
  {
    key: "retiros" as ClienteView,
    label: "Retiros",
    icon: ArrowUpRight,
    gradient: "from-emerald-500 to-teal-600",
    shadow: "shadow-emerald-500/30",
  },
  {
    key: "integraciones" as ClienteView,
    label: "Integraciones",
    icon: Plug,
    gradient: "from-cyan-500 to-cyan-600",
    shadow: "shadow-cyan-500/30",
  },
  {
    key: "docs" as ClienteView,
    label: "Documentación",
    icon: Book,
    gradient: "from-gray-500 to-gray-600",
    shadow: "shadow-gray-500/30",
  },
] as const;

// ─── Componente ───────────────────────────────────────────────────────────────

const ClienteSidebar = ({
  activeView,
  onViewChange,
  novedadesCount,
  collapsed,
  onToggleCollapse,
}: ClienteSidebarProps) => {
  /*
    FIX: respetar `prefers-reduced-motion`.
    Los efectos `whileHover: scale(1.02)` y `whileTap: scale(0.98)` se
    aplican en cada ítem del menú. Usuarios con sensibilidad al movimiento
    deben poder navegar sin animaciones de escala continuas.
  */
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.aside
      className={cn(
        "fixed left-0 bg-white border-r border-border z-30 flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-56",
      )}
      style={{
        top: HEADER_HEIGHT_PX,
        height: `calc(100vh - ${HEADER_HEIGHT_PX}px)`,
      }}
      initial={{ x: -100 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.3 }}
      /*
        FIX: `role="complementary"` ya está implícito en `<aside>`,
        pero añadimos `aria-label` para distinguir este sidebar de otros
        posibles elementos de navegación en la página.
      */
      aria-label="Navegación principal"
    >
      {/* Ítems de navegación */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto" aria-label="Secciones del panel">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.key;
          const showBadge = item.key === "novedades" && novedadesCount > 0;

          return (
            <motion.button
              key={item.key}
              /*
                FIX: `type="button"` explícito para evitar submit accidental
                si el sidebar estuviera dentro de un form en algún wrapper.
              */
              type="button"
              onClick={() => onViewChange(item.key)}
              /*
                FIX: `aria-current="page"` en el ítem activo.
                Sin esto, los lectores de pantalla no tienen forma de saber
                cuál es la sección actualmente seleccionada — solo escuchan
                el nombre del botón. `aria-current="page"` es el estándar
                para landmarks de navegación activos.
              */
              aria-current={isActive ? "page" : undefined}
              /*
                FIX: `aria-label` enriquecido para ítems con badge.
                Cuando hay novedades pendientes, el lector de pantalla debe
                anunciar el conteo, no solo "Novedades".
              */
              aria-label={
                showBadge ? `${item.label} — ${novedadesCount} pendiente${novedadesCount !== 1 ? "s" : ""}` : item.label
              }
              className={cn(
                "relative w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all overflow-hidden group",
                isActive ? "text-white" : "text-muted-foreground hover:bg-muted/50",
              )}
              /*
                FIX: deshabilitar animaciones de escala cuando el usuario
                prefiere movimiento reducido.
              */
              whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            >
              {/* Fondo degradado del ítem activo */}
              {isActive && (
                <>
                  <motion.div
                    className={cn("absolute inset-0 bg-gradient-to-br rounded-xl", item.gradient)}
                    layoutId="activeNav"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-xl" />
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20 rounded-b-xl" />
                </>
              )}

              {/* Ícono */}
              <div
                className={cn(
                  "relative flex items-center justify-center rounded-lg p-1.5 flex-shrink-0 transition-colors",
                  isActive ? "bg-white/20" : "bg-muted",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>

              {/* Label — oculto cuando está colapsado */}
              {!collapsed && <span className="relative flex-1 text-left">{item.label}</span>}

              {/* Badge de novedades */}
              {showBadge && (
                <span
                  className={cn(
                    "relative flex h-5 min-w-5 items-center justify-center rounded-full text-xs font-bold px-1",
                    isActive ? "bg-white/20 text-white" : "bg-orange-500 text-white",
                  )}
                  /*
                    FIX: `aria-hidden` en el badge visual porque el conteo
                    ya está incluido en el `aria-label` del botón padre.
                    Sin esto el lector lo anunciaría dos veces.
                  */
                  aria-hidden="true"
                >
                  {/* FIX: capped a 99+ */}
                  {formatBadge(novedadesCount)}
                </span>
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Botón colapsar/expandir */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="m-2 flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors"
        /*
          FIX: `aria-label` dinámico que describe la acción futura
          (lo que va a pasar al hacer clic), no el estado actual.
          Convenio estándar en toggles de sidebar.
        */
        aria-label={collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
        /*
          FIX: `aria-expanded` indica el estado actual del sidebar
          al árbol de accesibilidad, complementando el aria-label.
        */
        aria-expanded={!collapsed}
      >
        {collapsed ? (
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        ) : (
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
    </motion.aside>
  );
};

export default ClienteSidebar;
