import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Eye, Printer, Loader2, FileText, RefreshCw } from "lucide-react";

interface ManifiestoRow {
  id: string;
  numero_manifiesto: number;
  motorizado_id: string | null;
  motorizado_nombre?: string | null;
  cantidad_paquetes: number;
  estado: string;
  created_at: string;
}

interface DetalleGuia {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  municipio: string | null;
  estado: string | null;
}

const ManifiestosListView = ({ refreshKey }: { refreshKey?: number }) => {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<ManifiestoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [detalleManifiesto, setDetalleManifiesto] = useState<ManifiestoRow | null>(null);
  const [detalleGuias, setDetalleGuias] = useState<DetalleGuia[]>([]);
  const [detalleLoading, setDetalleLoading] = useState(false);

  const fetchRows = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("manifiestos_ruta")
        .select("id, numero_manifiesto, motorizado_id, cantidad_paquetes, estado, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const motoIds = Array.from(new Set((data ?? []).map((r) => r.motorizado_id).filter(Boolean))) as string[];
      let motoMap: Record<string, string> = {};
      if (motoIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", motoIds);
        motoMap = Object.fromEntries((profs ?? []).map((p) => [p.user_id, p.full_name]));
      }
      setRows(
        (data ?? []).map((r) => ({
          ...r,
          motorizado_nombre: r.motorizado_id ? motoMap[r.motorizado_id] ?? "—" : "—",
        })),
      );
    } catch (err: any) {
      toast.error(`Error al cargar manifiestos: ${err.message ?? "desconocido"}`);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows, refreshKey]);

  const openDetalle = async (m: ManifiestoRow) => {
    setDetalleManifiesto(m);
    setDetalleOpen(true);
    setDetalleLoading(true);
    setDetalleGuias([]);
    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select("id, numero_guia, cliente_nombre, direccion_entrega, municipio, estado")
        .eq("manifiesto_id", m.id)
        .order("id", { ascending: true });
      if (error) throw error;
      setDetalleGuias((data ?? []) as DetalleGuia[]);
    } catch (err: any) {
      toast.error(`Error al cargar guías: ${err.message ?? "desconocido"}`);
    } finally {
      setDetalleLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const finalizarManifiesto = async (m: ManifiestoRow) => {
    if (!confirm(`¿Marcar manifiesto MR-${m.numero_manifiesto} como finalizado?`)) return;
    try {
      const { error } = await supabase
        .from("manifiestos_ruta")
        .update({ estado: "Finalizado" })
        .eq("id", m.id);
      if (error) throw error;
      toast.success("Manifiesto finalizado");
      fetchRows();
    } catch (err: any) {
      toast.error(err.message ?? "Error al finalizar");
    }
  };

  return (
    <>
      <div className="neu-card p-4 print:hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-lg">Manifiestos de Ruta</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchRows} disabled={loading} className="gap-1">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID Ruta</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Motorizado</TableHead>
              <TableHead className="text-center">Paquetes</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  No hay manifiestos registrados aún
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono font-bold">MR-{m.numero_manifiesto}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(m.created_at).toLocaleString("es-CO", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </TableCell>
                  <TableCell>{m.motorizado_nombre}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{m.cantidad_paquetes}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        m.estado === "Activo"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {m.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => openDetalle(m)} className="gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      Detalle
                    </Button>
                    {m.estado === "Activo" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => finalizarManifiesto(m)}
                        className="text-xs"
                      >
                        Finalizar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto print:max-w-none print:shadow-none print:border-0">
          <DialogHeader className="print:text-center">
            <DialogTitle className="flex items-center gap-2 print:justify-center print:text-2xl">
              <FileText className="h-5 w-5 text-primary print:hidden" />
              Manifiesto MR-{detalleManifiesto?.numero_manifiesto}
            </DialogTitle>
            <DialogDescription className="print:text-foreground">
              {detalleManifiesto && (
                <>
                  Motorizado: <strong>{detalleManifiesto.motorizado_nombre}</strong> ·{" "}
                  Paquetes: <strong>{detalleManifiesto.cantidad_paquetes}</strong> ·{" "}
                  Fecha:{" "}
                  <strong>
                    {new Date(detalleManifiesto.created_at).toLocaleString("es-CO")}
                  </strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {detalleLoading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="print-area">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Guía</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead>Ciudad</TableHead>
                    <TableHead className="w-24 print:w-32">Firma</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalleGuias.map((g, idx) => (
                    <TableRow key={g.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell className="font-mono">{g.numero_guia ?? `#${g.id}`}</TableCell>
                      <TableCell>{g.cliente_nombre ?? "—"}</TableCell>
                      <TableCell className="max-w-xs truncate print:whitespace-normal print:max-w-none">
                        {g.direccion_entrega ?? "—"}
                      </TableCell>
                      <TableCell>{g.municipio ?? "—"}</TableCell>
                      <TableCell className="border-l border-dashed border-muted-foreground/40 h-10"></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-10 grid grid-cols-2 gap-10 print:mt-16">
                <div>
                  <div className="border-t border-foreground pt-2 text-center text-sm">
                    Entrega (Aliado Logístico)
                  </div>
                </div>
                <div>
                  <div className="border-t border-foreground pt-2 text-center text-sm">
                    Recibe (Motorizado)
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 print:hidden">
            <Button variant="outline" onClick={() => setDetalleOpen(false)}>
              Cerrar
            </Button>
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ManifiestosListView;
