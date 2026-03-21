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
  Truck,
  LayoutDashboard,
  FileText,
  Database,
  Key,
  Zap,
  ShieldCheck,
  Satellite,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  novedadesCount?: number;
  userRole?: string | null;
}

// 3D Icon wrapper component with neumorphic depth effect
const Icon3D = ({ 
  icon: IconComponent, 
  isActive, 
  colorClass = "from-primary to-secondary",
  accentColor = "bg-primary/10"
}: { 
  icon: LucideIcon; 
  isActive: boolean; 
  colorClass?: string;
  accentColor?: string;
}) => (
  <div className="relative">
    {/* Shadow layer for 3D depth */}
    <div className={cn(
      "absolute inset-0 rounded-2xl blur-sm transition-all duration-300",
      isActive ? "bg-primary/40 translate-y-1" : "bg-transparent"
    )} />
    {/* Main icon container with gradient */}
    <div className={cn(
      "relative flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-300",
      isActive 
        ? `bg-gradient-to-br ${colorClass} shadow-lg` 
        : `${accentColor} neu-flat`
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
    id: "analytics", 
    label: "Control Tower", 
    icon: LayoutDashboard,
    description: "Analíticas en tiempo real",
    colorClass: "from-primary to-blue-600",
    accentColor: "bg-primary/10"
  },
  { 
    id: "mapa", 
    label: "Mapa Real-time", 
    icon: MapPin,
    description: "Vista en vivo de entregas",
    colorClass: "from-blue-500 to-cyan-500",
    accentColor: "bg-blue-500/10"
  },
  { 
    id: "despacho", 
    label: "Despacho", 
    icon: Package,
    description: "Gestión de pedidos",
    colorClass: "from-emerald-500 to-teal-500",
    accentColor: "bg-emerald-500/10"
  },
  { 
    id: "inventario", 
    label: "Inventario Bodega", 
    icon: Warehouse,
    description: "Control de stock",
    colorClass: "from-amber-500 to-orange-500",
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
    colorClass: "from-violet-500 to-purple-500",
    accentColor: "bg-violet-500/10"
  },
  { 
    id: "informes", 
    label: "Informes", 
    icon: FileText,
    description: "Reportes y exportación",
    colorClass: "from-indigo-500 to-blue-500",
    accentColor: "bg-indigo-500/10"
  },
  { 
    id: "configuracion", 
    label: "Configuración", 
    icon: Settings,
    description: "Ajustes del sistema",
    colorClass: "from-slate-500 to-gray-500",
    accentColor: "bg-slate-500/10"
  },
  { 
    id: "auditoria", 
    label: "Auditoría", 
    icon: Database,
    description: "Vista bruta de Supabase",
    colorClass: "from-rose-500 to-pink-500",
    accentColor: "bg-rose-500/10"
  },
  {
    id: "finanzas",
    label: "Admin Finanzas",
    icon: DollarSign,
    description: "Retiros y pagos a tiendas",
    colorClass: "from-emerald-500 to-green-600",
    accentColor: "bg-emerald-500/10"
  },
  {
    id: "integraciones", 
    label: "API & Integraciones", 
    icon: Key,
    description: "Webhooks y llaves API",
    colorClass: "from-cyan-500 to-teal-500",
    accentColor: "bg-cyan-500/10"
  },
  {
    id: "flex",
    label: "Monitor Flex",
    icon: Zap,
    description: "Mercado Libre Flex",
    colorClass: "from-amber-500 to-yellow-500",
    accentColor: "bg-amber-500/10"
  },
  {
    id: "webhook-monitor",
    label: "Webhook Monitor",
    icon: Satellite,
    description: "Shadow Layer entrante",
    colorClass: "from-violet-500 to-purple-600",
    accentColor: "bg-violet-500/10"
  },
];

const AdminSidebar = ({ activeSection, onSectionChange, novedadesCount = 0, userRole }: AdminSidebarProps) => {
  const isSuperAdmin = userRole === "super_admin";

  const allMenuItems = isSuperAdmin
    ? [...menuItems, {
        id: "super-admin",
        label: "Súper Admin",
        icon: ShieldCheck,
        description: "Gestión de organizaciones",
        colorClass: "from-yellow-500 to-amber-600",
        accentColor: "bg-yellow-500/10",
      }]
    : menuItems;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside 
      className={cn(
        "flex flex-col glass-strong transition-all duration-300 h-full border-r border-white/20",
        collapsed ? "w-24" : "w-80"
      )}
    >
      {/* Logo - Glassmorphic Header */}
      <div className="flex items-center justify-between p-5 border-b border-white/10">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-button flex items-center justify-center shadow-md">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <span className="font-black text-lg tracking-tight">
              <span className="text-gradient-brand">Plus</span>
              <span className="text-foreground"> Envíos</span>
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-3 rounded-2xl neu-flat hover:shadow-elevated transition-all duration-200"
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-3">
        {allMenuItems.map((item) => {
          const isActive = activeSection === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300",
                isActive 
                  ? "neu-pressed" 
                  : "neu-flat hover:shadow-elevated"
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
                  <p className={cn(
                    "text-sm font-bold transition-colors duration-200",
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