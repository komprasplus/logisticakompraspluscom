import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { lazy, Suspense, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

// Eager-load lightweight pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

// Lazy-load heavy dashboard pages with retry for "Failed to fetch dynamically imported module"
function lazyRetry(loader: () => Promise<{ default: React.ComponentType<any> }>) {
  return lazy(() =>
    loader().catch(() => {
      // Force reload on chunk load failure (deploy mismatch)
      window.location.reload();
      return loader();
    })
  );
}

const AdminDashboard = lazyRetry(() => import("./pages/AdminDashboard"));
const MotorizadoDashboard = lazyRetry(() => import("./pages/MotorizadoDashboard"));
const ClienteDashboard = lazyRetry(() => import("./pages/ClienteDashboard"));
const DespachadorDashboard = lazyRetry(() => import("./pages/DespachadorDashboard"));
const CustomerTracking = lazyRetry(() => import("./pages/CustomerTracking"));
const PublicTracking = lazyRetry(() => import("./pages/PublicTracking"));
const RecepcionFlex = lazyRetry(() => import("./pages/RecepcionFlex"));
const SuperAdminMaster = lazyRetry(() => import("./pages/SuperAdminMaster"));
const AdminControlTower = lazyRetry(() => import("./pages/AdminControlTower"));

// Shared loading fallback
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// Global QueryClient with aggressive caching to prevent Supabase CPU saturation
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds - data considered fresh
      gcTime: 5 * 60 * 1000, // 5 minutes - cache retained after unmount
      refetchOnWindowFocus: false, // Prevent refetch loops on mobile tab switching
      refetchOnReconnect: false, // Prevent burst on reconnect
      retry: 1, // Only 1 retry to avoid hammering DB
      retryDelay: 1000,
    },
  },
});

// Cache invalidation on auth state change — prevents stale data on desktop after login/refresh
const AuthCacheSync = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const prevUserRef = useRef<string | null>(null);

  useEffect(() => {
    const currentId = user?.id ?? null;
    const prevId = prevUserRef.current;

    // User just signed in (was null, now has id) → blow away stale caches
    if (currentId && currentId !== prevId) {
      queryClient.invalidateQueries();
    }

    // User signed out → clear all cached data
    if (!currentId && prevId) {
      queryClient.clear();
    }

    prevUserRef.current = currentId;
  }, [user?.id, queryClient]);

  return null;
};

// Connection error interceptor — clears corrupted session on desktop
const ConnectionErrorGuard = () => {
  useEffect(() => {
    const handleAuthError = (event: Event) => {
      const detail = (event as CustomEvent)?.detail;
      if (detail?.status === 401 || detail?.status === 403) {
        console.warn("[Auth] Session rejected, clearing and redirecting...");
        const storageKey = "sb-hhjygradtikonvfzarrn-auth-token";
        localStorage.removeItem(storageKey);
        window.location.href = "/auth";
      }
    };
    window.addEventListener("supabase-auth-error", handleAuthError);
    return () => window.removeEventListener("supabase-auth-error", handleAuthError);
  }, []);

  return null;
};

// Protected route component
const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Role is still loading from background fetch — show loader instead of blocking/redirecting
  if (!role) {
    return <PageLoader />;
  }

  if (!allowedRoles.includes(role)) {
    if (role === "admin") return <Navigate to="/admin" replace />;
    if (role === "motorizado") return <Navigate to="/motorizado" replace />;
    if (role === "cliente") return <Navigate to="/cliente" replace />;
    if (role === "despachador") return <Navigate to="/despachador" replace />;
    if (role === "super_admin") return <Navigate to="/super-admin-master" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/rastreo" element={<Suspense fallback={<PageLoader />}><CustomerTracking /></Suspense>} />
      <Route path="/rastreo/:id_guia" element={<Suspense fallback={<PageLoader />}><PublicTracking /></Suspense>} />
      <Route path="/tracking/:id_guia" element={<Suspense fallback={<PageLoader />}><PublicTracking /></Suspense>} />
      
      {/* Protected Routes - wrapped in Suspense for lazy loading */}
      <Route
        path="/admin"
        element={
        <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
            <Suspense fallback={<PageLoader />}>
              <AdminDashboard />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/control-tower"
        element={
          <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
            <Suspense fallback={<PageLoader />}>
              <AdminControlTower />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/motorizado"
        element={
          <ProtectedRoute allowedRoles={["motorizado"]}>
            <Suspense fallback={<PageLoader />}>
              <MotorizadoDashboard />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/cliente"
        element={
          <ProtectedRoute allowedRoles={["cliente"]}>
            <Suspense fallback={<PageLoader />}>
              <ClienteDashboard />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/despachador"
        element={
          <ProtectedRoute allowedRoles={["despachador"]}>
            <Suspense fallback={<PageLoader />}>
              <DespachadorDashboard />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/recepcion-flex"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <Suspense fallback={<PageLoader />}>
              <RecepcionFlex />
            </Suspense>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/super-admin-master"
        element={
          <ProtectedRoute allowedRoles={["super_admin"]}>
            <Suspense fallback={<PageLoader />}>
              <SuperAdminMaster />
            </Suspense>
          </ProtectedRoute>
        }
      />
      
      {/* Legacy route redirect */}
      <Route path="/repartidor" element={<Navigate to="/motorizado" replace />} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ThemeProvider>
          <AuthCacheSync />
          <ConnectionErrorGuard />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
