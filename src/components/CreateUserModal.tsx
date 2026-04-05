import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, UserPlus, Mail, Lock, User, Shield, Store, Eye, EyeOff, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: () => void;
}

type AppRole = "admin" | "motorizado" | "cliente" | "despachador" | "coordinador_rutas";

interface Organizacion {
  id: string;
  nombre: string;
}

const DEFAULT_ORG_ID = "a0000000-0000-0000-0000-000000000001";

const CreateUserModal = ({ isOpen, onClose, onUserCreated }: CreateUserModalProps) => {
  const { role: currentRole, profile } = useAuth();
  const isSuperAdmin = currentRole === "super_admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AppRole>("motorizado");
  const [storeName, setStoreName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Org selector state (super_admin only)
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState(DEFAULT_ORG_ID);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  // Load orgs for super_admin
  useEffect(() => {
    if (!isOpen || !isSuperAdmin) return;
    setLoadingOrgs(true);
    supabase
      .from("organizaciones")
      .select("id, nombre")
      .order("nombre")
      .then(({ data }) => {
        setOrgs(data || []);
        if (data && data.length > 0) {
          const defaultOrg = data.find(o => o.id === DEFAULT_ORG_ID);
          setSelectedOrgId(defaultOrg ? DEFAULT_ORG_ID : data[0].id);
        }
        setLoadingOrgs(false);
      });
  }, [isOpen, isSuperAdmin]);

  // Determine which org_id to use
  const resolvedOrgId = isSuperAdmin
    ? selectedOrgId
    : profile?.organizacion_id || DEFAULT_ORG_ID;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !fullName) {
      toast.error("Por favor completa todos los campos requeridos");
      return;
    }

    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (role === "cliente" && !storeName.trim()) {
      toast.error("El nombre de la tienda es obligatorio para clientes");
      return;
    }

    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        toast.error("No hay sesión activa");
        setLoading(false);
        return;
      }

      const response = await fetch(
        `https://hhjygradtikonvfzarrn.supabase.co/functions/v1/create-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            email,
            password,
            fullName,
            phone,
            role,
            storeName: role === "cliente" ? storeName.trim() : null,
            organizacionId: resolvedOrgId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (result.error?.includes("RLS") || result.error?.includes("policy")) {
          toast.error(`Error de permisos (RLS): ${result.error}`);
        } else {
          throw new Error(result.error || "Error al crear el usuario");
        }
        return;
      }

      toast.success(`Usuario ${fullName} creado exitosamente como ${role}`);
      onUserCreated();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Error al crear el usuario");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setPhone("");
    setRole("motorizado");
    setStoreName("");
    setSelectedOrgId(DEFAULT_ORG_ID);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Crear Usuario</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Organization selector - super_admin only */}
              {isSuperAdmin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                >
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Asignar a Organización *
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <select
                      value={selectedOrgId}
                      onChange={(e) => setSelectedOrgId(e.target.value)}
                      disabled={loadingOrgs}
                      className="w-full appearance-none rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {orgs.map(org => (
                        <option key={org.id} value={org.id}>{org.nombre}</option>
                      ))}
                    </select>
                  </div>
                </motion.div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Nombre completo *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Juan Pérez"
                    className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Correo electrónico *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@email.com"
                    className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Contraseña *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Teléfono (opcional)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="300 123 4567"
                  className="w-full rounded-lg border border-border bg-background py-2.5 px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Rol *
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as AppRole)}
                    className="w-full appearance-none rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="motorizado">Motorizado</option>
                    <option value="cliente">Cliente (Tienda)</option>
                    <option value="despachador">Despachador</option>
                    <option value="coordinador_rutas">Coordinador de Rutas</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>

              {/* Store Name Field - Only for Clients */}
              {role === "cliente" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Nombre de la Tienda *
                  </label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Mi Tienda Online"
                      className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      required={role === "cliente"}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Este nombre aparecerá como remitente en las guías
                  </p>
                </motion.div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Crear Usuario
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CreateUserModal;
