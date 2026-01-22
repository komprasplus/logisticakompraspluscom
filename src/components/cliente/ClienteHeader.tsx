import { motion } from "framer-motion";
import { LogOut, Phone, Store, Clock } from "lucide-react";
const logo = "/logo-kompras-plus.png";
import WeatherWidget from "@/components/WeatherWidget";

interface ClienteHeaderProps {
  storeName: string | null;
  logoUrl: string | null;
  supportPhone: string;
  onSignOut: () => void;
  isWarehouseOpen: boolean;
}

const ClienteHeader = ({
  storeName,
  logoUrl,
  supportPhone,
  onSignOut,
  isWarehouseOpen,
}: ClienteHeaderProps) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-white shadow-sm">
      {/* Main Header Row */}
      <div className="flex h-16 items-center justify-between px-4">
        {/* Logo and Store Info */}
        <div className="flex items-center gap-3">
          <img src={logo} alt="Plus Envios" className="h-10 w-auto" />
          
          {/* Store Branding - Desktop */}
          <div className="hidden sm:flex items-center gap-2 ml-2 pl-3 border-l border-border">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo tienda"
                className="h-8 w-8 rounded-full object-cover border-2 border-primary/20"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Store className="h-4 w-4 text-primary" />
              </div>
            )}
            <span className="text-sm font-semibold text-foreground truncate max-w-[150px]">
              {storeName || "Mi Tienda"}
            </span>
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Warehouse Status */}
          <motion.div
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
              isWarehouseOpen
                ? "bg-green-500/10 text-green-600"
                : "bg-red-500/10 text-red-600"
            }`}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isWarehouseOpen ? "bg-green-500" : "bg-red-500"
              }`}
            />
            Bodega {isWarehouseOpen ? "Abierta" : "Cerrada"}
          </motion.div>

          {/* Support Phone */}
          <a
            href={`tel:${supportPhone.replace(/\s/g, "")}`}
            className="hidden sm:flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            <Phone className="h-4 w-4" />
            {supportPhone}
          </a>

          {/* Mobile Store Logo */}
          <div className="flex sm:hidden items-center gap-2">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo tienda"
                className="h-8 w-8 rounded-full object-cover border-2 border-primary/20"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Store className="h-4 w-4 text-primary" />
              </div>
            )}
          </div>

          {/* Sign Out */}
          <button
            onClick={onSignOut}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
          >
            <LogOut className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Secondary Row - Store Title & Weather */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-t border-border/50">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-bold text-foreground">
            Panel de Control
          </h1>
          <span className="text-muted-foreground">-</span>
          <span className="text-sm font-medium text-primary truncate max-w-[200px]">
            {storeName || "Mi Tienda"}
          </span>
        </div>

        {/* Compact Weather */}
        <div className="hidden sm:block">
          <WeatherWidget compact />
        </div>
      </div>
    </header>
  );
};

export default ClienteHeader;
