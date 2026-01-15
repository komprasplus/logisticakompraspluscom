import { motion } from "framer-motion";
import { Truck, Package } from "lucide-react";
import logo from "@/assets/logo-kompras-plus.png";

interface RoleSelectorProps {
  onSelectRole: (role: "driver" | "customer") => void;
}

const RoleSelector = ({ onSelectRole }: RoleSelectorProps) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto flex min-h-screen flex-col items-center justify-center px-4 py-8">
        <motion.div
          className="w-full max-w-md"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="mb-8 text-center">
            <img
              src={logo}
              alt="Kompras Plus"
              className="mx-auto mb-4 h-24 w-auto"
            />
            <h1 className="text-2xl font-bold text-foreground">
              ¡Bienvenido a Kompras Plus!
            </h1>
            <p className="mt-2 text-muted-foreground">
              Selecciona cómo deseas ingresar
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-4">
            <motion.button
              onClick={() => onSelectRole("driver")}
              className="group flex w-full items-center gap-4 rounded-2xl bg-card p-6 shadow-card transition-all hover:shadow-elevated"
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-primary">
                <Truck className="h-8 w-8 text-primary-foreground" />
              </div>
              <div className="flex-1 text-left">
                <h2 className="text-lg font-bold text-foreground">
                  Soy Repartidor
                </h2>
                <p className="text-sm text-muted-foreground">
                  Ver y gestionar mis entregas asignadas
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-secondary transition-colors">
                <svg
                  className="h-5 w-5 text-muted-foreground group-hover:text-secondary-foreground transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </motion.button>

            <motion.button
              onClick={() => onSelectRole("customer")}
              className="group flex w-full items-center gap-4 rounded-2xl bg-card p-6 shadow-card transition-all hover:shadow-elevated"
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-accent">
                <Package className="h-8 w-8 text-accent-foreground" />
              </div>
              <div className="flex-1 text-left">
                <h2 className="text-lg font-bold text-foreground">
                  Soy Cliente
                </h2>
                <p className="text-sm text-muted-foreground">
                  Rastrear el estado de mi pedido
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-accent transition-colors">
                <svg
                  className="h-5 w-5 text-muted-foreground group-hover:text-accent-foreground transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </motion.button>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="mt-8 text-center text-xs text-muted-foreground"
          >
            <p>📍 Bodega: Carrera 20 # 14-30 Local 212, Bogotá</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default RoleSelector;
