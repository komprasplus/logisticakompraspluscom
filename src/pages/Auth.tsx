import { useState, useEffect, forwardRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Loader2, Mail, Lock, AlertCircle, Truck, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import ForgotPasswordModal from "@/components/ForgotPasswordModal";
import { toast } from "sonner";
const loginSchema = z.object({
  email: z.string().min(3, "Email requerido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

const Auth = forwardRef<HTMLDivElement>((_, ref) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showRoleFallback, setShowRoleFallback] = useState(false);
  const { signIn, user, role, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user && role) {
      redirectToPanel(role);
    }
  }, [user, role, authLoading, navigate]);

  // Emergency: if session exists but role fetch fails/gets stuck (e.g., network "Failed to fetch"),
  // allow the user to continue manually instead of being locked out on /auth.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setShowRoleFallback(false);
      return;
    }
    if (role) {
      setShowRoleFallback(false);
      return;
    }

    const t = window.setTimeout(() => setShowRoleFallback(true), 1500);
    return () => window.clearTimeout(t);
  }, [authLoading, user, role]);

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
      case "despachador":
        navigate("/despachador");
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
        
        // Handle specific error types with user-friendly messages
        if (msg.includes("Failed to fetch") || msg.includes("conexión") || msg.includes("network")) {
          setError("Error de conexión. Verifica tu red e intenta de nuevo.");
        } else if (
          msg.includes("Invalid login credentials") ||
          msg.toLowerCase().includes("email not confirmed") ||
          msg.toLowerCase().includes("not confirmed")
        ) {
          setError("Credenciales incorrectas. Verifica tu email y contraseña.");
        } else if (msg.includes("Too many requests")) {
          setError("Demasiados intentos. Espera un momento e intenta de nuevo.");
        } else {
          setError("No se pudo iniciar sesión. Verifica tus credenciales e intenta de nuevo.");
        }
      } else {
        // Best-effort: trigger profile/role refresh after sign-in.
        // (If network is failing, fallback UI below will allow manual entry.)
        setTimeout(() => {
          void refreshProfile();
        }, 100);
      }
    } catch (err) {
      console.error("[Auth] Login error:", err);
      setError("Error al conectar con el servidor. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth`,
        },
      });
      if (error) {
        setError("Error al conectar con Google. Intenta de nuevo.");
        console.error("[Auth] Google sign-in error:", error);
      }
    } catch (err) {
      console.error("[Auth] Google sign-in error:", err);
      setError("Error al conectar con Google.");
    } finally {
      setGoogleLoading(false);
    }
  };

  // Show form immediately, overlay loading state only briefly
  // Removed blocking spinner to improve perceived performance

  return (
    <div ref={ref} className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
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

        {/* Emergency: session exists but role is not available */}
        {user && !role && showRoleFallback ? (
          <motion.div
            className="neu-flat p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="space-y-4">
              <div className="neu-pressed p-4 rounded-2xl">
                <p className="text-sm text-foreground font-semibold">Sesión iniciada, pero no pudimos cargar permisos.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Esto suele pasar por fallas temporales de red ("Failed to fetch"). Puedes continuar manualmente.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/admin")}
                  className="neu-button py-3 font-bold text-white"
                >
                  Entrar Admin
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/despachador")}
                  className="neu-button py-3 font-bold text-white"
                >
                  Entrar Despachos
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/cliente")}
                  className="neu-button py-3 font-bold text-white"
                >
                  Entrar Tienda
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/motorizado")}
                  className="neu-button py-3 font-bold text-white"
                >
                  Entrar Motorizado
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => void refreshProfile()}
                  className="flex-1 neu-flat py-3 font-semibold text-primary"
                >
                  Reintentar permisos
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="flex-1 neu-flat py-3 font-semibold text-primary"
                >
                  Recargar
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          /* Neumorphic Form Card */
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
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full neu-pressed py-4 pl-16 pr-12 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
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

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-medium">o continúa con</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full neu-flat py-3.5 font-semibold text-foreground transition-all flex items-center justify-center gap-3 hover:shadow-elevated disabled:opacity-50"
            >
              {googleLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              {googleLoading ? "Conectando..." : "Continuar con Google"}
            </button>
            </form>
          </motion.div>
        )}

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
});

Auth.displayName = "Auth";

export default Auth;