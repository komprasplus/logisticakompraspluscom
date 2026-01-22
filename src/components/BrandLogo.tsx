import { useState } from "react";

interface BrandLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  alt?: string;
}

const sizeClasses = {
  sm: "h-8",
  md: "h-10",
  lg: "h-16",
  xl: "h-24",
};

const textSizes = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-3xl",
};

const BrandLogo = ({ className = "", size = "md", alt = "Plus Envíos" }: BrandLogoProps) => {
  const [imageError, setImageError] = useState(false);

  if (imageError) {
    // Fallback: Styled text logo
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <span className={`font-black ${textSizes[size]} tracking-tight`}>
          <span className="text-primary">Plus</span>
          <span className="text-secondary"> Envíos</span>
        </span>
      </div>
    );
  }

  return (
    <img
      src="/logo-oficial.png"
      alt={alt}
      className={`${sizeClasses[size]} w-auto ${className}`}
      onError={() => setImageError(true)}
    />
  );
};

export default BrandLogo;
