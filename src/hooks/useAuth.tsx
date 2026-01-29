import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "motorizado" | "cliente" | "despachador";

interface ProfileData {
  full_name: string;
  phone: string | null;
  email: string | null;
  avatar_url?: string | null;
  vehicle_plate?: string | null;
  is_online?: boolean;
  store_name?: string | null;
  logo_url?: string | null;
  nit_rut?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: ProfileData | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // Emergency: prevent double-fetch storms (onAuthStateChange + getSession can both fire)
  const fetchInFlightRef = useRef(false);
  const lastFetchRef = useRef<{ userId: string; at: number } | null>(null);
  // Prevent role/profile re-fetch on TOKEN_REFRESHED events (happens frequently)
  const currentUserIdRef = useRef<string | null>(null);

  const fetchUserData = useCallback(async (userId: string) => {
    // De-dupe repeated calls for the same user within a short window
    const last = lastFetchRef.current;
    if (fetchInFlightRef.current) return;
    if (last?.userId === userId && Date.now() - last.at < 2000) return;

    fetchInFlightRef.current = true;
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, phone, email, avatar_url, vehicle_plate, is_online, store_name, logo_url, nit_rut")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
      }

      // Fetch role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (roleData) {
        setRole(roleData.role as AppRole);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      lastFetchRef.current = { userId, at: Date.now() };
      fetchInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    setLoading(true);

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (!session?.user) {
          currentUserIdRef.current = null;
          setRole(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        const userId = session.user.id;
        const userChanged = currentUserIdRef.current !== userId;
        if (userChanged) {
          currentUserIdRef.current = userId;
          // Clear stale data immediately; new fetch will repopulate
          setRole(null);
          setProfile(null);
        }

        // CRITICAL: Avoid hitting DB on TOKEN_REFRESHED (causes steady CPU usage).
        // Only fetch role/profile when:
        // - User just signed in
        // - User changed
        // - User explicitly updated
        if (event === "SIGNED_IN" || event === "USER_UPDATED" || userChanged) {
          // Defer profile/role fetch with setTimeout to prevent deadlock
          setTimeout(() => {
            void fetchUserData(userId);
          }, 0);
        }
      }
    );

    // THEN check for existing session (guarded: no unhandled promise rejections)
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const session = data.session;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          currentUserIdRef.current = session.user.id;
          await fetchUserData(session.user.id);
        } else {
          currentUserIdRef.current = null;
          setRole(null);
          setProfile(null);
        }
      } catch (error) {
        console.error("Error reading auth session:", error);
        // Fail open: allow the UI to proceed to /auth instead of hanging forever
      } finally {
        setLoading(false);
      }
    })();

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchUserData(user.id);
    }
  }, [user?.id, fetchUserData]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    // Set offline before signing out
    if (user?.id) {
      await supabase
        .from("profiles")
        .update({ is_online: false })
        .eq("user_id", user.id);
    }
    await supabase.auth.signOut();
    setRole(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, role, profile, loading, signIn, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
