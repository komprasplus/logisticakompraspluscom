import { Phone } from "lucide-react";

const SUPPORT_PHONE = "3242223825";
const SUPPORT_DISPLAY = "324 222 3825";

const BodegaSupportButton = () => {
  const callBodega = () => {
    window.open(`tel:+57${SUPPORT_PHONE}`, "_self");
  };

  return (
    <button
      onClick={callBodega}
      className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary py-3 px-4 font-bold text-primary-foreground transition-all active:scale-[0.98] shadow-card hover:shadow-elevated"
    >
      <Phone className="h-5 w-5" />
      <span>Llamar a Bodega</span>
      <span className="text-sm opacity-80">({SUPPORT_DISPLAY})</span>
    </button>
  );
};

export default BodegaSupportButton;
