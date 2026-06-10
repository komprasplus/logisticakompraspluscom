import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Mail, Lock, User, Phone, MapPin, Store, Truck, Package, AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { toast } from "sonner";

const ROOT_ORG_ID = "a0000000-0000-0000-0000-000000000001";

const COUNTRY_CODES = [
  { code: "+57", flag: "🇨🇴", label: "Colombia" },
  { code: "+52", flag: "🇲🇽", label: "México" },
  { code: "+51", flag: "🇵🇪", label: "Perú" },
  { code: "+593", flag: "🇪🇨", label: "Ecuador" },
  { code: "+1", flag: "🇺🇸", label: "USA" },
  { code: "+34", flag: "🇪🇸", label: "España" },
];

const schema = z.object({
  firstName: z.string().trim().min(2, "Nombre requerido").max(80),
  lastName: z.string().trim().min(2, "Apellido requerido").max(80),
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
  confirmPassword: z.string(),
  countryCode: z.string(),
  phone: z.string().trim().min(7, "Teléfono inválido").max(20),
  direccion: z.string().trim().min(5, "Dirección requerida").max(200),
  storeName: z.string().trim().min(2, "Nombre de tienda requerido").max(120),
  tipoCuenta: z.enum(["dropshipper", "proveedor"]),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

const Registro = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    countryCode: "+57",
    phone: "",
    direccion: "",
    storeName: "",
    tipoCuenta: "dropshipper" as "dropshipper" | "proveedor",
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validation = schema.safeParse(form);
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`;
      const fullPhone = `${form.countryCode}${form.phone.replace(/\D/g, "")}`;

      // 1. Sign up via Supabase Auth (email confirmation required)
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: {
            full_name: fullName,
            phone: fullPhone,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes("already")) {
          setError("Ya existe una cuenta con ese email. Intenta iniciar sesión.");
        } else {
          setError(signUpError.message);
        }
        return;
      }

      if (!data.user) {
        setError("No se pudo crear la cuenta. Intenta de nuevo.");
        return;
      }

      // 2. Upsert profile with the extra fields (the handle_new_user trigger creates the base row)
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: data.user.id,
            full_name: fullName,
            email: form.email.trim().toLowerCase(),
            phone: fullPhone,
            store_name: form.storeName.trim(),
            direccion: form.direccion.trim(),
            tipo_cuenta: form.tipoCuenta,
            organizacion_id: ROOT_ORG_ID,
            status: "activo",
          },
          { onConflict: "user_id" }
        );

      if (profileError) {
        console.error("[Registro] Profile upsert error:", profileError);
      }

      // 3. Self-assign 'cliente' role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: data.user.id,
          role: "cliente",
          organizacion_id: ROOT_ORG_ID,
        });

      if (roleError && !roleError.message.includes("duplicate")) {
        console.error("[Registro] Role insert error:", roleError);
      }

      // 4. If session exists (email confirmation disabled), redirect; otherwise show "verify email" screen
      if (data.session) {
        toast.success("¡Cuenta creada! Bienvenido.");
        navigate("/cliente");
      } else {
        setDone(true);
      }
    } catch (err) {
      console.error("[Registro] Unexpected error:", err);
      setError("Error inesperado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md neu-flat p-8 text-center space-y-4"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-button flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">¡Revisa tu correo!</h1>
          <p className="text-muted-foreground">
            Te enviamos un enlace de verificación a <strong>{form.email}</strong>. Haz clic para activar tu cuenta y luego inicia sesión.
          </p>
          <button
            onClick={() => navigate("/auth")}
            className="w-full neu-button py-3 font-bold text-white mt-4"
          >
            Ir a Iniciar Sesión
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8 sm:py-10">
      <motion.div
        className="w-full max-w-2xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="neu-flat p-4 sm:p-6 mx-auto w-fit mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-button flex items-center justify-center">
                <Truck className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                <span className="text-gradient-brand">Plus</span>
                <span className="text-foreground"> Envíos</span>
              </h1>
            </div>
          </div>
          <h2 className="text-lg sm:text-xl font-bold">Crear cuenta</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Únete al marketplace y empieza a operar hoy
          </p>
        </div>

        <motion.form
          onSubmit={handleSubmit}
          className="neu-flat p-5 sm:p-8 space-y-5 sm:space-y-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {/* Role selector */}
          <div className="space-y-3">
            <label className="text-sm font-semibold pl-1">Tipo de cuenta</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { value: "dropshipper", icon: Truck, title: "Dropshipper", desc: "Revendo productos y gestiono envíos" },
                { value: "proveedor", icon: Package, title: "Proveedor", desc: "Publico catálogo para que otros distribuyan" },
              ].map(({ value, icon: Icon, title, desc }) => {
                const selected = form.tipoCuenta === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set("tipoCuenta", value as any)}
                    className={`p-4 rounded-2xl text-left transition-all ${
                      selected
                        ? "neu-pressed ring-2 ring-primary"
                        : "neu-flat hover:shadow-elevated"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        selected ? "bg-gradient-button" : "bg-muted"
                      }`}>
                        <Icon className={`h-5 w-5 ${selected ? "text-white" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldInput icon={User} label="Nombre" value={form.firstName} onChange={(v) => set("firstName", v)} placeholder="Juan" required />
            <FieldInput icon={User} label="Apellido" value={form.lastName} onChange={(v) => set("lastName", v)} placeholder="Pérez" required />
          </div>

          {/* Email */}
          <FieldInput icon={Mail} type="email" label="Correo electrónico" value={form.email} onChange={(v) => set("email", v)} placeholder="correo@dominio.com" required />

          {/* Passwords */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold pl-1">Contraseña</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-gradient-button flex items-center justify-center">
                  <Lock className="h-4 w-4 text-white" />
                </div>
                <input
                  type={showPwd ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder="Mín. 8 caracteres"
                  className="w-full neu-pressed py-3 pl-14 pr-10 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1}>
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold pl-1">Confirmar contraseña</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-gradient-button flex items-center justify-center">
                  <Lock className="h-4 w-4 text-white" />
                </div>
                <input
                  type={showPwd ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={(e) => set("confirmPassword", e.target.value)}
                  placeholder="Repite la contraseña"
                  className="w-full neu-pressed py-3 pl-14 pr-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
              </div>
            </div>
          </div>

          {/* Phone with country code */}
          <div className="space-y-2">
            <label className="text-sm font-semibold pl-1">WhatsApp / Celular</label>
            <div className="flex gap-2">
              <select
                value={form.countryCode}
                onChange={(e) => set("countryCode", e.target.value)}
                className="neu-pressed py-3 px-2 sm:px-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 font-medium min-w-[80px] sm:min-w-[100px]"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                ))}
              </select>
              <div className="relative flex-1">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-gradient-button flex items-center justify-center">
                  <Phone className="h-4 w-4 text-white" />
                </div>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="3001234567"
                  className="w-full neu-pressed py-3 pl-14 pr-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
              </div>
            </div>
          </div>

          {/* Store name */}
          <FieldInput icon={Store} label="Nombre de la tienda" value={form.storeName} onChange={(v) => set("storeName", v)} placeholder="Mi Tienda Online" required />

          {/* Address */}
          <FieldInput icon={MapPin} label="Dirección" value={form.direccion} onChange={(v) => set("direccion", v)} placeholder="Cra 7 # 12-34, Bogotá" required />

          {error && (
            <div className="flex items-start gap-3 p-4 rounded-2xl neu-pressed">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full neu-button py-4 min-h-[52px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 text-base"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Creando cuenta...
              </>
            ) : (
              "Crear cuenta"
            )}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link to="/auth" className="text-primary font-semibold hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </motion.form>
      </motion.div>
    </div>
  );
};

const FieldInput = ({
  icon: Icon, label, value, onChange, placeholder, type = "text", required,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) => (
  <div className="space-y-2">
    <label className="text-sm font-semibold pl-1">{label}</label>
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-gradient-button flex items-center justify-center">
        <Icon className="h-4 w-4 text-white" />
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full neu-pressed py-3 pl-14 pr-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        required={required}
      />
    </div>
  </div>
);

export default Registro;
