import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X, UserPlus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface SolicitudRow {
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  tipo_cuenta: string | null;
  role?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  cliente: "Tienda / Dropshipper",
  aliado_logistico: "Aliado Logístico",
  motorizado: "Motorizado",
  despachador: "Despachador",
  admin: "Administrador",
};

const SolicitudesRegistroPanel = () => {
  const { profile } = useAuth();
  const [rows, setRows] = useState<SolicitudRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchSolicitudes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("profiles")
        .select("user_id, full_name, email, phone, created_at, tipo_cuenta")
        .eq("estado_aprobacion", "pendiente")
        .order("created_at", { ascending: false });

      if (profile?.organizacion_id) {
        query = query.eq("organizacion_id", profile.organizacion_id);
      }

      const { data: profiles, error } = await query;
      if (error) throw error;

      const ids = (profiles ?? []).map((p) => p.user_id);
      let rolesMap: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", ids);
        rolesMap = Object.fromEntries(
          (roles ?? []).map((r) => [r.user_id, r.role as string])
        );
      }

      setRows(
        (profiles ?? []).map((p) => ({
          ...p,
          role: rolesMap[p.user_id] ?? null,
        }))
      );
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSolicitudes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.organizacion_id]);

  const handleAction = async (
    userId: string,
    action: "aprobado" | "rechazado"
  ) => {
    setActing(userId);
    // Optimistic remove
    const prev = rows;
    setRows((r) => r.filter((x) => x.user_id !== userId));

    const { error } = await supabase
      .from("profiles")
      .update({ estado_aprobacion: action })
      .eq("user_id", userId);

    if (error) {
      console.error(error);
      toast.error("No se pudo actualizar el estado");
      setRows(prev);
    } else {
      toast.success(
        action === "aprobado"
          ? "Usuario aprobado correctamente"
          : "Usuario rechazado"
      );
    }
    setActing(null);
  };

  return (
    <div className="p-4">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
            <UserPlus className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black text-foreground">
              Solicitudes de Registro
            </h2>
            <p className="text-xs text-muted-foreground">
              Revisa y aprueba nuevos usuarios de la plataforma
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchSolicitudes}
          disabled={loading}
          className="rounded-xl gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refrescar
        </Button>
      </div>

      <div className="glass-strong rounded-3xl border border-white/20 overflow-hidden shadow-elevated">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No hay solicitudes pendientes</p>
            <p className="text-xs mt-1">
              Cuando se registre un nuevo usuario aparecerá aquí.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Rol solicitado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.user_id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("es-CO", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="font-semibold">{r.full_name}</TableCell>
                  <TableCell className="text-sm">{r.email ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="rounded-lg">
                      {r.role
                        ? ROLE_LABELS[r.role] ?? r.role
                        : r.tipo_cuenta ?? "Sin asignar"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAction(r.user_id, "aprobado")}
                        disabled={acting === r.user_id}
                        className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white gap-1"
                      >
                        <Check className="h-4 w-4" />
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleAction(r.user_id, "rechazado")}
                        disabled={acting === r.user_id}
                        className="rounded-xl gap-1"
                      >
                        <X className="h-4 w-4" />
                        Rechazar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default SolicitudesRegistroPanel;
