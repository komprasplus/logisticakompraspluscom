import { useState } from "react";
import { 
  MapPin, 
  Package, 
  Warehouse, 
  AlertTriangle, 
  DollarSign, 
  Settings,
  ChevronLeft,
  ChevronRight,
  LucideIcon,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
const logo = "/logo-plus.png";
import { cn } from "@/lib/utils";

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  novedadesCount?: number;
}

// 3D Icon wrapper component with shadow and depth effect
const Icon3D = ({ 
  icon: IconComponent, 
  isActive, 
  colorClass = "from-primary to-primary/80",
  accentColor = "bg-primary/20"
}: { 
  icon: LucideIcon; 
  isActive: boolean; 
  colorClass?: string;
  accentColor?: string;
}) => (
  <div className="relative">
    {/* Shadow layer for 3D depth */}
    <div className={cn(
      "absolute inset-0 rounded-xl blur-sm transition-all duration-300",
      isActive ? "bg-primary/40 translate-y-1" : "bg-transparent"
    )} />
    {/* Main icon container with gradient */}
    <div className={cn(
      "relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300",
      isActive 
        ? `bg-gradient-to-br ${colorClass} shadow-lg shadow-primary/30` 
        : `${accentColor} hover:shadow-md`
    )}>
      <IconComponent className={cn(
        "h-5 w-5 transition-all duration-300",
        isActive 
          ? "text-white drop-shadow-sm" 
          : "text-muted-foreground"
      )} 
      strokeWidth={isActive ? 2.5 : 2}
      />
    </div>
  </div>
);

const menuItems = [
  { 
    id: "mapa", 
    label: "Mapa Real-time", 
    icon: MapPin,
    description: "Vista en vivo de entregas",
    colorClass: "from-blue-500 to-blue-600",
    accentColor: "bg-blue-500/10"
  },
  { 
    id: "despacho", 
    label: "Despacho", 
    icon: Package,
    description: "Gestión de pedidos",
    colorClass: "from-emerald-500 to-emerald-600",
    accentColor: "bg-emerald-500/10"
  },
  { 
    id: "inventario", 
    label: "Inventario Bodega", 
    icon: Warehouse,
    description: "Control de stock",
    colorClass: "from-amber-500 to-amber-600",
    accentColor: "bg-amber-500/10"
  },
  { 
    id: "novedades", 
    label: "Novedades", 
    icon: AlertTriangle,
    description: "Pedidos con problemas",
    badge: true,
    colorClass: "from-orange-500 to-red-500",
    accentColor: "bg-orange-500/10"
  },
  { 
    id: "liquidaciones", 
    label: "Liquidaciones", 
    icon: DollarSign,
    description: "Cierre de entregas",
    colorClass: "from-violet-500 to-purple-600",
    accentColor: "bg-violet-500/10"
  },
  { 
    id: "configuracion", 
    label: "Configuración", 
    icon: Settings,
    description: "Ajustes del sistema",
    colorClass: "from-slate-500 to-slate-600",
    accentColor: "bg-slate-500/10"
  },
];

const AdminSidebar = ({ activeSection, onSectionChange, novedadesCount = 0 }: AdminSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside 
      className={cn(
        "flex flex-col bg-white border-r border-border transition-all duration-300 h-full shadow-sm",
        collapsed ? "w-20" : "w-72"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        {!collapsed && (
          <img src={logo} alt="Plus Envíos" className="h-10 w-auto" />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-xl hover:bg-muted transition-all duration-200 hover:shadow-md"
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-2">
        {menuItems.map((item) => {
          const isActive = activeSection === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300",
                isActive 
                  ? "bg-muted/50 shadow-sm" 
                  : "hover:bg-muted/30"
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
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-[10px] font-bold text-white shadow-lg shadow-orange-500/30 animate-pulse">
                    {novedadesCount > 9 ? "9+" : novedadesCount}
                  </span>
                )}
              </div>
              {!collapsed && (
                <div className="flex-1 text-left">
                  <p className={cn(
                    "text-sm font-semibold transition-colors duration-200",
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Sistema de Logística v2.0
          </p>
        </div>
      )}
    </aside>
  );
};

export default AdminSidebar;
