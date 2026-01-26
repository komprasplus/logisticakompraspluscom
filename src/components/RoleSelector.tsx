import { forwardRef } from "react";
import { motion } from "framer-motion";
import { Package, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import BrandLogo from "@/components/BrandLogo";

const RoleSelector = forwardRef<HTMLDivElement>((_, ref) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  return (
    <div ref={ref} className="min-h-screen bg-background">
      <div className="container mx-auto flex min-h-screen flex-col items-center justify-center px-4 py-8">
        <motion.div
          className="w-full max-w-md"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="mb-8 text-center">
            <div className="flex justify-center mb-6">
              <BrandLogo size="xl" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              ¡Bienvenido a Plus Envíos!
            </h1>
            <p className="mt-2 text-muted-foreground">
              Selecciona cómo deseas ingresar
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-4">
            <Link to="/auth">
              <motion.div
                className="group flex w-full items-center gap-4 rounded-2xl neu-flat p-6 transition-all hover:shadow-elevated"
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-button shadow-lg">
                  <LogIn className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h2 className="text-lg font-bold text-foreground">
                    Iniciar Sesión
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Motorizado, Cliente o Administrador
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full neu-pressed flex items-center justify-center group-hover:bg-secondary transition-colors">
                  <svg
                    className="h-5 w-5 text-muted-foreground group-hover:text-secondary-foreground transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </motion.div>
            </Link>

            <Link to="/rastreo">
              <motion.div
                className="group flex w-full items-center gap-4 rounded-2xl neu-flat p-6 transition-all hover:shadow-elevated"
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-accent shadow-lg">
                  <Package className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h2 className="text-lg font-bold text-foreground">
                    Rastrear Pedido
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Sin necesidad de cuenta
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full neu-pressed flex items-center justify-center group-hover:bg-accent transition-colors">
                  <svg
                    className="h-5 w-5 text-muted-foreground group-hover:text-accent-foreground transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </motion.div>
            </Link>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="mt-8 text-center text-xs text-muted-foreground"
          >
            <p>📍 Bodega: Carrera 20 # 14-30 Local 212, Bogotá</p>
            <p className="mt-1">📞 Soporte: 324 222 3825</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
});

RoleSelector.displayName = "RoleSelector";

export default RoleSelector;
