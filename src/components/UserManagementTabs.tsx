import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Store, Truck, User, Filter, CreditCard, Car } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import UserCardsGrid from "@/components/UserCardsGrid";

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
}

interface UserRole {
  user_id: string;
  role: string;
}

interface UserManagementTabsProps {
  users: Profile[];
  userRoles: UserRole[];
  onResetPassword: (user: Profile) => void;
  onConfirmEmail: (userId: string) => void;
  onDeleteUser: (user: Profile) => void;
  onEditStore?: (user: Profile) => void;
}

const UserManagementTabs = ({
  users,
  userRoles,
  onResetPassword,
  onConfirmEmail,
  onDeleteUser,
  onEditStore,
}: UserManagementTabsProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"tiendas" | "motorizados">("tiendas");

  // Separate users by role
  const { tiendas, motorizados } = useMemo(() => {
    const tiendaUsers: Profile[] = [];
    const motorizadoUsers: Profile[] = [];
    
    users.forEach(user => {
      const role = userRoles.find(r => r.user_id === user.user_id)?.role;
      if (role === "cliente") {
        tiendaUsers.push(user);
      } else if (role === "motorizado") {
        motorizadoUsers.push(user);
      }
    });

    return { tiendas: tiendaUsers, motorizados: motorizadoUsers };
  }, [users, userRoles]);

  // Filter users based on search query
  const filteredTiendas = useMemo(() => {
    if (!searchQuery) return tiendas;
    const query = searchQuery.toLowerCase();
    return tiendas.filter(user => 
      user.full_name?.toLowerCase().includes(query) ||
      user.store_name?.toLowerCase().includes(query) ||
      user.nit_rut?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.phone?.includes(query)
    );
  }, [tiendas, searchQuery]);

  const filteredMotorizados = useMemo(() => {
    if (!searchQuery) return motorizados;
    const query = searchQuery.toLowerCase();
    return motorizados.filter(user => 
      user.full_name?.toLowerCase().includes(query) ||
      user.vehicle_plate?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.phone?.includes(query)
    );
  }, [motorizados, searchQuery]);

  // Get filtered roles for the current view
  const getFilteredRoles = (filteredUsers: Profile[]) => {
    const userIds = new Set(filteredUsers.map(u => u.user_id));
    return userRoles.filter(r => userIds.has(r.user_id));
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={activeTab === "tiendas" 
            ? "Buscar por nombre, tienda, NIT o teléfono..." 
            : "Buscar por nombre, placa o teléfono..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "tiendas" | "motorizados")} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="tiendas" className="gap-2">
            <Store className="h-4 w-4" />
            <span>Tiendas</span>
            <span className="ml-1 text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded-full">
              {tiendas.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="motorizados" className="gap-2">
            <Truck className="h-4 w-4" />
            <span>Motorizados</span>
            <span className="ml-1 text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded-full">
              {motorizados.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tiendas" className="mt-0">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Quick filter chips */}
            {searchQuery && (
              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span>
                  {filteredTiendas.length} de {tiendas.length} tiendas
                </span>
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="text-primary hover:underline"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            )}

            <UserCardsGrid
              users={filteredTiendas}
              userRoles={getFilteredRoles(filteredTiendas)}
              onResetPassword={onResetPassword}
              onConfirmEmail={onConfirmEmail}
              onDeleteUser={onDeleteUser}
              onEditStore={onEditStore}
            />

            {filteredTiendas.length === 0 && searchQuery && (
              <div className="text-center py-8 text-muted-foreground">
                <Store className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No se encontraron tiendas para "{searchQuery}"</p>
              </div>
            )}
          </motion.div>
        </TabsContent>

        <TabsContent value="motorizados" className="mt-0">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Quick filter chips */}
            {searchQuery && (
              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span>
                  {filteredMotorizados.length} de {motorizados.length} motorizados
                </span>
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="text-primary hover:underline"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            )}

            <UserCardsGrid
              users={filteredMotorizados}
              userRoles={getFilteredRoles(filteredMotorizados)}
              onResetPassword={onResetPassword}
              onConfirmEmail={onConfirmEmail}
              onDeleteUser={onDeleteUser}
            />

            {filteredMotorizados.length === 0 && searchQuery && (
              <div className="text-center py-8 text-muted-foreground">
                <Truck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No se encontraron motorizados para "{searchQuery}"</p>
              </div>
            )}
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserManagementTabs;
