import { motion, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Store,
  Plug,
  Boxes,
  Wallet,
  Book,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────────

// NOTE: mantenemos las claves antiguas (novedades, devoluciones, retiros,
// transferencias) en el tipo para que las redirecciones lógicas en el
// dashboard sigan compilando, aunque ya no se rendericen como ítems
// independientes en el sidebar.
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
  | "transferencias"
  | "catalogo"
  | "docs";

interface ClienteSidebarProps {
  activeView: ClienteView;
  onViewChange: (view: ClienteView) => void;
  novedadesCount: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  tipoCuenta?: string | null;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const HEADER_HEIGHT_PX = 104;
const MAX_BADGE_COUNT = 99;
const formatBadge = (count: number): string =>
  count > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(count);

// ─── Estructura de navegación agrupada ────────────────────────────────────────
// Refactor IA: el sidebar pasa de una lista plana de 13 ítems a 4 secciones
// temáticas con 8-9 ítems en total (Novedades/Devoluciones se consolidan en
// pestañas dentro de "Mis Pedidos"; Retiros/Transferir se consolidan en
// "Billetera"). Esto reduce fatiga visual y mejora la jerarquía.

interface NavItem {
  key: ClienteView;
  label: string;
  icon: typeof LayoutDashboard;
  gradient: string;
  shadow: string;
}

interface NavSection {
  id: string;
  title: string; // Encabezado de sección (mayúscula pequeña, gris sutil)
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    id: "principal",
    title: "Principal",
    items: [
      {
        key: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        gradient: "from-blue-500 to-blue-600",
        shadow: "shadow-blue-500/30",
      },
      {
        key: "pedidos",
        label: "Mis Pedidos",
        icon: Package,
        gradient: "from-primary to-primary/80",
        shadow: "shadow-primary/30",
      },
    ],
  },
  {
    id: "productos",
    title: "Productos",
    items: [
      {
        key: "catalogo",
        label: "Catálogo Suministro",
        icon: ShoppingBag,
        gradient: "from-pink-500 to-rose-600",
        shadow: "shadow-pink-500/30",
      },
      {
        key: "inventario",
        label: "Mi Inventario Propio",
        icon: Boxes,
        gradient: "from-indigo-500 to-indigo-600",
        shadow: "shadow-indigo-500/30",
      },
    ],
  },
  {
    id: "finanzas",
    title: "Finanzas",
    items: [
      {
        key: "billetera",
        label: "Billetera",
        icon: Wallet,
        gradient: "from-teal-500 to-teal-600",
        shadow: "shadow-teal-500/30",
      },
      {
        key: "reportes",
        label: "Reportes",
        icon: FileSpreadsheet,
        gradient: "from-emerald-500 to-emerald-600",
        shadow: "shadow-emerald-500/30",
      },
    ],
  },
  {
    id: "configuracion",
    title: "Configuración",
    items: [
      {
        key: "tienda",
        label: "Mi Tienda",
        icon: Store,
        gradient: "from-purple-500 to-purple-600",
        shadow: "shadow-purple-500/30",
      },
      {
        key: "integraciones",
        label: "Integraciones",
        icon: Plug,
        gradient: "from-cyan-500 to-cyan-600",
        shadow: "shadow-cyan-500/30",
      },
      {
        key: "docs",
        label: "Documentación",
        icon: Book,
        gradient: "from-gray-500 to-gray-600",
        shadow: "shadow-gray-500/30",
      },
    ],
  },
];

// ─── Componente ───────────────────────────────────────────────────────────────

const ClienteSidebar = ({
  activeView,
  onViewChange,
  novedadesCount,
  collapsed,
  onToggleCollapse,
  tipoCuenta,
}: ClienteSidebarProps) => {
  const isProveedor = tipoCuenta === "proveedor";
  const prefersReducedMotion = useReducedMotion();

  // Filtrado por tipo de cuenta:
  // - Proveedores no ven "Catálogo Suministro" (ellos son la fuente).
  const visibleSections: NavSection[] = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (isProveedor && item.key === "catalogo") return false;
      return true;
    }),
  })).filter((section) => section.items.length > 0);

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
      aria-label="Navegación principal"
    >
      <nav className="flex-1 p-2 space-y-4 overflow-y-auto" aria-label="Secciones del panel">
        {visibleSections.map((section) => (
          <div key={section.id} className="space-y-1">
            {/* Encabezado de sección — oculto cuando colapsado */}
            {!collapsed && (
              <p
                className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
                aria-hidden="true"
              >
                {section.title}
              </p>
            )}

            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                activeView === item.key ||
                // "Mis Pedidos" se mantiene activo cuando el usuario está en
                // las pestañas de Novedades/Devoluciones (consolidadas).
                (item.key === "pedidos" &&
                  (activeView === "novedades" || activeView === "devoluciones")) ||
                // "Billetera" se mantiene activo en las sub-vistas de
                // Retiros/Transferencias (consolidadas).
                (item.key === "billetera" &&
                  (activeView === "retiros" || activeView === "transferencias"));

              const showBadge = item.key === "pedidos" && novedadesCount > 0;

              return (
                <motion.button
                  key={item.key}
                  type="button"
                  onClick={() => onViewChange(item.key)}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={
                    showBadge
                      ? `${item.label} — ${novedadesCount} novedad${novedadesCount !== 1 ? "es" : ""}`
                      : item.label
                  }
                  className={cn(
                    "relative w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all overflow-hidden group",
                    isActive ? "text-white" : "text-muted-foreground hover:bg-muted/50",
                  )}
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                >
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

                  <div
                    className={cn(
                      "relative flex items-center justify-center rounded-lg p-1.5 flex-shrink-0 transition-colors",
                      isActive ? "bg-white/20" : "bg-muted",
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>

                  {!collapsed && <span className="relative flex-1 text-left">{item.label}</span>}

                  {showBadge && (
                    <span
                      className={cn(
                        "relative flex h-5 min-w-5 items-center justify-center rounded-full text-xs font-bold px-1",
                        isActive ? "bg-white/20 text-white" : "bg-orange-500 text-white",
                      )}
                      aria-hidden="true"
                    >
                      {formatBadge(novedadesCount)}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={onToggleCollapse}
        className="m-2 flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors"
        aria-label={collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
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
