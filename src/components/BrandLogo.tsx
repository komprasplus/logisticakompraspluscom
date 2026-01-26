import { forwardRef } from "react";
import { Truck } from "lucide-react";

interface BrandLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  alt?: string;
  showIcon?: boolean;
}

const sizeConfig = {
  sm: { text: "text-lg", icon: "h-5 w-5", iconBox: "w-7 h-7" },
  md: { text: "text-xl", icon: "h-6 w-6", iconBox: "w-9 h-9" },
  lg: { text: "text-2xl", icon: "h-7 w-7", iconBox: "w-11 h-11" },
  xl: { text: "text-3xl", icon: "h-8 w-8", iconBox: "w-14 h-14" },
};

const BrandLogo = forwardRef<HTMLDivElement, BrandLogoProps>(({ 
  className = "", 
  size = "md", 
  alt = "Plus Envíos",
  showIcon = true 
}, ref) => {
  const config = sizeConfig[size];

  return (
    <div ref={ref} className={`flex items-center gap-2 ${className}`} title={alt}>
      {showIcon && (
        <div className={`${config.iconBox} rounded-xl bg-gradient-button flex items-center justify-center shadow-md`}>
          <Truck className={`${config.icon} text-white`} />
        </div>
      )}
      <span className={`font-black ${config.text} tracking-tight`}>
        <span className="text-gradient-brand">Plus</span>
        <span className="text-foreground"> Envíos</span>
      </span>
    </div>
  );
});

BrandLogo.displayName = "BrandLogo";

export default BrandLogo;