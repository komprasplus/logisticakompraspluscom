import { motion } from "framer-motion";

interface MotorcycleIconProps {
  className?: string;
}

const MotorcycleIcon = ({ className = "" }: MotorcycleIconProps) => {
  return (
    <svg
      viewBox="0 0 64 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Delivery Box */}
      <motion.rect
        x="18"
        y="4"
        width="16"
        height="14"
        rx="2"
        fill="currentColor"
        className="text-primary"
        initial={{ y: 0 }}
        animate={{ y: [-1, 1, -1] }}
        transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
      />
      <motion.rect
        x="20"
        y="6"
        width="12"
        height="2"
        rx="1"
        fill="white"
        opacity="0.8"
        initial={{ y: 0 }}
        animate={{ y: [-1, 1, -1] }}
        transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
      />
      
      {/* Driver helmet */}
      <motion.ellipse
        cx="36"
        cy="10"
        rx="6"
        ry="7"
        fill="currentColor"
        className="text-primary"
        initial={{ y: 0 }}
        animate={{ y: [-0.5, 0.5, -0.5] }}
        transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
      />
      <motion.ellipse
        cx="36"
        cy="8"
        rx="4"
        ry="4"
        fill="white"
        opacity="0.3"
        initial={{ y: 0 }}
        animate={{ y: [-0.5, 0.5, -0.5] }}
        transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
      />
      
      {/* Driver body */}
      <motion.path
        d="M30 18 L42 18 L44 26 L28 26 Z"
        fill="currentColor"
        className="text-primary"
        initial={{ y: 0 }}
        animate={{ y: [-0.5, 0.5, -0.5] }}
        transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
      />
      
      {/* Motorcycle body */}
      <motion.path
        d="M10 28 L54 28 L50 32 L48 32 L46 28 L18 28 L16 32 L14 32 Z"
        fill="currentColor"
        className="text-foreground"
        initial={{ y: 0 }}
        animate={{ y: [0, 0.5, 0] }}
        transition={{ repeat: Infinity, duration: 0.5, ease: "easeInOut" }}
      />
      
      {/* Front wheel */}
      <motion.g
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.5, ease: "linear" }}
        style={{ transformOrigin: "50px 34px" }}
      >
        <circle cx="50" cy="34" r="6" fill="currentColor" className="text-foreground" />
        <circle cx="50" cy="34" r="4" fill="currentColor" className="text-muted" />
        <circle cx="50" cy="34" r="2" fill="currentColor" className="text-foreground" />
        {/* Spokes */}
        <line x1="50" y1="28" x2="50" y2="40" stroke="currentColor" strokeWidth="0.5" className="text-foreground" />
        <line x1="44" y1="34" x2="56" y2="34" stroke="currentColor" strokeWidth="0.5" className="text-foreground" />
      </motion.g>
      
      {/* Rear wheel */}
      <motion.g
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.5, ease: "linear" }}
        style={{ transformOrigin: "14px 34px" }}
      >
        <circle cx="14" cy="34" r="6" fill="currentColor" className="text-foreground" />
        <circle cx="14" cy="34" r="4" fill="currentColor" className="text-muted" />
        <circle cx="14" cy="34" r="2" fill="currentColor" className="text-foreground" />
        {/* Spokes */}
        <line x1="14" y1="28" x2="14" y2="40" stroke="currentColor" strokeWidth="0.5" className="text-foreground" />
        <line x1="8" y1="34" x2="20" y2="34" stroke="currentColor" strokeWidth="0.5" className="text-foreground" />
      </motion.g>
      
      {/* Exhaust smoke */}
      <motion.circle
        cx="6"
        cy="30"
        r="2"
        fill="currentColor"
        className="text-muted-foreground"
        opacity="0.4"
        initial={{ x: 0, opacity: 0.4, scale: 1 }}
        animate={{ x: -10, opacity: 0, scale: 1.5 }}
        transition={{ repeat: Infinity, duration: 0.8, ease: "easeOut" }}
      />
      <motion.circle
        cx="4"
        cy="28"
        r="1.5"
        fill="currentColor"
        className="text-muted-foreground"
        opacity="0.3"
        initial={{ x: 0, opacity: 0.3, scale: 1 }}
        animate={{ x: -8, opacity: 0, scale: 1.3 }}
        transition={{ repeat: Infinity, duration: 0.6, delay: 0.2, ease: "easeOut" }}
      />
    </svg>
  );
};

export default MotorcycleIcon;
