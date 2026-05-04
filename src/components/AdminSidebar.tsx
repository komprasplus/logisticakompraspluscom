import { useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  MapPin,
  Package,
  Warehouse,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LucideIcon,
  Truck,
  LayoutDashboard,
  FileText,
  Activity,
  Wallet,
  ScanLine,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  novedadesCount?: number;
  userRole?: string | null;
}

const ALIADO_ALLOWED_SECTIONS = ["despachos", "mapa", "manifiesto-scanner", "manifiestos"];

// Maps legacy section IDs to the new consolidated section
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

const Icon3D = ({
  icon: IconComponent,
  isActive,
  colorClass = "from-primary to-secondary",
  accentColor = "bg-primary/10",
}: {
  icon: LucideIcon;
  isActive: boolean;
  colorClass?: string;
  accentColor?: string;
}) => (
  <div className="relative">
    <div
      className={cn(
        "absolute inset-0 rounded-2xl blur-sm transition-all duration-300",
        isActive ? "bg-primary/40 translate-y-1" : "bg-transparent",
      )}
    />
    <div
      className={cn(
        "relative flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-300",
        isActive ? `bg-gradient-to-br ${colorClass} shadow-lg` : `${accentColor} neu-flat`,
      )}
    >
      <IconComponent
        className={cn(
          "h-5 w-5 transition-all duration-300",
          isActive ? "text-white drop-shadow-sm" : "text-muted-foreground",
        )}
        strokeWidth={isActive ? 2.5 : 2}
      />
    </div>
  </div>
);

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  colorClass: string;
  accentColor: string;
  badge?: boolean;
  aliadoOnly?: boolean;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const MENU_GROUPS: MenuGroup[] = [
  {
    label: "🚚 Operaciones",
    items: [
      {
        id: "analytics",
        label: "Control Tower",
        icon: LayoutDashboard,
        description: "Analíticas en tiempo real",
        colorClass: "from-primary to-primary/70",
        accentColor: "bg-primary/10",
      },
      {
        id: "mapa",
        label: "Mapa Real-time",
        icon: MapPin,
        description: "Vista en vivo de entregas",
        colorClass: "from-primary to-secondary",
        accentColor: "bg-primary/10",
      },
      {
        id: "despachos",
        label: "Centro de Despachos",
        icon: Package,
        description: "Pedidos, ruta y novedades",
        badge: true,
        colorClass: "from-emerald-500 to-teal-500",
        accentColor: "bg-emerald-500/10",
      },
      {
        id: "manifiesto-scanner",
        label: "Escáner & Asignación",
        icon: ScanLine,
        description: "Modo metralleta para 4PL",
        colorClass: "from-cyan-500 to-blue-500",
        accentColor: "bg-cyan-500/10",
        aliadoOnly: true,
      },
      {
        id: "manifiestos",
        label: "Planificador Rutas",
        icon: ClipboardList,
        description: "Manifiestos generados",
        colorClass: "from-fuchsia-500 to-purple-500",
        accentColor: "bg-fuchsia-500/10",
        aliadoOnly: true,
      },
      {
        id: "inventario",
        label: "Inventario Bodega",
        icon: Warehouse,
        description: "Control de stock",
        colorClass: "from-amber-500 to-orange-500",
        accentColor: "bg-amber-500/10",
      },
    ],
  },
  {
    label: "💰 Finanzas",
    items: [
      {
        id: "tesoreria",
        label: "Tesorería",
        icon: Wallet,
        description: "Liquidación, pagos y rentabilidad",
        colorClass: "from-emerald-500 to-green-600",
        accentColor: "bg-emerald-500/10",
      },
    ],
  },
  {
    label: "📊 Análisis y Sistema",
    items: [
      {
        id: "informes",
        label: "Informes",
        icon: FileText,
        description: "Reportes y exportación",
        colorClass: "from-primary/80 to-secondary",
        accentColor: "bg-primary/10",
      },
      {
        id: "monitoreo",
        label: "Monitoreo Técnico",
        icon: Activity,
        description: "Webhooks, Flex y auditoría",
        colorClass: "from-violet-500 to-purple-600",
        accentColor: "bg-violet-500/10",
      },
    ],
  },
  {
    label: "⚙️ Ajustes",
    items: [
      {
        id: "configuracion",
        label: "Configuración General",
        icon: Settings,
        description: "Usuarios, API y sistema",
        colorClass: "from-slate-500 to-gray-500",
        accentColor: "bg-slate-500/10",
      },
    ],
  },
];

const AdminSidebar = ({
  activeSection,
  onSectionChange,
  novedadesCount = 0,
  userRole,
}: AdminSidebarProps) => {
  const { branding } = useTheme();
  const isAliado = userRole === "aliado_logistico";
  const [collapsed, setCollapsed] = useState(false);

  // Resolve current parent section (handles legacy IDs)
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

  return (
    <aside
      className={cn(
        "flex flex-col glass-strong transition-all duration-300 h-full border-r border-white/20",
        collapsed ? "w-24" : "w-80",
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between p-5 border-b border-white/10">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            {branding.logo_url ? (
              <img
                src={branding.logo_url}
                alt={branding.nombre}
                className="h-10 w-10 rounded-xl object-contain shadow-md"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-button flex items-center justify-center shadow-md flex-shrink-0">
                <Truck className="h-5 w-5 text-white" />
              </div>
            )}
            <span className="font-black text-lg tracking-tight truncate">
              <span className="text-gradient-brand">{branding.nombre}</span>
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-3 rounded-2xl neu-flat hover:shadow-elevated transition-all duration-200"
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto space-y-5">
        {groups.map((group) => (
          <div key={group.label} className="space-y-2">
            {!collapsed && (
              <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </p>
            )}
            <div className="space-y-2">
              {group.items.map((item) => {
                const isActive = currentParent === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onSectionChange(item.id)}
                    className={cn(
                      "w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300",
                      isActive ? "neu-pressed" : "neu-flat hover:shadow-elevated",
                    )}
                  >
                    <div className="relative">
                      <Icon3D
                        icon={item.icon}
                        isActive={isActive}
                        colorClass={item.colorClass}
                        accentColor={item.accentColor}
                      />
                      {item.badge && novedadesCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-[10px] font-bold text-white shadow-lg animate-pulse">
                          {novedadesCount > 9 ? "9+" : novedadesCount}
                        </span>
                      )}
                    </div>
                    {!collapsed && (
                      <div className="flex-1 text-left">
                        <p
                          className={cn(
                            "text-sm font-bold transition-colors duration-200",
                            isActive ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {item.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-5 border-t border-white/10">
          <p className="text-xs text-muted-foreground text-center font-medium">
            Sistema de Logística v2.0
          </p>
        </div>
      )}
    </aside>
  );
};

export default AdminSidebar;
