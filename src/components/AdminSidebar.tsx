import { useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  MapPin,
  Package,
  Warehouse,
  Settings,
  ChevronLeft,
  ChevronRight,
  LucideIcon,
  Truck,
  LayoutDashboard,
  FileText,
  Activity,
  Wallet,
  ScanLine,
  ClipboardList,
  UserPlus,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  novedadesCount?: number;
  userRole?: string | null;
}

const ALIADO_ALLOWED_SECTIONS = ["despachos", "mapa", "manifiesto-scanner", "manifiestos"];

const LEGACY_TO_NEW: Record<string, string> = {
  despacho: "despachos",
  novedades: "despachos",
  liquidaciones: "tesoreria",
  finanzas: "tesoreria",
  "admin-wallet": "tesoreria",
  "liquidacion-aliados": "tesoreria",
  "webhook-monitor": "monitoreo",
  flex: "monitoreo",
  auditoria: "monitoreo",
  integraciones: "configuracion",
  "super-admin": "configuracion",
};

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  badge?: boolean;
  aliadoOnly?: boolean;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const MENU_GROUPS: MenuGroup[] = [
  {
    label: "Operaciones",
    items: [
      { id: "control-tower", label: "Control Tower", icon: LayoutDashboard, description: "Analíticas en tiempo real" },
      { id: "mapa", label: "Mapa Real-time", icon: MapPin, description: "Vista en vivo de entregas" },
      { id: "despachos", label: "Centro de Despachos", icon: Package, description: "Pedidos, ruta y novedades", badge: true },
      { id: "inventario", label: "Inventario Bodega", icon: Warehouse, description: "Control de stock" },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { id: "tesoreria", label: "Tesorería", icon: Wallet, description: "Liquidación, pagos y rentabilidad" },
    ],
  },
  {
    label: "Análisis y Sistema",
    items: [
      { id: "informes", label: "Informes", icon: FileText, description: "Reportes y exportación" },
      { id: "monitoreo", label: "Monitoreo Técnico", icon: Activity, description: "Webhooks, Flex y auditoría" },
    ],
  },
  {
    label: "Ajustes",
    items: [
      { id: "solicitudes-registro", label: "Solicitudes de Registro", icon: UserPlus, description: "Aprueba nuevos usuarios" },
      { id: "configuracion", label: "Configuración General", icon: Settings, description: "Usuarios, API y sistema" },
    ],
  },
  {
    label: "Aliado Logístico",
    items: [
      { id: "manifiesto-scanner", label: "Escanear Manifiesto", icon: ScanLine, description: "Recibe pedidos asignados", aliadoOnly: true },
      { id: "manifiestos", label: "Mis Manifiestos", icon: ClipboardList, description: "Historial de recepciones", aliadoOnly: true },
    ],
  },
];

interface SidebarContentProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  groups: MenuGroup[];
  currentParent: string;
  onSectionChange: (section: string) => void;
  novedadesCount: number;
  branding: { logo_url?: string | null; nombre: string };
  showCollapseToggle: boolean;
}

const SidebarInner = ({
  collapsed,
  setCollapsed,
  groups,
  currentParent,
  onSectionChange,
  novedadesCount,
  branding,
  showCollapseToggle,
}: SidebarContentProps) => (
  <div className="flex flex-col h-full">
    <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
      {!collapsed && (
        <div className="flex items-center gap-2.5 min-w-0">
          {branding.logo_url ? (
            <img
              src={branding.logo_url}
              alt={branding.nombre}
              className="h-9 w-9 rounded-lg object-contain"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-gold flex items-center justify-center flex-shrink-0">
              <Truck className="h-5 w-5 text-gold-foreground" />
            </div>
          )}
          <span className="font-bold text-base tracking-tight truncate text-sidebar-foreground">
            {branding.nombre}
          </span>
        </div>
      )}
      {showCollapseToggle && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      )}
    </div>

    <nav className="flex-1 px-2 py-3 overflow-y-auto">
      {groups.map((group) => (
        <div key={group.label} className="mb-4 last:mb-0">
          {!collapsed && (
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              {group.label}
            </p>
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = currentParent === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
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
                    />
                    {item.badge && novedadesCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-pink px-1 text-[9px] font-bold text-pink-foreground">
                        {novedadesCount > 9 ? "9+" : novedadesCount}
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

    {!collapsed && (
      <div className="p-3 border-t border-sidebar-border">
        <p className="text-[10px] text-sidebar-foreground/40 text-center">
          Sistema de Logística v2.1
        </p>
      </div>
    )}
  </div>
);

const AdminSidebar = ({
  activeSection,
  onSectionChange,
  novedadesCount = 0,
  userRole,
}: AdminSidebarProps) => {
  const { branding } = useTheme();
  const isMobile = useIsMobile();
  const isAliado = userRole === "aliado_logistico";
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentParent = LEGACY_TO_NEW[activeSection] ?? activeSection;

  const groups = isAliado
    ? MENU_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((it) => ALIADO_ALLOWED_SECTIONS.includes(it.id)),
      })).filter((g) => g.items.length > 0)
    : MENU_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((it) => !it.aliadoOnly),
      })).filter((g) => g.items.length > 0);

  const handleSectionChange = (section: string) => {
    onSectionChange(section);
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
            setCollapsed={() => {}}
            groups={groups}
            currentParent={currentParent}
            onSectionChange={handleSectionChange}
            novedadesCount={novedadesCount}
            branding={branding}
            showCollapseToggle={false}
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col bg-sidebar transition-all duration-200 h-full border-r border-sidebar-border flex-shrink-0",
        collapsed ? "w-[68px]" : "w-[240px]",
      )}
    >
      <SidebarInner
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        groups={groups}
        currentParent={currentParent}
        onSectionChange={handleSectionChange}
        novedadesCount={novedadesCount}
        branding={branding}
        showCollapseToggle={true}
      />
    </aside>
  );
};

export default AdminSidebar;
