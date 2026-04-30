import { useState, useEffect, forwardRef } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Loader2, Mail, Lock, AlertCircle, Truck, Eye, EyeOff, ShieldCheck, Banknote, PackageCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import ForgotPasswordModal from "@/components/ForgotPasswordModal";
import { useTenantBranding } from "@/hooks/useTenantBranding";
import { Skeleton } from "@/components/ui/skeleton";
import authHero from "@/assets/auth-hero-logistics.jpg";

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
  const { signIn, signOut, user, role, loading: authLoading, roleFetchFailed, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();
  const { branding, loading: brandingLoading, isWhiteLabel } = useTenantBranding(tenantSlug);

  useEffect(() => {
    if (!authLoading && user && role) {
      redirectToPanel(role);
    }
  }, [user, role, authLoading, navigate]);

  const redirectToPanel = (userRole: string) => {
    switch (userRole) {
      case "admin":
      case "aliado_logistico":
      case "super_admin":
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
        options: { redirectTo: `${window.location.origin}/auth` },
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

  return (
    <div ref={ref} className="h-screen w-full flex bg-white overflow-hidden">
      {/* ============ COLUMNA IZQUIERDA — FORMULARIO ============ */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white overflow-y-auto">
        <div className="flex-1 flex flex-col justify-center items-center px-6 sm:px-12 lg:px-16 py-10">
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Logo */}
            <motion.div
              className="mb-10"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              {brandingLoading ? (
                <Skeleton className="h-14 w-48 rounded-xl" />
              ) : isWhiteLabel && branding.logo_url ? (
                <img src={branding.logo_url} alt={branding.nombre} className="h-14 object-contain" />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-button flex items-center justify-center shadow-md">
                    <Truck className="h-7 w-7 text-white" />
                  </div>
                  <div className="text-left">
                    <h1 className="text-2xl font-black tracking-tight">
                      <span className="text-gradient-brand">Plus</span>
                      <span className="text-foreground"> Envíos</span>
                    </h1>
                    <p className="text-[11px] text-muted-foreground font-medium">Sistema de Logística</p>
                  </div>
                </div>
              )}
            </motion.div>

            <div className="mb-8">
              <h2 className="text-3xl font-bold text-foreground tracking-tight">Bienvenido de nuevo</h2>
              <p className="text-muted-foreground text-sm mt-2">
                Ingresa tus credenciales para acceder a tu panel.
              </p>
            </div>

            {/* Post-login: syncing */}
            {user && !role && !roleFetchFailed ? (
              <motion.div
                className="rounded-2xl border border-border bg-card p-10 flex flex-col items-center justify-center text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-base font-semibold text-foreground">Sincronizando perfil…</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Estamos preparando tu espacio de trabajo.
                </p>
              </motion.div>
            ) : user && !role && roleFetchFailed ? (
              <motion.div
                className="rounded-2xl border border-border bg-card p-8"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground">Problemas de conexión</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Parece que tienes problemas de conexión a internet. No pudimos sincronizar tu perfil de forma segura.
                    </p>
                  </div>
                  <div className="flex gap-3 w-full pt-2">
                    <button
                      type="button"
                      onClick={() => void refreshProfile()}
                      className="flex-1 neu-button py-3 font-bold text-white"
                    >
                      Volver a intentar
                    </button>
                    <button
                      type="button"
                      onClick={() => void signOut()}
                      className="flex-1 rounded-xl border border-border py-3 font-semibold text-primary hover:bg-accent transition-colors"
                    >
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.form
                onSubmit={handleSubmit}
                className="space-y-5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                {error && (
                  <motion.div
                    className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive font-medium">{error}</p>
                  </motion.div>
                )}

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                      type="text"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="correo@dominio.com"
                      className="w-full h-12 rounded-xl border border-border bg-background pl-11 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-12 rounded-xl border border-border bg-background pl-11 pr-12 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end -mt-1">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-primary font-semibold hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl bg-gradient-button font-bold text-white shadow-md hover:shadow-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground font-medium">o continúa con</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                  className="w-full h-12 rounded-xl border border-border bg-background font-semibold text-foreground hover:bg-accent transition-all flex items-center justify-center gap-3 disabled:opacity-50"
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

                <div className="text-center text-sm text-muted-foreground pt-1">
                  ¿No tienes cuenta?{" "}
                  <Link to="/registro" className="text-primary font-semibold hover:underline">
                    Crear cuenta
                  </Link>
                </div>
              </motion.form>
            )}

            {/* Bottom: tracking + soporte */}
            <motion.div
              className="mt-8 pt-6 border-t border-border space-y-3 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <p className="text-sm text-muted-foreground">¿Solo quieres rastrear tu pedido?</p>
              <a
                href="/rastreo"
                className="inline-block px-5 py-2 rounded-xl border border-border text-primary font-semibold hover:bg-accent transition-all text-sm"
              >
                Rastrear sin iniciar sesión
              </a>
              {!isWhiteLabel && (
                <p className="text-xs text-muted-foreground pt-2">
                  ¿Necesitas ayuda? 📞 324 222 3825
                </p>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* ============ COLUMNA DERECHA — BRANDING (Desktop only) ============ */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-primary">
        {/* Background image */}
        <img
          src={authHero}
          alt="Logística Plus Envíos"
          className="absolute inset-0 w-full h-full object-cover"
          width={1280}
          height={1600}
        />
        {/* Color overlay */}
        <div className="absolute inset-0 bg-primary/70 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/50 to-black/60" />

        {/* Decorative blur orbs */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 w-[28rem] h-[28rem] rounded-full bg-white/5 blur-3xl" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between w-full p-12 xl:p-16 text-white">
          {/* Top badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2"
          >
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold tracking-tight text-white/90">Plus Envíos</span>
          </motion.div>

          {/* Center text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="max-w-xl"
          >
            <h2 className="text-4xl xl:text-5xl font-bold leading-tight tracking-tight text-white">
              El ecosistema logístico para escalar tus ventas.
            </h2>
            <p className="mt-5 text-lg text-white/80 leading-relaxed">
              Marketplace integrado, fulfillment y entregas de última milla en una sola plataforma.
            </p>
          </motion.div>

          {/* Bottom trust badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="grid grid-cols-3 gap-3"
          >
            {[
              { icon: ShieldCheck, label: "Entregas seguras" },
              { icon: Banknote, label: "Pago contra entrega" },
              { icon: PackageCheck, label: "Tracking en vivo" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-start gap-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-4"
              >
                <Icon className="h-5 w-5 text-white" />
                <span className="text-sm font-semibold text-white leading-tight">{label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </div>
  );
});

Auth.displayName = "Auth";

export default Auth;
