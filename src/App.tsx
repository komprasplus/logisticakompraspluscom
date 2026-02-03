import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Eager-load lightweight pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

// Lazy-load heavy dashboard pages for faster initial load
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const MotorizadoDashboard = lazy(() => import("./pages/MotorizadoDashboard"));
const ClienteDashboard = lazy(() => import("./pages/ClienteDashboard"));
const DespachadorDashboard = lazy(() => import("./pages/DespachadorDashboard"));
const CustomerTracking = lazy(() => import("./pages/CustomerTracking"));
const PublicTracking = lazy(() => import("./pages/PublicTracking"));

// Shared loading fallback
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient();

// Protected route component
const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (role && !allowedRoles.includes(role)) {
    // Redirect to appropriate dashboard based on role
    if (role === "admin") return <Navigate to="/admin" replace />;
    if (role === "motorizado") return <Navigate to="/motorizado" replace />;
    if (role === "cliente") return <Navigate to="/cliente" replace />;
    if (role === "despachador") return <Navigate to="/despachador" replace />;
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
      
      {/* Protected Routes - wrapped in Suspense for lazy loading */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <Suspense fallback={<PageLoader />}>
              <AdminDashboard />
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
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
