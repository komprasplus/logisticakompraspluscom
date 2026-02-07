import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback } from "react";

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
}

interface UserRole {
  user_id: string;
  role: string;
}

/**
 * Centralized React Query hook for admin supporting data.
 * Replaces raw useEffect fetches for users, motorizados, client profiles, and roles.
 * Data is cached and only refetched when stale.
 */
export const useAdminSupportData = () => {
  const queryClient = useQueryClient();

  // All users
  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // User roles
  const rolesQuery = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async (): Promise<UserRole[]> => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Motorizados (active only)
  const motorizadosQuery = useQuery({
    queryKey: ["admin-motorizados"],
    queryFn: async (): Promise<Profile[]> => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "motorizado");

      if (!roles || roles.length === 0) return [];

      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", roles.map((r) => r.user_id))
        .eq("status", "activo");

      if (error) throw error;
      return profiles || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Client profiles map
  const clientProfilesQuery = useQuery({
    queryKey: ["admin-client-profiles"],
    queryFn: async (): Promise<Record<string, { store_name: string | null; full_name: string }>> => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "cliente");

      if (!roles || roles.length === 0) return {};

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, store_name, full_name")
        .in("user_id", roles.map((r) => r.user_id));

      if (!profiles) return {};

      const profileMap: Record<string, { store_name: string | null; full_name: string }> = {};
      profiles.forEach((p) => {
        profileMap[p.user_id] = { store_name: p.store_name, full_name: p.full_name };
      });
      return profileMap;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Refresh all supporting data
  const refreshAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
    queryClient.invalidateQueries({ queryKey: ["admin-motorizados"] });
    queryClient.invalidateQueries({ queryKey: ["admin-client-profiles"] });
  }, [queryClient]);

  return {
    users: usersQuery.data ?? [],
    motorizados: motorizadosQuery.data ?? [],
    clientProfiles: clientProfilesQuery.data ?? {},
    userRoles: rolesQuery.data ?? [],
    isLoading: usersQuery.isLoading || rolesQuery.isLoading || motorizadosQuery.isLoading,
    refreshAll,
  };
};

export type { Profile, UserRole };
