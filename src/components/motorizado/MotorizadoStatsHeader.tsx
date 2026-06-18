import { Bell, LogOut, Map } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import ScoreBadge from "./ScoreBadge";
import MotorizadoDailyStatsStrip from "./MotorizadoDailyStatsStrip";
import { cn } from "@/lib/utils";

interface DailyStats {
  deliveries: number;
  cashCollected: number;
  earnings: number;
}

interface MotorizadoStatsHeaderProps {
  avatarUrl?: string | null;
  fullName?: string | null;
  isOnline: boolean;
  score: number;
  notificationCount?: number;
  showMapView: boolean;
  onToggleMap: () => void;
  onProfileClick: () => void;
  onSignOut: () => void;
  dailyStats?: DailyStats;
}

const getInitials = (name?: string | null): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
};

const MotorizadoStatsHeader = ({
  avatarUrl,
  fullName,
  isOnline,
  score,
  notificationCount = 0,
  showMapView,
  onToggleMap,
  onProfileClick,
  onSignOut,
  dailyStats,
}: MotorizadoStatsHeaderProps) => {
  return (
    <header className="sticky top-0 z-30 bg-primary text-primary-foreground border-b border-primary/40 shadow-sm">
      <div className="flex h-14 items-center justify-between px-3 sm:px-4 gap-3">
        {/* Identidad: avatar + nombre + score */}
        <button
          onClick={onProfileClick}
          className="flex items-center gap-2.5 min-w-0 group flex-1"
          aria-label="Ver mi perfil"
        >
          <div className="relative flex-shrink-0">
            <Avatar className="h-10 w-10 border-2 border-gold/50 ring-1 ring-primary-foreground/10">
              <AvatarImage src={avatarUrl || undefined} alt={fullName || ""} />
              <AvatarFallback className="bg-gold text-gold-foreground text-sm font-bold">
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-primary",
                isOnline ? "bg-success" : "bg-muted-foreground/60",
              )}
              aria-label={isOnline ? "En línea" : "Desconectado"}
            />
          </div>
          <div className="min-w-0 hidden sm:block">
            <p className="text-xs text-primary-foreground/60 leading-tight">Hola,</p>
            <p className="text-sm font-semibold truncate leading-tight">
              {fullName?.split(" ")[0] ?? "Motorizado"}
            </p>
          </div>
        </button>

        {/* Score badge — protagonista */}
        <ScoreBadge score={score} size="md" className="bg-primary-foreground/95" />

        {/* Acciones secundarias */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {notificationCount > 0 && (
            <div className="relative">
              <button
                className="h-9 w-9 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 flex items-center justify-center transition-colors"
                aria-label="Notificaciones"
              >
                <Bell className="h-4 w-4" />
              </button>
              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-pink text-pink-foreground text-[10px] font-bold flex items-center justify-center">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            </div>
          )}

          <button
            onClick={onToggleMap}
            className={cn(
              "h-9 w-9 rounded-lg flex items-center justify-center transition-colors",
              showMapView
                ? "bg-gold text-gold-foreground"
                : "bg-primary-foreground/10 hover:bg-primary-foreground/20",
            )}
            aria-label={showMapView ? "Ocultar mapa" : "Ver mapa"}
          >
            <Map className="h-4 w-4" />
          </button>

          <button
            onClick={onSignOut}
            className="h-9 w-9 rounded-lg bg-primary-foreground/10 hover:bg-pink/20 hover:text-pink-foreground flex items-center justify-center transition-colors"
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {dailyStats && (
        <MotorizadoDailyStatsStrip
          deliveries={dailyStats.deliveries}
          cashCollected={dailyStats.cashCollected}
          earnings={dailyStats.earnings}
        />
      )}
    </header>
  );
};

export default MotorizadoStatsHeader;
