import { useState } from "react";
import { Navigation, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  openNavigation,
  setNavPreference,
  type NavApp,
  type NavDestination,
  type NavOrigin,
} from "@/lib/navigation";

interface NavigationChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: NavDestination | null;
  origin?: NavOrigin | null;
}

const NavigationChoiceDialog = ({
  open,
  onOpenChange,
  destination,
  origin,
}: NavigationChoiceDialogProps) => {
  const [remember, setRemember] = useState(true);

  const handleChoice = (app: NavApp) => {
    if (!destination) return;
    if (remember) setNavPreference(app);
    openNavigation(app, destination, origin);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Elige tu navegador</DialogTitle>
          <DialogDescription>
            Abriremos la ruta en la app que prefieras.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          <button
            type="button"
            onClick={() => handleChoice("google_maps")}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 p-4 transition-colors"
          >
            <div className="h-12 w-12 rounded-full bg-blue-500/15 text-blue-600 flex items-center justify-center">
              <MapPin className="h-6 w-6" />
            </div>
            <span className="font-semibold text-sm">Google Maps</span>
            <span className="text-[10px] text-muted-foreground">
              Tráfico en vivo
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleChoice("waze")}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 p-4 transition-colors"
          >
            <div className="h-12 w-12 rounded-full bg-cyan-500/15 text-cyan-600 flex items-center justify-center">
              <Navigation className="h-6 w-6" />
            </div>
            <span className="font-semibold text-sm">Waze</span>
            <span className="text-[10px] text-muted-foreground">
              Alertas de comunidad
            </span>
          </button>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
          <Label
            htmlFor="remember-nav"
            className="text-xs text-muted-foreground cursor-pointer"
          >
            Recordar mi elección
          </Label>
          <Switch
            id="remember-nav"
            checked={remember}
            onCheckedChange={setRemember}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NavigationChoiceDialog;
