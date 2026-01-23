import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Loader2, Mail, Lock, AlertCircle, Truck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { z } from "zod";
import ForgotPasswordModal from "@/components/ForgotPasswordModal";

const loginSchema = z.object({
  email: z.string().min(3, "Email requerido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { signIn, user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user && role) {
      redirectToPanel(role);
    }
  }, [user, role, authLoading, navigate]);

  const redirectToPanel = (userRole: string) => {
    switch (userRole) {
      case "admin":
        navigate("/admin");
        break;
      case "motorizado":
        navigate("/motorizado");
        break;
      case "cliente":
        navigate("/cliente");
        break;
      default:
        navigate("/");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        const msg = signInError.message || "";
        if (
          msg.includes("Invalid login credentials") ||
          msg.toLowerCase().includes("email not confirmed") ||
          msg.toLowerCase().includes("not confirmed")
        ) {
          setError("Credenciales incorrectas. Verifica tu email y contraseña.");
        } else {
          setError("No se pudo iniciar sesión. Verifica tus credenciales e intenta de nuevo.");
        }
      }
    } catch (err) {
      setError("Error al iniciar sesión. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="neu-flat p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Neumorphic Logo Container */}
        <motion.div
          className="text-center mb-10"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {/* Neumorphic Brand Logo */}
          <div className="neu-flat p-8 mx-auto w-fit mb-6">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-button flex items-center justify-center shadow-lg">
                <Truck className="h-8 w-8 text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-3xl font-black tracking-tight">
                  <span className="text-gradient-brand">Plus</span>
                  <span className="text-foreground"> Envíos</span>
                </h1>
                <p className="text-xs text-muted-foreground font-medium">Sistema de Logística</p>
              </div>
            </div>
          </div>
          
          <h2 className="text-xl font-bold text-foreground">Iniciar Sesión</h2>
          <p className="text-muted-foreground text-sm mt-2">
            Ingresa tus credenciales para acceder
          </p>
        </motion.div>

        {/* Neumorphic Form Card */}
        <motion.div
          className="neu-flat p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div
                className="flex items-start gap-3 p-4 rounded-2xl neu-pressed"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive font-medium">{error}</p>
              </motion.div>
            )}

            {/* Email Input - Neumorphic Inset */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground pl-1">Email</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-gradient-button flex items-center justify-center">
                  <Mail className="h-5 w-5 text-white" />
                </div>
                <input
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@dominio.com"
                  className="w-full neu-pressed py-4 pl-16 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  required
                />
              </div>
            </div>

            {/* Password Input - Neumorphic Inset */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground pl-1">Contraseña</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-gradient-button flex items-center justify-center">
                  <Lock className="h-5 w-5 text-white" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full neu-pressed py-4 pl-16 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-primary font-semibold hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {/* Neumorphic Submit Button with Gradient */}
            <button
              type="submit"
              disabled={loading}
              className="w-full neu-button py-4 font-bold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Ingresando...
                </>
              ) : (
                "Ingresar"
              )}
            </button>
          </form>
        </motion.div>

        {/* Guest tracking link */}
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-sm text-muted-foreground mb-2">
            ¿Solo quieres rastrear tu pedido?
          </p>
          <a
            href="/rastreo"
            className="inline-block px-6 py-2 neu-flat text-primary font-semibold hover:shadow-elevated transition-all"
          >
            Rastrear sin iniciar sesión
          </a>
        </motion.div>

        {/* Contact info */}
        <motion.p
          className="mt-8 text-center text-xs text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          ¿Necesitas ayuda? Contacta al administrador
          <br />
          📞 324 222 3825
        </motion.p>
      </motion.div>

      <ForgotPasswordModal 
        isOpen={showForgotPassword} 
        onClose={() => setShowForgotPassword(false)} 
      />
    </div>
  );
};

export default Auth;