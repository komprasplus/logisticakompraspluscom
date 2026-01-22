import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { MapPin } from "lucide-react";

const logo = "/logo-plus-envios.png";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsLoading(false);
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Thin progress bar at top */}
      {isLoading && (
        <motion.div
          className="absolute top-0 left-0 h-1 bg-secondary"
          initial={{ width: "0%" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      )}

      <motion.div
        className="flex flex-col items-center gap-6"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        {/* Logo */}
        <motion.img
          src={logo}
          alt="Plus Envíos"
          className="w-48 h-auto"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
        />

        <motion.div
          className="flex items-center gap-2 rounded-full bg-muted px-4 py-2"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            Carrera 20 # 14-30 Local 212, Bogotá
          </span>
        </motion.div>
      </motion.div>

      <motion.button
        onClick={onComplete}
        className="absolute bottom-12 rounded-full bg-primary px-8 py-3 font-bold text-primary-foreground shadow-elevated transition-transform hover:scale-105 active:scale-95"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        Comenzar
      </motion.button>
    </motion.div>
  );
};

export default SplashScreen;
