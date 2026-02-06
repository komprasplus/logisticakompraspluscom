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

/**
 * Clear corrupted session from localStorage to prevent infinite retry loops
 * This handles "Failed to fetch" errors caused by invalid refresh tokens
 */
function clearCorruptedSession(): void {
  try {
    const storageKey = "sb-hhjygradtikonvfzarrn-auth-token";
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Only clear if refresh_token is clearly corrupted (empty/whitespace)
      if (parsed?.refresh_token !== undefined && 
          (typeof parsed.refresh_token !== "string" || parsed.refresh_token.trim().length === 0)) {
        console.warn("[Auth] Detected corrupted session (empty token), clearing...");
        localStorage.removeItem(storageKey);
      }
    }
  } catch {
    // Ignore parsing errors
  }
}

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
  // Track retry attempts to prevent infinite loops
  const authErrorCountRef = useRef(0);

  const fetchUserData = useCallback(async (userId: string) => {
    // De-dupe repeated calls for the same user within 5 second window
    const last = lastFetchRef.current;
    if (fetchInFlightRef.current) return;
    if (last?.userId === userId && Date.now() - last.at < 5000) return;

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
      
      // Reset error count on success
      authErrorCountRef.current = 0;
    } catch (error) {
      console.error("Error fetching user data:", error);
      authErrorCountRef.current += 1;
      
      // If too many errors, clear potentially corrupted session
      if (authErrorCountRef.current >= 3) {
        console.warn("[Auth] Too many fetch errors, clearing session...");
        clearCorruptedSession();
      }
    } finally {
      lastFetchRef.current = { userId, at: Date.now() };
      fetchInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    
    // CRITICAL: Clear corrupted session BEFORE initializing auth
    clearCorruptedSession();

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Handle auth errors gracefully - don't let them cause infinite loops
        if (!session?.user) {
          currentUserIdRef.current = null;
          setSession(null);
          setUser(null);
          setRole(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session.user);

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
        
        // Ensure loading is set to false after processing
        setLoading(false);
      }
    );

    // THEN check for existing session (guarded: no unhandled promise rejections)
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        // Handle session fetch errors gracefully
        if (error) {
          console.warn("[Auth] Session fetch error:", error.message);
          // If it's a network/fetch error, just continue without session
          if (error.message?.includes("fetch") || error.message?.includes("network")) {
            setLoading(false);
            return;
          }
          throw error;
        }

        const session = data.session;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          currentUserIdRef.current = session.user.id;
          // CRITICAL: Deferred fetch - don't block loading state
          setTimeout(() => {
            void fetchUserData(session.user.id);
          }, 0);
        } else {
          currentUserIdRef.current = null;
          setRole(null);
          setProfile(null);
        }
      } catch (error) {
        console.error("Error reading auth session:", error);
        // Fail open: allow the UI to proceed to /auth instead of hanging forever
        clearCorruptedSession();
      } finally {
        // CRITICAL: Unblock loading immediately - role/profile will load in background
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
    // Reset error counter before new sign-in attempt
    authErrorCountRef.current = 0;
    
    // Clear any potentially corrupted session before attempting new login
    clearCorruptedSession();
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (err) {
      // Handle network errors gracefully
      console.error("[Auth] Sign in error:", err);
      return { 
        error: new Error("Error de conexión. Por favor verifica tu red e intenta de nuevo.") 
      };
    }
  };

  const signOut = async () => {
    // Set offline before signing out
    if (user?.id) {
      try {
        await supabase
          .from("profiles")
          .update({ is_online: false })
          .eq("user_id", user.id);
      } catch {
        // Ignore errors during sign-out cleanup
      }
    }
    
    try {
      await supabase.auth.signOut();
    } catch {
      // Force clear session even if signOut API fails
      clearCorruptedSession();
    }
    
    currentUserIdRef.current = null;
    setSession(null);
    setUser(null);
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
