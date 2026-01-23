import { Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";

interface DarkModeToggleProps {
  isDark: boolean;
  onToggle: () => void;
  className?: string;
}

const DarkModeToggle = ({ isDark, onToggle, className = "" }: DarkModeToggleProps) => {
  return (
    <button
      onClick={onToggle}
      className={`relative flex items-center w-16 h-9 rounded-full neu-pressed transition-all duration-300 ${className}`}
      aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
    >
      {/* Track background gradient for dark mode */}
      <motion.div
        className="absolute inset-0.5 rounded-full"
        animate={{
          background: isDark 
            ? "linear-gradient(135deg, hsl(222, 35%, 15%), hsl(222, 40%, 8%))" 
            : "transparent"
        }}
        transition={{ duration: 0.3 }}
      />
      
      {/* Toggle Knob */}
      <motion.div
        className="relative z-10 flex items-center justify-center w-7 h-7 rounded-full bg-gradient-button shadow-lg"
        animate={{
          x: isDark ? 28 : 4,
        }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        {isDark ? (
          <Moon className="h-4 w-4 text-white" />
        ) : (
          <Sun className="h-4 w-4 text-white" />
        )}
      </motion.div>
      
      {/* Icons on track */}
      <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
        <Sun className={`h-3.5 w-3.5 transition-opacity ${isDark ? "opacity-30 text-gray-400" : "opacity-0"}`} />
        <Moon className={`h-3.5 w-3.5 transition-opacity ${isDark ? "opacity-0" : "opacity-30 text-gray-500"}`} />
      </div>
    </button>
  );
};

export default DarkModeToggle;