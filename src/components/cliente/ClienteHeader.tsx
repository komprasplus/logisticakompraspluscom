import { motion } from "framer-motion";
import { LogOut, Phone, Store, Truck } from "lucide-react";
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
    <header className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-white/20">
      {/* Main Header Row */}
      <div className="flex h-18 items-center justify-between px-4 py-3">
        {/* Logo and Store Info */}
        <div className="flex items-center gap-3">
          {/* Neumorphic Brand Logo */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-button flex items-center justify-center shadow-md">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <span className="font-black text-lg tracking-tight hidden sm:block">
              <span className="text-gradient-brand">Plus</span>
              <span className="text-foreground"> Envíos</span>
            </span>
          </div>
          
          {/* Store Branding - Desktop */}
          <div className="hidden md:flex items-center gap-3 ml-3 pl-4 border-l border-white/20">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo tienda"
                className="h-10 w-10 rounded-xl object-cover border-2 border-white/30 shadow-md"
              />
            ) : (
              <div className="h-10 w-10 rounded-xl neu-flat flex items-center justify-center">
                <Store className="h-5 w-5 text-primary" />
              </div>
            )}
            <span className="text-sm font-bold text-foreground truncate max-w-[150px]">
              {storeName || "Mi Tienda"}
            </span>
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          {/* Warehouse Status - Neumorphic */}
          <motion.div
            className={`hidden lg:flex items-center gap-2 px-4 py-2 rounded-2xl neu-flat text-xs font-bold ${
              isWarehouseOpen
                ? "text-emerald-600"
                : "text-red-500"
            }`}
            animate={{ opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isWarehouseOpen ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
            Bodega {isWarehouseOpen ? "Abierta" : "Cerrada"}
          </motion.div>

          {/* Support Phone - Neumorphic */}
          <a
            href={`tel:${supportPhone.replace(/\s/g, "")}`}
            className="hidden sm:flex items-center gap-2 rounded-2xl neu-flat px-4 py-2 text-sm font-bold text-primary hover:shadow-elevated transition-all"
          >
            <Phone className="h-4 w-4" />
            {supportPhone}
          </a>

          {/* Mobile Store Logo */}
          <div className="flex md:hidden items-center">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo tienda"
                className="h-9 w-9 rounded-xl object-cover border-2 border-white/30 shadow-md"
              />
            ) : (
              <div className="h-9 w-9 rounded-xl neu-flat flex items-center justify-center">
                <Store className="h-4 w-4 text-primary" />
              </div>
            )}
          </div>

          {/* Sign Out - Neumorphic */}
          <button
            onClick={onSignOut}
            className="flex h-11 w-11 items-center justify-center rounded-2xl neu-flat hover:shadow-elevated transition-all"
          >
            <LogOut className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Secondary Row - Store Title & Weather */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 bg-white/5">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-bold text-foreground">
            Panel de Control
          </h1>
          <span className="text-muted-foreground">-</span>
          <span className="text-sm font-bold text-gradient-brand truncate max-w-[200px]">
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