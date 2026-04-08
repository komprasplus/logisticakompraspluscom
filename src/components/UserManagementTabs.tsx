import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Store, Truck, User, Filter, Shield, Radio, MapPin, Building2, X, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import UserCardsGrid from "@/components/UserCardsGrid";
import BulkUserUploadModal from "@/components/admin/BulkUserUploadModal";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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
  nit_rut?: string | null;
  vehicle_plate?: string | null;
  fulfillment_rate?: number | null;
  organizacion_id?: string | null;
}

interface UserRole {
  user_id: string;
  role: string;
}

interface Organizacion {
  id: string;
  nombre: string;
}

interface UserManagementTabsProps {
  users: Profile[];
  userRoles: UserRole[];
  onResetPassword: (user: Profile) => void;
  onConfirmEmail: (userId: string) => void;
  onDeleteUser: (user: Profile) => void;
  onEditStore?: (user: Profile) => void;
  onRoleChanged?: () => void;
}

const ROLE_OPTIONS = [
  { value: "all", label: "Todos los roles", icon: User },
  { value: "admin", label: "Admin", icon: Shield },
  { value: "super_admin", label: "Super Admin", icon: Shield },
  { value: "cliente", label: "Tienda", icon: Store },
  { value: "motorizado", label: "Motorizado", icon: Truck },
  { value: "despachador", label: "Despachador", icon: Radio },
  { value: "aliado_logistico", label: "Aliado Logístico", icon: MapPin },
];

const getRoleLabel = (role: string) => {
  const found = ROLE_OPTIONS.find(r => r.value === role);
  return found?.label || role;
};

const UserManagementTabs = ({
  users,
  userRoles,
  onResetPassword,
  onConfirmEmail,
  onDeleteUser,
  onEditStore,
  onRoleChanged,
}: UserManagementTabsProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");
  const [organizaciones, setOrganizaciones] = useState<Organizacion[]>([]);

  const { role: currentUserRole, profile: authProfile } = useAuth();
  const isSuperAdmin = currentUserRole === "super_admin";

  // Fetch organizations for super admin
  useEffect(() => {
    if (!isSuperAdmin) return;
    const fetchOrgs = async () => {
      const { data } = await supabase.from("organizaciones").select("id, nombre").order("nombre");
      if (data) setOrganizaciones(data);
    };
    fetchOrgs();
  }, [isSuperAdmin]);

  // Build org lookup map
  const orgMap = useMemo(() => {
    const map: Record<string, string> = {};
    organizaciones.forEach(o => { map[o.id] = o.nombre; });
    return map;
  }, [organizaciones]);

  // Create role lookup
  const roleMap = useMemo(() => {
    const map: Record<string, string> = {};
    userRoles.forEach(r => { map[r.user_id] = r.role; });
    return map;
  }, [userRoles]);

  // Filter users
  const filteredUsers = useMemo(() => {
    let result = users;

    // Role filter
    if (roleFilter !== "all") {
      const usersWithRole = new Set(
        userRoles.filter(r => r.role === roleFilter).map(r => r.user_id)
      );
      result = result.filter(u => usersWithRole.has(u.user_id));
    }

    // Org filter (super admin only)
    if (isSuperAdmin && orgFilter !== "all") {
      result = result.filter(u => u.organizacion_id === orgFilter);
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u =>
        u.full_name?.toLowerCase().includes(q) ||
        u.store_name?.toLowerCase().includes(q) ||
        u.nit_rut?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.includes(q) ||
        u.vehicle_plate?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [users, userRoles, roleFilter, orgFilter, searchQuery, isSuperAdmin]);

  const filteredRoles = useMemo(() => {
    const ids = new Set(filteredUsers.map(u => u.user_id));
    return userRoles.filter(r => ids.has(r.user_id));
  }, [filteredUsers, userRoles]);

  // Count users per role
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    userRoles.forEach(r => {
      counts[r.role] = (counts[r.role] || 0) + 1;
    });
    return counts;
  }, [userRoles]);

  const hasActiveFilters = roleFilter !== "all" || orgFilter !== "all" || searchQuery !== "";

  const clearFilters = () => {
    setRoleFilter("all");
    setOrgFilter("all");
    setSearchQuery("");
  };

  return (
    <div className="space-y-4">
      {/* Role count chips */}
      <div className="flex flex-wrap gap-2">
        {ROLE_OPTIONS.filter(r => r.value === "all" || (roleCounts[r.value] || 0) > 0).map(opt => {
          const count = opt.value === "all" ? users.length : (roleCounts[opt.value] || 0);
          const isActive = roleFilter === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setRoleFilter(opt.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              <opt.icon className="h-3 w-3" />
              {opt.label}
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                isActive ? "bg-primary-foreground/20" : "bg-muted"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search and Org Filter row */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por nombre, tienda, NIT, placa o teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {isSuperAdmin && (
          <Select value={orgFilter} onValueChange={setOrgFilter}>
            <SelectTrigger className="w-[220px]">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Organización" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las organizaciones</SelectItem>
              {organizaciones.map(org => (
                <SelectItem key={org.id} value={org.id}>{org.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
            <X className="h-4 w-4" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Results info */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>{filteredUsers.length} de {users.length} usuarios</span>
          {roleFilter !== "all" && (
            <Badge variant="secondary" className="text-xs">{getRoleLabel(roleFilter)}</Badge>
          )}
          {orgFilter !== "all" && (
            <Badge variant="secondary" className="text-xs">{orgMap[orgFilter] || "Org"}</Badge>
          )}
        </div>
      )}

      {/* Users Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <UserCardsGrid
          users={filteredUsers}
          userRoles={filteredRoles}
          onResetPassword={onResetPassword}
          onConfirmEmail={onConfirmEmail}
          onDeleteUser={onDeleteUser}
          onEditStore={onEditStore}
          onRoleChanged={onRoleChanged}
          canEditRoles={isSuperAdmin}
          showOrganization={isSuperAdmin}
          orgMap={orgMap}
        />

        {filteredUsers.length === 0 && hasActiveFilters && (
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No se encontraron usuarios con los filtros aplicados</p>
            <Button variant="link" onClick={clearFilters} className="mt-2">
              Limpiar filtros
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default UserManagementTabs;
