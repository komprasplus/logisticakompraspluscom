import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useScannerAudio } from "@/hooks/useScannerAudio";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScanLine, Trash2, Loader2, Send, Package, X } from "lucide-react";

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  municipio: string | null;
  estado: string | null;
}

interface Motorizado {
  user_id: string;
  full_name: string;
  vehicle_plate: string | null;
}

const ACCEPTED_STATES = [
  "Recibido en Bodega",
  "recibido en bodega",
  "En Bodega",
  "Asignado",
  "asignado",
];

const ManifiestoScannerView = ({ onCreated }: { onCreated?: () => void }) => {
  const { user } = useAuth();
  const audio = useScannerAudio();
  const inputRef = useRef<HTMLInputElement>(null);

  const [scanValue, setScanValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<Pedido[]>([]);
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [selectedMoto, setSelectedMoto] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const refocus = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  // Fetch motorizados once
  useEffect(() => {
    (async () => {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "motorizado");
      const ids = (roleRows ?? []).map((r) => r.user_id);
      if (!ids.length) return;
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, vehicle_plate, status")
        .in("user_id", ids)
        .eq("status", "activo");
      setMotorizados(
        (profs ?? [])
          .map((p) => ({
            user_id: p.user_id,
            full_name: p.full_name,
            vehicle_plate: p.vehicle_plate,
          }))
          .sort((a, b) => a.full_name.localeCompare(b.full_name)),
      );
    })();
    refocus();
  }, [refocus]);

  const handleScan = useCallback(
    async (raw: string) => {
      const guia = raw.trim();
      if (!guia) return;
      setScanning(true);
      try {
        // Already scanned in this session?
        if (scanned.some((p) => p.numero_guia === guia || String(p.id) === guia)) {
          audio.playErrorSound();
          toast.error(`La guía ${guia} ya está en la lista`);
          return;
        }

        const { data, error } = await supabase
          .from("pedidos")
          .select("id, numero_guia, cliente_nombre, direccion_entrega, municipio, estado, manifiesto_id")
          .or(`numero_guia.eq.${guia},id_externo.eq.${guia}`)
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          audio.playErrorSound();
          toast.error(`Guía ${guia} no encontrada`);
          return;
        }

        if ((data as any).manifiesto_id) {
          audio.playErrorSound();
          toast.error(`Guía ${guia} ya pertenece a otro manifiesto`);
          return;
        }

        if (!ACCEPTED_STATES.includes(data.estado ?? "")) {
          audio.playErrorSound();
          toast.error(`Guía ${guia} no está en bodega (estado: ${data.estado ?? "?"})`);
          return;
        }

        audio.playSuccessSound();
        setScanned((prev) => [data as Pedido, ...prev]);
        toast.success(`✓ ${guia} agregada`);
      } catch (err: any) {
        console.error(err);
        audio.playErrorSound();
        toast.error(`Error al escanear: ${err.message ?? "desconocido"}`);
      } finally {
        setScanning(false);
        setScanValue("");
        refocus();
      }
    },
    [scanned, audio, refocus],
  );

  const removeRow = (id: number) => {
    setScanned((prev) => prev.filter((p) => p.id !== id));
    refocus();
  };

  const handleSubmit = async () => {
    if (!scanned.length) {
      toast.error("Escanea al menos una guía");
      return;
    }
    if (!selectedMoto) {
      toast.error("Selecciona un motorizado");
      return;
    }
    if (!user?.id) {
      toast.error("Sesión no válida");
      return;
    }
    setSubmitting(true);
    try {
      // Get aliado org
      const { data: profile } = await supabase
        .from("profiles")
        .select("organizacion_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: manifiesto, error: insErr } = await supabase
        .from("manifiestos_ruta")
        .insert({
          aliado_logistico_id: user.id,
          motorizado_id: selectedMoto,
          organizacion_id: profile?.organizacion_id ?? null,
          cantidad_paquetes: scanned.length,
          estado: "Activo",
        })
        .select("id, numero_manifiesto")
        .single();

      if (insErr) throw insErr;

      const ids = scanned.map((p) => p.id);
      const moto = motorizados.find((m) => m.user_id === selectedMoto);

      const { error: updErr } = await supabase
        .from("pedidos")
        .update({
          manifiesto_id: manifiesto.id,
          motorizado_id: selectedMoto,
          motorizado_asignado: moto?.full_name ?? null,
          estado: "Asignado",
          fecha_actualizacion: new Date().toISOString(),
        })
        .in("id", ids);

      if (updErr) throw updErr;

      audio.playAssignedSound();
      toast.success(
        `Manifiesto MR-${manifiesto.numero_manifiesto} creado con ${scanned.length} paquete(s) para ${moto?.full_name}`,
      );
      setScanned([]);
      setSelectedMoto("");
      onCreated?.();
      refocus();
    } catch (err: any) {
      console.error(err);
      toast.error(`Error al generar manifiesto: ${err.message ?? "desconocido"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const totalPaquetes = scanned.length;
  const motoLabel = useMemo(
    () => motorizados.find((m) => m.user_id === selectedMoto)?.full_name ?? "",
    [motorizados, selectedMoto],
  );

  return (
    <div className="space-y-5">
      {/* Counter + scanner card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 neu-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-lg">Modo Metralleta</h3>
            {scanning && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          </div>
          <Label className="text-xs text-muted-foreground">
            Escanea o digita la guía y presiona <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Enter</kbd>
          </Label>
          <Input
            ref={inputRef}
            autoFocus
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleScan(scanValue);
              }
            }}
            placeholder="Número de guía…"
            className="h-14 text-2xl font-mono tracking-wider"
            disabled={submitting}
          />
        </div>

        <div className="neu-card p-5 flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
          <Package className="h-8 w-8 text-primary mb-2" />
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Paquetes Listos
          </p>
          <p className="text-5xl font-black text-primary tabular-nums">{totalPaquetes}</p>
        </div>
      </div>

      {/* Assign + submit */}
      <div className="neu-card p-5 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
        <div className="space-y-2">
          <Label>Motorizado asignado</Label>
          <Select value={selectedMoto} onValueChange={setSelectedMoto} disabled={submitting}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Selecciona un motorizado…" />
            </SelectTrigger>
            <SelectContent>
              {motorizados.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.full_name} {m.vehicle_plate ? `· ${m.vehicle_plate}` : ""}
                </SelectItem>
              ))}
              {!motorizados.length && (
                <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                  Sin motorizados activos
                </div>
              )}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={!scanned.length || !selectedMoto || submitting}
          className="h-12 px-6 gap-2"
          size="lg"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Generar Manifiesto
        </Button>
      </div>

      {/* Table */}
      <div className="neu-card p-2 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Guía</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scanned.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  No hay guías escaneadas todavía. El campo está enfocado, dispara la pistola 🔫
                </TableCell>
              </TableRow>
            )}
            {scanned.map((p, idx) => (
              <TableRow key={p.id}>
                <TableCell className="text-muted-foreground">{scanned.length - idx}</TableCell>
                <TableCell className="font-mono font-semibold">{p.numero_guia ?? `#${p.id}`}</TableCell>
                <TableCell>{p.cliente_nombre ?? "—"}</TableCell>
                <TableCell className="max-w-xs truncate">{p.direccion_entrega ?? "—"}</TableCell>
                <TableCell>{p.municipio ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-[10px]">
                    {p.estado}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeRow(p.id)}
                    className="h-7 w-7"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ManifiestoScannerView;
