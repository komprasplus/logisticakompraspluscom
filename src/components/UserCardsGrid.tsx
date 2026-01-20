import { motion } from "framer-motion";
import { User, Phone, Mail, Store, Key, UserCheck, Trash2, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
}

const UserCardsGrid = ({
  users,
  userRoles = [],
  onResetPassword,
  onConfirmEmail,
  onDeleteUser,
}: UserCardsGridProps) => {
  const getUserRole = (userId: string): string => {
    const role = userRoles.find((r) => r.user_id === userId);
    return role?.role || "usuario";
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "motorizado":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "cliente":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrador";
      case "motorizado":
        return "Motorizado";
      case "cliente":
        return "Cliente";
      default:
        return "Usuario";
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
              {/* Avatar */}
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name}
                  className="w-14 h-14 rounded-xl object-cover border-2 border-border"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                  <User className="h-7 w-7 text-primary" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-foreground truncate">{user.full_name}</h3>
                  {/* Online Status Indicator */}
                  {role === "motorizado" && (
                    <span
                      className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        user.is_online
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {user.is_online ? (
                        <>
                          <Wifi className="h-3 w-3" />
                          En línea
                        </>
                      ) : (
                        <>
                          <WifiOff className="h-3 w-3" />
                          Offline
                        </>
                      )}
                    </span>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={`mt-1 text-xs ${getRoleBadgeColor(role)}`}
                >
                  {getRoleLabel(role)}
                </Badge>
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
