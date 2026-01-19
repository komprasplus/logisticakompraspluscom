import { motion } from "framer-motion";
import { 
  LayoutDashboard, 
  Package, 
  AlertTriangle, 
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ClienteView = "dashboard" | "pedidos" | "novedades" | "reportes";

interface ClienteSidebarProps {
  activeView: ClienteView;
  onViewChange: (view: ClienteView) => void;
  novedadesCount: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

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
    key: "reportes" as ClienteView,
    label: "Reportes",
    icon: FileSpreadsheet,
    gradient: "from-emerald-500 to-emerald-600",
    shadow: "shadow-emerald-500/30",
  },
];

const ClienteSidebar = ({ 
  activeView, 
  onViewChange, 
  novedadesCount,
  collapsed,
  onToggleCollapse
}: ClienteSidebarProps) => {
  return (
    <motion.aside
      className={cn(
        "fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white border-r border-border z-30 flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-56"
      )}
      initial={{ x: -100 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Nav Items */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.key;
          const showBadge = item.key === "novedades" && novedadesCount > 0;

          return (
            <motion.button
              key={item.key}
              onClick={() => onViewChange(item.key)}
              className={cn(
                "relative w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all overflow-hidden group",
                isActive
                  ? "text-white"
                  : "text-muted-foreground hover:bg-muted/50"
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* 3D Active Background */}
              {isActive && (
                <>
                  <motion.div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-br rounded-xl",
                      item.gradient
                    )}
                    layoutId="activeNav"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-xl" />
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20 rounded-b-xl" />
                </>
              )}

              <div className={cn(
                "relative flex items-center justify-center rounded-lg p-1.5 transition-colors",
                isActive ? "bg-white/20" : "bg-muted"
              )}>
                <Icon className="h-5 w-5" />
              </div>

              {!collapsed && (
                <span className="relative flex-1 text-left">{item.label}</span>
              )}

              {/* Badge for novedades */}
              {showBadge && (
                <span className={cn(
                  "relative flex h-5 min-w-5 items-center justify-center rounded-full text-xs font-bold",
                  isActive ? "bg-white/20 text-white" : "bg-orange-500 text-white"
                )}>
                  {novedadesCount}
                </span>
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={onToggleCollapse}
        className="m-2 flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-5 w-5" />
        ) : (
          <ChevronLeft className="h-5 w-5" />
        )}
      </button>
    </motion.aside>
  );
};

export default ClienteSidebar;
