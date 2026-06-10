import { useState } from "react";
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
  Sparkles,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

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
  | "catalogo-publico"
  | "por-empacar"
  | "docs";

interface ClienteSidebarProps {
  activeView: ClienteView;
  onViewChange: (view: ClienteView) => void;
  novedadesCount: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  tipoCuenta?: string | null;
}

const HEADER_HEIGHT_PX = 104;
const MAX_BADGE_COUNT = 99;
const formatBadge = (count: number): string =>
  count > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(count);

interface NavItem {
  key: ClienteView;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
}

interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    id: "principal",
    title: "Principal",
    items: [
      { key: "dashboard", label: "Dashboard", description: "Resumen de tu operación", icon: LayoutDashboard },
      { key: "pedidos", label: "Mis Pedidos", description: "Gestión y novedades", icon: Package },
      { key: "por-empacar", label: "Por Empacar", description: "Pendientes de despacho", icon: Boxes },
    ],
  },
  {
    id: "productos",
    title: "Productos",
    items: [
      { key: "catalogo", label: "Catálogo Mega Bodega", description: "Productos de proveedores", icon: ShoppingBag },
      { key: "inventario", label: "Mi Inventario Propio", description: "Stock que manejas", icon: Boxes },
      { key: "catalogo-publico", label: "Mis Catálogos", description: "Tiendas B2B públicas", icon: Sparkles },
    ],
  },
  {
    id: "finanzas",
    title: "Finanzas",
    items: [
      { key: "billetera", label: "Billetera", description: "Saldo, retiros y transferencias", icon: Wallet },
      { key: "reportes", label: "Reportes", description: "Exportación financiera", icon: FileSpreadsheet },
    ],
  },
  {
    id: "configuracion",
    title: "Configuración",
    items: [
      { key: "tienda", label: "Mi Tienda", description: "Branding y configuración", icon: Store },
      { key: "integraciones", label: "Integraciones", description: "Shopify, Woo, Meli", icon: Plug },
      { key: "docs", label: "Documentación", description: "Guías y API", icon: Book },
    ],
  },
];

const isItemActive = (itemKey: ClienteView, activeView: ClienteView): boolean => {
  if (activeView === itemKey) return true;
  if (itemKey === "pedidos" && (activeView === "novedades" || activeView === "devoluciones")) return true;
  if (itemKey === "billetera" && (activeView === "retiros" || activeView === "transferencias")) return true;
  return false;
};

interface SidebarInnerProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  visibleSections: NavSection[];
  activeView: ClienteView;
  onViewChange: (view: ClienteView) => void;
  novedadesCount: number;
  showCollapseToggle: boolean;
}

const SidebarInner = ({
  collapsed,
  onToggleCollapse,
  visibleSections,
  activeView,
  onViewChange,
  novedadesCount,
  showCollapseToggle,
}: SidebarInnerProps) => (
  <div className="flex flex-col h-full">
    <nav className="flex-1 px-2 py-3 overflow-y-auto" aria-label="Secciones del panel">
      {visibleSections.map((section) => (
        <div key={section.id} className="mb-4 last:mb-0">
          {!collapsed && (
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              {section.title}
            </p>
          )}
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = isItemActive(item.key, activeView);
              const showBadge = item.key === "pedidos" && novedadesCount > 0;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onViewChange(item.key)}
                  aria-current={isActive ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-150 group relative",
                    "border-l-2 border-transparent",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-foreground border-l-gold"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                >
                  <div className="relative flex-shrink-0">
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] transition-colors",
                        isActive ? "text-gold" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground",
                      )}
                      strokeWidth={isActive ? 2.25 : 2}
                      aria-hidden="true"
                    />
                    {showBadge && (
                      <span
                        className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-pink px-1 text-[9px] font-bold text-pink-foreground"
                        aria-hidden="true"
                      >
                        {formatBadge(novedadesCount)}
                      </span>
                    )}
                  </div>
                  {!collapsed && (
                    <div className="flex-1 text-left min-w-0">
                      <p
                        className={cn(
                          "text-[13px] font-medium leading-tight truncate",
                          isActive ? "text-sidebar-foreground" : "text-sidebar-foreground/85",
                        )}
                      >
                        {item.label}
                      </p>
                      <p className="text-[11px] text-sidebar-foreground/45 truncate mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>

    {showCollapseToggle && (
      <button
        type="button"
        onClick={onToggleCollapse}
        className="m-2 flex items-center justify-center rounded-md p-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        aria-label={collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    )}
  </div>
);

const ClienteSidebar = ({
  activeView,
  onViewChange,
  novedadesCount,
  collapsed,
  onToggleCollapse,
  tipoCuenta,
}: ClienteSidebarProps) => {
  const isMobile = useIsMobile();
  const isProveedor = tipoCuenta === "proveedor";
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleSections: NavSection[] = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (isProveedor && item.key === "catalogo") return false;
      if (!isProveedor && item.key === "catalogo-publico") return false;
      if (!isProveedor && item.key === "por-empacar") return false;
      return true;
    }),
  })).filter((section) => section.items.length > 0);

  const handleViewChange = (view: ClienteView) => {
    onViewChange(view);
    if (isMobile) setMobileOpen(false);
  };

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <button
            className="fixed top-3 left-3 z-40 lg:hidden p-2.5 rounded-lg bg-card border border-border shadow-sm text-foreground hover:bg-muted transition-colors"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="p-0 w-[280px] bg-sidebar border-sidebar-border"
        >
          <SidebarInner
            collapsed={false}
            onToggleCollapse={() => {}}
            visibleSections={visibleSections}
            activeView={activeView}
            onViewChange={handleViewChange}
            novedadesCount={novedadesCount}
            showCollapseToggle={false}
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className={cn(
        "fixed left-0 bg-sidebar border-r border-sidebar-border z-30 hidden lg:flex flex-col transition-all duration-200",
        collapsed ? "w-[68px]" : "w-[240px]",
      )}
      style={{
        top: HEADER_HEIGHT_PX,
        height: `calc(100vh - ${HEADER_HEIGHT_PX}px)`,
      }}
      aria-label="Navegación principal"
    >
      <SidebarInner
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        visibleSections={visibleSections}
        activeView={activeView}
        onViewChange={handleViewChange}
        novedadesCount={novedadesCount}
        showCollapseToggle={true}
      />
    </aside>
  );
};

export default ClienteSidebar;
