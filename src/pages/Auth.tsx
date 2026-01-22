import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Loader2, Mail, Lock, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
const logo = "/logo-oficial.png";
import { z } from "zod";
import ForgotPasswordModal from "@/components/ForgotPasswordModal";

const loginSchema = z.object({
  // No enforce email format to avoid blocking; Supabase will validate credentials server-side.
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

  // Redirect based on role when user is logged in
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

    // Validate input
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

        // Never block visually on confirmation status; show a generic auth error instead.
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Logo */}
        <motion.div
          className="text-center mb-8"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <img src={logo} alt="Plus Envíos" className="h-24 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Iniciar Sesión</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Ingresa tus credenciales para acceder
          </p>
        </motion.div>

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          className="space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {error && (
            <motion.div
              className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </motion.div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@dominio.com"
                className="w-full rounded-xl border-2 border-border bg-card py-3 pl-11 pr-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border-2 border-border bg-card py-3 pl-11 pr-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                required
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-primary hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
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
        </motion.form>

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
            className="text-primary font-semibold hover:underline"
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

      {/* Forgot Password Modal */}
      <ForgotPasswordModal 
        isOpen={showForgotPassword} 
        onClose={() => setShowForgotPassword(false)} 
      />
    </div>
  );
};

export default Auth;
