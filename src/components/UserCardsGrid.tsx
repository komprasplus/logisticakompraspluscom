import { useState } from "react";
import { motion } from "framer-motion";
import { User, Phone, Mail, Store, Key, UserCheck, Trash2, Wifi, WifiOff, Pencil, DollarSign, Building2, Shield, Truck, Radio, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  status: string;
  store_name?: string | null;
  avatar_url?: string | null;
  is_online?: boolean;
  fulfillment_rate?: number | null;
  organizacion_id?: string | null;
}

interface UserRole {
  user_id: string;
  role: string;
}

interface UserCardsGridProps {
  users: Profile[];
  userRoles?: UserRole[];
  onResetPassword: (user: Profile) => void;
  onConfirmEmail: (userId: string) => void;
  onDeleteUser: (user: Profile) => void;
  onEditStore?: (user: Profile) => void;
  onRoleChanged?: () => void;
  canEditRoles?: boolean;
  showOrganization?: boolean;
  orgMap?: Record<string, string>;
}

const UserCardsGrid = ({
  users,
  userRoles = [],
  onResetPassword,
  onConfirmEmail,
  onDeleteUser,
  onEditStore,
  onRoleChanged,
  canEditRoles = false,
  showOrganization = false,
  orgMap = {},
}: UserCardsGridProps) => {
  const [changingRoleFor, setChangingRoleFor] = useState<string | null>(null);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setChangingRoleFor(userId);
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole as any })
        .eq("user_id", userId);
      if (error) throw error;
      toast.success("Rol actualizado exitosamente");
      onRoleChanged?.();
    } catch (err: any) {
      toast.error("Error al cambiar rol: " + err.message);
    } finally {
      setChangingRoleFor(null);
    }
  };
  const getUserRole = (userId: string): string => {
    const role = userRoles.find((r) => r.user_id === userId);
    return role?.role || "usuario";
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-red-100 text-red-700 border-red-200";
      case "admin":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "motorizado":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "cliente":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "despachador":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "aliado_logistico":
        return "bg-cyan-100 text-cyan-700 border-cyan-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "super_admin":
        return "Super Admin";
      case "admin":
        return "Administrador";
      case "motorizado":
        return "Motorizado";
      case "cliente":
        return "Tienda";
      case "despachador":
        return "Despachador";
      case "aliado_logistico":
        return "Aliado Logístico";
      default:
        return "Usuario";
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "super_admin":
      case "admin":
        return Shield;
      case "motorizado":
        return Truck;
      case "cliente":
        return Store;
      case "despachador":
        return Radio;
      case "aliado_logistico":
        return MapPin;
      default:
        return User;
    }
  };

  if (users.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground bg-card rounded-xl border border-border">
        No hay usuarios registrados
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {users.map((user, index) => {
        const role = getUserRole(user.user_id);
        const RoleIcon = getRoleIcon(role);

        return (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="rounded-2xl bg-card border border-border p-5 shadow-sm hover:shadow-lg transition-all"
          >
            {/* Header with Avatar and Status */}
            <div className="flex items-start gap-4 mb-4">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name}
                  className="w-14 h-14 rounded-xl object-cover border-2 border-border"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                  <RoleIcon className="h-7 w-7 text-primary" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-foreground truncate">{user.full_name}</h3>
                  {role === "motorizado" && (
                    <span
                      className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        user.is_online
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {user.is_online ? (
                        <><Wifi className="h-3 w-3" /> En línea</>
                      ) : (
                        <><WifiOff className="h-3 w-3" /> Offline</>
                      )}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {canEditRoles && role !== "super_admin" ? (
                    <Select
                      value={role}
                      onValueChange={(val) => handleRoleChange(user.user_id, val)}
                      disabled={changingRoleFor === user.user_id}
                    >
                      <SelectTrigger className="h-7 w-auto min-w-[140px] text-xs">
                        {changingRoleFor === user.user_id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <SelectValue />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="cliente">Tienda</SelectItem>
                        <SelectItem value="motorizado">Motorizado</SelectItem>
                        <SelectItem value="despachador">Despachador</SelectItem>
                        <SelectItem value="aliado_logistico">Aliado Logístico</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge
                      variant="outline"
                      className={`text-xs ${getRoleBadgeColor(role)}`}
                    >
                      {getRoleLabel(role)}
                    </Badge>
                  )}
                  {showOrganization && user.organizacion_id && orgMap[user.organizacion_id] && (
                    <Badge variant="outline" className="text-xs bg-muted/50 gap-1">
                      <Building2 className="h-3 w-3" />
                      {orgMap[user.organizacion_id]}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-2 mb-4">
              {user.store_name && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Store className="h-4 w-4 text-primary" />
                  <span className="font-medium text-foreground">{user.store_name}</span>
                </p>
              )}
              {role === "cliente" && user.fulfillment_rate && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  <span>Fulfillment: </span>
                  <span className="font-semibold text-foreground">
                    ${(user.fulfillment_rate || 1900).toLocaleString()}
                  </span>
                </p>
              )}
              {user.phone && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {user.phone}
                </p>
              )}
              {user.email && (
                <p className="text-sm text-muted-foreground flex items-center gap-2 truncate">
                  <Mail className="h-4 w-4" />
                  {user.email}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-3 border-t border-border">
              {role === "cliente" && onEditStore && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditStore(user)}
                  className="gap-1.5"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Editar</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onResetPassword(user)}
                className="flex-1 gap-1.5"
              >
                <Key className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Credenciales</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onConfirmEmail(user.user_id)}
                className="flex-1 gap-1.5"
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Confirmar</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDeleteUser(user)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default UserCardsGrid;
