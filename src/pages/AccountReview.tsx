import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Hourglass, LogOut, ShieldCheck, XCircle } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

const AccountReview = () => {
  const { signOut, profile } = useAuth();
  const { branding } = useTheme();
  const isRejected = profile?.estado_aprobacion === "rechazado";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary/10 via-background to-secondary/10 relative overflow-hidden">
      {/* Decorative blur orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />

      <div className="relative max-w-md w-full glass-strong rounded-3xl p-8 md:p-10 border border-white/20 shadow-2xl text-center backdrop-blur-xl">
        {branding?.logo_url && (
          <img
            src={branding.logo_url}
            alt={branding.nombre}
            className="h-14 w-14 mx-auto mb-4 rounded-2xl object-contain shadow-lg"
          />
        )}

        <div
          className={`mx-auto mb-6 w-20 h-20 rounded-3xl flex items-center justify-center shadow-elevated ${
            isRejected
              ? "bg-gradient-to-br from-red-500 to-rose-600"
              : "bg-gradient-to-br from-primary to-secondary"
          }`}
        >
          {isRejected ? (
            <XCircle className="h-10 w-10 text-white" />
          ) : (
            <Hourglass className="h-10 w-10 text-white animate-pulse" />
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mb-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="text-xs uppercase tracking-widest font-bold text-primary">
            {isRejected ? "Solicitud Rechazada" : "Cuenta en Revisión"}
          </span>
        </div>

        <h1 className="text-2xl md:text-3xl font-black text-foreground mb-3">
          {isRejected ? "Tu solicitud no fue aprobada" : "¡Solicitud recibida!"}
        </h1>

        <p className="text-muted-foreground leading-relaxed mb-8">
          {isRejected
            ? "Lo sentimos, tu perfil no cumple con los requisitos actuales de nuestra red. Para más información, contacta al equipo de soporte."
            : "Nuestro equipo está revisando tu perfil para garantizar la calidad de nuestra red. Te notificaremos por correo tan pronto sea aprobado."}
        </p>

        <Button
          onClick={signOut}
          variant="outline"
          className="w-full rounded-2xl h-12 font-semibold gap-2"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>

        {profile?.email && (
          <p className="text-xs text-muted-foreground mt-4">
            Sesión: {profile.email}
          </p>
        )}
      </div>
    </div>
  );
};

export default AccountReview;
