import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Zap, MapPin, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import FlexReceptionScanner from "@/components/admin/FlexReceptionScanner";
import { ZONAS, getAllZonas } from "@/lib/zonas";

interface ScannedItem {
  barcode: string;
  zona: string;
  timestamp: Date;
}

const RecepcionFlex = () => {
  const navigate = useNavigate();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);

  const handleScanSuccess = useCallback(() => {
    // Scanner handles DB insertion; we just track session count
    setScannedItems(prev => [
      { barcode: `FLEX-${Date.now()}`, zona: "AUTO", timestamp: new Date() },
      ...prev,
    ]);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-strong border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Zap className="h-5 w-5 text-amber-500" />
        <h1 className="font-bold text-lg">Recepción Flex</h1>
        {scannedItems.length > 0 && (
          <span className="ml-auto text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
            {scannedItems.length} escaneados
          </span>
        )}
      </header>

      <main className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Activate Scanner */}
        <Button
          onClick={() => setScannerOpen(true)}
          className="w-full h-16 text-lg gap-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white shadow-lg"
        >
          <Package className="h-6 w-6" />
          Activar Escáner
        </Button>

        {/* Zonificación Automática indicator */}
        <div className="flex items-center gap-2 p-3 rounded-2xl neu-flat">
          <MapPin className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-medium">Zonificación Automática</span>
          <span className="ml-auto text-xs bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-semibold">
            Activa
          </span>
        </div>

        {/* Scanned session list */}
        {scannedItems.length > 0 ? (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">Paquetes escaneados esta sesión</h2>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {scannedItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl neu-flat">
                  <Package className="h-4 w-4 text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono font-medium truncate">{item.barcode}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.timestamp.toLocaleTimeString("es-CO")}
                    </p>
                  </div>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {item.zona}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No se han escaneado paquetes aún</p>
            <p className="text-xs mt-1">Presiona "Activar Escáner" para comenzar</p>
          </div>
        )}
      </main>

      <FlexReceptionScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onSuccess={handleScanSuccess}
      />
    </div>
  );
};

export default RecepcionFlex;
