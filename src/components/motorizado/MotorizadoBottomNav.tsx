import { Map, Package, User, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export type MotorizadoTab = "pedidos" | "mapa" | "wallet" | "perfil";

interface MotorizadoBottomNavProps {
  activeTab: MotorizadoTab;
  onTabChange: (tab: MotorizadoTab) => void;
  pedidosBadge?: number;
}

interface TabConfig {
  id: MotorizadoTab;
  label: string;
  icon: typeof Map;
}

const TABS: TabConfig[] = [
  { id: "pedidos", label: "Pedidos", icon: Package },
  { id: "mapa", label: "Mapa", icon: Map },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "perfil", label: "Perfil", icon: User },
];

const MotorizadoBottomNav = ({
  activeTab,
  onTabChange,
  pedidosBadge = 0,
}: MotorizadoBottomNavProps) => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-card border-t border-border shadow-[0_-4px_12px_rgba(27,41,89,0.06)]"
      aria-label="Navegación principal"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-4 h-16">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const showBadge = tab.id === "pedidos" && pedidosBadge > 0;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 relative transition-colors active:scale-95",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {/* Indicador activo superior */}
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-10 bg-gold rounded-b-full"
                  aria-hidden="true"
                />
              )}

              <div className="relative">
                <Icon
                  className={cn(
                    "h-5 w-5 transition-all",
                    isActive && "scale-110",
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {showBadge && (
                  <span
                    className="absolute -top-1.5 -right-2 h-4 min-w-4 px-1 rounded-full bg-pink text-pink-foreground text-[10px] font-bold flex items-center justify-center"
                    aria-label={`${pedidosBadge} pedidos`}
                  >
                    {pedidosBadge > 9 ? "9+" : pedidosBadge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] leading-none",
                  isActive ? "font-semibold" : "font-medium",
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MotorizadoBottomNav;
