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
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import logo from "@/assets/logo-kompras-plus.png";
import { cn } from "@/lib/utils";

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  novedadesCount?: number;
}

const menuItems = [
  { 
    id: "mapa", 
    label: "Mapa Real-time", 
    icon: MapPin,
    description: "Vista en vivo de entregas" 
  },
  { 
    id: "despacho", 
    label: "Despacho", 
    icon: Package,
    description: "Gestión de pedidos" 
  },
  { 
    id: "inventario", 
    label: "Inventario Bodega", 
    icon: Warehouse,
    description: "Control de stock" 
  },
  { 
    id: "novedades", 
    label: "Novedades", 
    icon: AlertTriangle,
    description: "Pedidos con problemas",
    badge: true 
  },
  { 
    id: "liquidaciones", 
    label: "Liquidaciones", 
    icon: DollarSign,
    description: "Cierre de entregas" 
  },
  { 
    id: "configuracion", 
    label: "Configuración", 
    icon: Settings,
    description: "Ajustes del sistema" 
  },
];

const AdminSidebar = ({ activeSection, onSectionChange, novedadesCount = 0 }: AdminSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside 
      className={cn(
        "flex flex-col bg-white border-r border-border transition-all duration-300 h-full",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        {!collapsed && (
          <img src={logo} alt="Kompras Plus" className="h-10 w-auto" />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = activeSection === item.id;
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-md" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon className={cn("h-5 w-5", isActive && "text-primary-foreground")} />
                {item.badge && novedadesCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                    {novedadesCount > 9 ? "9+" : novedadesCount}
                  </span>
                )}
              </div>
              {!collapsed && (
                <div className="flex-1 text-left">
                  <p className={cn(
                    "text-sm font-medium",
                    isActive ? "text-primary-foreground" : "text-foreground"
                  )}>
                    {item.label}
                  </p>
                  <p className={cn(
                    "text-xs",
                    isActive ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}>
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
