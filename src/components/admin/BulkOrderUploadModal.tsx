import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  MapPin,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

// ─── Constantes ───────────────────────────────────────────────────────────────

/*
  FIX CRÍTICO DE SEGURIDAD: La API key NUNCA debe estar hardcodeada en el
  código fuente — queda expuesta en el bundle JS que cualquier usuario puede
  leer. Debe vivir en una variable de entorno (.env) y ser restringida por
  dominio en Google Cloud Console.

  En tu .env:  VITE_GOOGLE_MAPS_API_KEY=AIzaSy...
  En GCP:      APIs & Services → Credentials → restricción de HTTP referrer
*/
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

/** Número de pedidos por llamada a Supabase insert (evita timeout en lotes grandes) */
const SUPABASE_BATCH_SIZE = 100;

/** Delay entre geocodificaciones para no exceder el rate limit de la API */
const GEOCODE_DELAY_MS = 150;

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface BulkOrderUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientUserId?: string;
  storeName?: string;
}

interface OrderRow {
  id: string;
  cliente: string;
  celular: string;
  direccion: string;
  barrio: string;
  ciudad: string;
  valor_recaudo: number;
  detalles: string;
  isValid: boolean;
  errors: string[];
  latitud: number | null;
  longitud: number | null;
  direccion_normalizada: string | null;
  geocodeStatus: "pending" | "success" | "failed" | "validating";
  isEditing: boolean;
}

// ─── Lógica de validación (fuera del componente — función pura, sin recrearse) ─

/**
 * Valida una fila del Excel. Centralizar aquí evita duplicar la lógica
 * entre `validateRow` y `updateRowField`.
 */
const computeErrors = (row: Pick<OrderRow, "cliente" | "celular" | "direccion" | "barrio" | "ciudad">): string[] => {
  const errors: string[] = [];
  if (!row.cliente) errors.push("Cliente vacío");
  if (!row.celular) errors.push("Celular vacío");
  else if (!/^\d{10}$/.test(row.celular.replace(/\s/g, ""))) errors.push("Celular debe tener 10 dígitos");
  if (!row.direccion) errors.push("Dirección vacía");
  if (!row.barrio) errors.push("Barrio vacío");
  if (!row.ciudad) errors.push("Ciudad vacía");
  return errors;
};

const validateRow = (row: Record<string, unknown>, index: number): OrderRow => {
  const cliente = String(row.Cliente ?? row.cliente ?? "").trim();
  const celular = String(row.Celular ?? row.celular ?? "").trim();
  const direccion = String(row.Direccion ?? row.direccion ?? "").trim();
  const barrio = String(row.Barrio ?? row.barrio ?? "").trim();
  const ciudad = String(row.Ciudad ?? row.ciudad ?? "").trim();
  const rawRecaudo = row.Valor_Recaudo ?? row.valor_recaudo ?? "";
  const valorRecaudo = Number(rawRecaudo);
  const detalles = String(row.Detalles ?? row.detalles ?? "").trim();

  const errors = computeErrors({ cliente, celular, direccion, barrio, ciudad });

  if (rawRecaudo !== "" && rawRecaudo !== 0 && (isNaN(valorRecaudo) || valorRecaudo < 0))
    errors.push("Recaudo debe ser numérico");

  return {
    id: `row-${index}-${Date.now()}`,
    cliente,
    celular,
    direccion,
    barrio,
    ciudad,
    valor_recaudo: isNaN(valorRecaudo) ? 0 : valorRecaudo,
    detalles,
    isValid: errors.length === 0,
    errors,
    latitud: null,
    longitud: null,
    direccion_normalizada: null,
    geocodeStatus: "pending",
    isEditing: false,
  };
};

// ─── Google Maps loader (singleton con fix de memory leak) ───────────────────

let gmapsState: "idle" | "loading" | "loaded" | "error" = "idle";
const gmapsCallbacks: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];

const loadGoogleMaps = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (gmapsState === "loaded" && window.google?.maps) {
      resolve();
      return;
    }
    if (gmapsState === "error") {
      reject(new Error("Google Maps failed to load"));
      return;
    }

    // Acumular callbacks mientras carga para no inyectar el script dos veces
    gmapsCallbacks.push({ resolve, reject });

    if (gmapsState === "loading") return; // Ya hay una carga en curso, solo esperar
    gmapsState = "loading";

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geocoding&language=es&region=CO`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      gmapsState = "loaded";
      gmapsCallbacks.forEach((cb) => cb.resolve());
      gmapsCallbacks.length = 0;
    };

    script.onerror = () => {
      gmapsState = "error";
      const err = new Error("Failed to load Google Maps");
      gmapsCallbacks.forEach((cb) => cb.reject(err));
      gmapsCallbacks.length = 0;
    };

    document.head.appendChild(script);
  });
};

// ─── Geocodificación ──────────────────────────────────────────────────────────

const geocodeAddress = (row: OrderRow): Promise<Partial<OrderRow>> => {
  return new Promise((resolve) => {
    const geocoder = new google.maps.Geocoder();
    const searchQuery = `${row.direccion}, ${row.barrio}, ${row.ciudad}, Colombia`;

    geocoder.geocode({ address: searchQuery, componentRestrictions: { country: "co" } }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results?.[0]) {
        const loc = results[0].geometry.location;
        resolve({
          latitud: loc.lat(),
          longitud: loc.lng(),
          direccion_normalizada: results[0].formatted_address ?? null,
          geocodeStatus: "success",
        });
        return;
      }

      // Fallback: solo barrio + ciudad
      geocoder.geocode(
        { address: `${row.barrio}, ${row.ciudad}, Colombia`, componentRestrictions: { country: "co" } },
        (fbResults, fbStatus) => {
          if (fbStatus === google.maps.GeocoderStatus.OK && fbResults?.[0]) {
            const loc = fbResults[0].geometry.location;
            resolve({
              latitud: loc.lat(),
              longitud: loc.lng(),
              direccion_normalizada: null,
              geocodeStatus: "failed", // Requiere revisión manual
            });
          } else {
            resolve({ geocodeStatus: "failed" });
          }
        },
      );
    });
  });
};

// ─── Componente principal ─────────────────────────────────────────────────────

const BulkOrderUploadModal = ({ isOpen, onClose, onSuccess, clientUserId }: BulkOrderUploadModalProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<OrderRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  /*
    FIX: ref para cancelar geocodificaciones en vuelo si:
    - El componente se desmonta (evita setState sobre componente desmontado).
    - El usuario sube un nuevo archivo mientras el anterior aún se geocodifica.
  */
  const geocodeCancelRef = useRef(false);

  // Cancelar geocodeo activo al desmontar
  useEffect(() => {
    return () => {
      geocodeCancelRef.current = true;
    };
  }, []);

  // ── Template ───────────────────────────────────────────────────────────────

  const downloadTemplate = useCallback(() => {
    const templateData = [
      {
        Cliente: "Juan Pérez",
        Celular: "3001234567",
        Direccion: "Calle 100 #15-30 Apto 401",
        Barrio: "Usaquén",
        Ciudad: "Bogotá",
        Valor_Recaudo: 50000,
        Detalles: "Camiseta talla M - Color azul",
      },
      {
        Cliente: "María García",
        Celular: "3109876543",
        Direccion: "Carrera 7 #45-12",
        Barrio: "Chapinero",
        Ciudad: "Bogotá",
        Valor_Recaudo: 75000,
        Detalles: "Kit de maquillaje completo",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws["!cols"] = [{ wch: 20 }, { wch: 15 }, { wch: 35 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
    XLSX.writeFile(wb, "plantilla_pedidos_masivos.xlsx");
    toast.success("Plantilla descargada correctamente");
  }, []);

  // ── Geocodificación masiva ─────────────────────────────────────────────────

  const geocodeAllAddresses = useCallback(async (rows: OrderRow[]) => {
    setIsGeocoding(true);
    setGeocodeProgress({ current: 0, total: rows.length });
    geocodeCancelRef.current = false; // Resetear bandera al iniciar

    try {
      await loadGoogleMaps();
    } catch {
      toast.error("Error al cargar Google Maps. Verifica la API key.");
      setIsGeocoding(false);
      return rows;
    }

    const updatedRows = [...rows];

    for (let i = 0; i < updatedRows.length; i++) {
      // FIX: salir del loop si el componente se desmontó o llegó un nuevo archivo
      if (geocodeCancelRef.current) break;

      const row = updatedRows[i];
      if (!row.isValid || row.geocodeStatus !== "pending") continue;

      const result = await geocodeAddress(row);
      updatedRows[i] = { ...row, ...result };
      setGeocodeProgress({ current: i + 1, total: rows.length });

      /*
        FIX: actualizamos solo la fila específica con función updater
        en vez de reemplazar todo el array. Así si el usuario editó
        otra fila mientras tanto, sus cambios no se pierden.
      */
      setParsedRows((prev) => prev.map((r) => (r.id === updatedRows[i].id ? updatedRows[i] : r)));

      await new Promise((res) => setTimeout(res, GEOCODE_DELAY_MS));
    }

    setIsGeocoding(false);
    return updatedRows;
  }, []);

  // ── Re-geocodificar una sola fila ──────────────────────────────────────────

  const reGeocodeRow = useCallback(
    async (rowId: string) => {
      const row = parsedRows.find((r) => r.id === rowId);
      if (!row) return;

      setParsedRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, geocodeStatus: "validating", isEditing: false } : r)),
      );

      try {
        await loadGoogleMaps();
        const result = await geocodeAddress(row);
        setParsedRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...result } : r)));
        toast[result.geocodeStatus === "success" ? "success" : "warning"](
          result.geocodeStatus === "success"
            ? "Dirección validada correctamente"
            : "No se pudo validar la dirección — edítala manualmente",
        );
      } catch {
        toast.error("Error al validar dirección");
        setParsedRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, geocodeStatus: "failed" } : r)));
      }
    },
    [parsedRows],
  );

  // ── Edición inline ─────────────────────────────────────────────────────────

  const updateRowField = useCallback((rowId: string, field: keyof OrderRow, value: string) => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;

        const updated: OrderRow = { ...r, [field]: value };
        // FIX: reutilizamos computeErrors centralizado — sin duplicar lógica
        updated.errors = computeErrors(updated);
        updated.isValid = updated.errors.length === 0;

        // Marcar como pendiente de re-geocodeo si cambió algún campo de dirección
        if (["direccion", "barrio", "ciudad"].includes(field as string)) {
          updated.geocodeStatus = "pending";
          updated.latitud = null;
          updated.longitud = null;
          updated.direccion_normalizada = null;
        }
        return updated;
      }),
    );
  }, []);

  const toggleEditMode = useCallback((rowId: string) => {
    setParsedRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, isEditing: !r.isEditing } : r)));
  }, []);

  // ── Procesar archivo ───────────────────────────────────────────────────────

  const processFile = useCallback(
    async (uploadedFile: File) => {
      // Cancelar cualquier geocodeo previo en vuelo
      geocodeCancelRef.current = true;

      setIsProcessing(true);
      setFile(uploadedFile);
      setParsedRows([]);

      try {
        const data = await uploadedFile.arrayBuffer();
        const workbook = XLSX.read(data);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

        if (jsonData.length === 0) {
          toast.error("El archivo está vacío");
          setFile(null);
          return;
        }

        const validatedRows = jsonData.map((row, index) => validateRow(row, index));
        setParsedRows(validatedRows);
        setIsProcessing(false); // Mostrar tabla mientras geocodifica

        toast.info(`${validatedRows.length} filas encontradas. Validando direcciones...`);
        const result = await geocodeAllAddresses(validatedRows);

        const successCount = result.filter((r) => r.geocodeStatus === "success").length;
        const failedCount = result.filter((r) => r.geocodeStatus === "failed").length;

        if (failedCount > 0) toast.warning(`${successCount} direcciones válidas · ${failedCount} requieren corrección`);
        else toast.success(`${successCount} direcciones validadas correctamente`);
      } catch (error) {
        console.error("Error processing file:", error);
        toast.error("Error al procesar el archivo");
        setFile(null);
        setParsedRows([]);
      } finally {
        setIsProcessing(false);
      }
    },
    [geocodeAllAddresses],
  );

  // ── Drag & drop ────────────────────────────────────────────────────────────

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile?.name.match(/\.(xlsx|csv)$/i)) {
        processFile(droppedFile);
      } else {
        toast.error("Solo se permiten archivos .xlsx o .csv");
      }
    },
    [processFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) processFile(selectedFile);
      // Resetear input para permitir seleccionar el mismo archivo de nuevo
      e.target.value = "";
    },
    [processFile],
  );

  // ── Subida a Supabase ──────────────────────────────────────────────────────

  const handleUpload = useCallback(async () => {
    const validRows = parsedRows.filter((r) => r.isValid && r.geocodeStatus === "success");
    if (validRows.length === 0) {
      toast.error("No hay filas válidas para cargar");
      return;
    }

    setIsUploading(true);
    try {
      const ordersToInsert = validRows.map((row) => ({
        cliente_nombre: row.cliente,
        client_phone: row.celular,
        direccion_entrega: row.direccion_normalizada ?? row.direccion,
        barrio: row.barrio,
        municipio: row.ciudad,
        latitud: row.latitud,
        longitud: row.longitud,
        valor_recaudar: row.valor_recaudo > 0 ? row.valor_recaudo : null,
        observaciones: row.detalles,
        metodo_pago: row.valor_recaudo > 0 ? "efectivo" : "anticipado",
        estado: "Recibido en Bodega",
        fecha_creacion: new Date().toISOString(),
        client_user_id: clientUserId ?? null,
      }));

      /*
        FIX: insertar en batches para evitar timeout o rechazo de Supabase
        con lotes muy grandes (>500 filas).
      */
      for (let i = 0; i < ordersToInsert.length; i += SUPABASE_BATCH_SIZE) {
        const batch = ordersToInsert.slice(i, i + SUPABASE_BATCH_SIZE);
        const { error } = await supabase.from("pedidos").insert(batch);
        if (error) throw error;
      }

      toast.success(`${validRows.length} pedidos creados exitosamente`);
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Error uploading orders:", error);
      const message = error instanceof Error ? error.message : "Error desconocido";
      toast.error("Error al crear los pedidos: " + message);
    } finally {
      setIsUploading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedRows, clientUserId, onSuccess]);

  // ── Cerrar ─────────────────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    geocodeCancelRef.current = true; // Cancelar geocodeo si estaba corriendo
    setFile(null);
    setParsedRows([]);
    setIsDragging(false);
    setGeocodeProgress({ current: 0, total: 0 });
    onClose();
  }, [onClose]);

  // ── Métricas derivadas ─────────────────────────────────────────────────────

  const totalRows = parsedRows.length;
  const readyCount = parsedRows.filter((r) => r.isValid && r.geocodeStatus === "success").length;
  const pendingGeocode = parsedRows.filter((r) => r.isValid && r.geocodeStatus === "pending").length;
  const failedCount = parsedRows.filter((r) => !r.isValid || r.geocodeStatus === "failed").length;
  const validatingCount = parsedRows.filter((r) => r.geocodeStatus === "validating").length;
  const canSubmit = readyCount > 0 && pendingGeocode === 0 && validatingCount === 0 && !isGeocoding;

  // ── Render ─────────────────────────────────────────────────────────────────

  /*
    FIX: AnimatePresence necesita que el children exista en el árbol para
    animar la salida. Si retornamos null cuando !isOpen, AnimatePresence
    nunca ve el exit. La solución es dejar que AnimatePresence controle
    la visibilidad con el condicional DENTRO de su scope.
  */
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl bg-card shadow-2xl border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10">
                  <FileSpreadsheet className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Carga Masiva de Pedidos</h2>
                  <p className="text-sm text-muted-foreground">Sube múltiples pedidos con validación de direcciones</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="rounded-full p-2 hover:bg-muted transition-colors"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {/* Template Download */}
              <div className="mb-6 p-4 rounded-2xl bg-muted/50 border border-border neu-flat">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <Download className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">Plantilla Excel</p>
                      <p className="text-sm text-muted-foreground">Descarga y completa con tus pedidos</p>
                    </div>
                  </div>
                  <Button onClick={downloadTemplate} variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Descargar Plantilla
                  </Button>
                </div>
              </div>

              {/* Drop Zone */}
              {parsedRows.length === 0 && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/30"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center gap-3 text-center">
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-12 w-12 text-primary animate-spin" />
                        <p className="font-medium text-foreground">Procesando archivo...</p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-12 w-12 text-muted-foreground" />
                        <p className="font-medium text-foreground">Arrastra tu archivo aquí</p>
                        <p className="text-sm text-muted-foreground">o haz clic para seleccionar (.xlsx, .csv)</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Geocoding Progress */}
              {isGeocoding && (
                <div className="mb-4 p-4 rounded-2xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-3 mb-2">
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    <span className="font-medium text-foreground">Validando direcciones con Google Maps...</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          geocodeProgress.total > 0 ? (geocodeProgress.current / geocodeProgress.total) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {geocodeProgress.current} de {geocodeProgress.total} direcciones procesadas
                  </p>
                </div>
              )}

              {/* Error Summary */}
              {parsedRows.length > 0 && !isGeocoding && failedCount > 0 && (
                <div className="mb-4 p-4 rounded-2xl bg-destructive/5 border border-destructive/20">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <h3 className="font-bold text-foreground">
                      {failedCount} fila{failedCount !== 1 ? "s" : ""} con errores
                    </h3>
                  </div>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {/* FIX: eliminada variable `idx` no usada del map */}
                    {parsedRows
                      .filter((r) => !r.isValid)
                      .map((row) => (
                        <li key={row.id} className="text-sm text-destructive flex items-start gap-2">
                          <span className="font-mono font-bold min-w-[2rem]">#{parsedRows.indexOf(row) + 1}</span>
                          <span>{row.errors.join(" · ")}</span>
                        </li>
                      ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Edita cada fila con el ícono de lápiz para corregir los errores.
                  </p>
                </div>
              )}

              {/* Results Table */}
              {parsedRows.length > 0 && !isGeocoding && (
                <div className="space-y-4">
                  {/* Summary Counter */}
                  <div className="flex items-center gap-4 flex-wrap p-4 rounded-2xl bg-muted/30 border border-border">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-bold text-lg">{readyCount}</span>
                      <span className="text-sm">listas</span>
                    </div>
                    {failedCount > 0 && (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                        <AlertCircle className="h-5 w-5" />
                        <span className="font-bold text-lg">{failedCount}</span>
                        <span className="text-sm">por corregir</span>
                      </div>
                    )}
                    {pendingGeocode > 0 && (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                        <MapPin className="h-5 w-5" />
                        <span className="font-bold text-lg">{pendingGeocode}</span>
                        <span className="text-sm">pendientes GPS</span>
                      </div>
                    )}
                  </div>

                  {/* Table */}
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 sticky top-0 z-10">
                          <tr>
                            <th className="px-3 py-3 text-left font-medium text-foreground w-10">#</th>
                            <th className="px-3 py-3 text-left font-medium text-foreground min-w-[120px]">Cliente</th>
                            <th className="px-3 py-3 text-left font-medium text-foreground min-w-[110px]">Celular</th>
                            <th className="px-3 py-3 text-left font-medium text-foreground min-w-[200px]">Dirección</th>
                            <th className="px-3 py-3 text-left font-medium text-foreground min-w-[100px]">Barrio</th>
                            <th className="px-3 py-3 text-left font-medium text-foreground min-w-[100px]">Ciudad</th>
                            <th className="px-3 py-3 text-left font-medium text-foreground w-24">Valor</th>
                            <th className="px-3 py-3 text-left font-medium text-foreground w-28">GPS</th>
                            <th className="px-3 py-3 text-left font-medium text-foreground w-20">Editar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {parsedRows.map((row, idx) => {
                            const hasError = !row.isValid || row.geocodeStatus === "failed";
                            const isSuccess = row.isValid && row.geocodeStatus === "success";
                            const isValidating = row.geocodeStatus === "validating";

                            return (
                              <tr
                                key={row.id}
                                className={`transition-colors ${
                                  hasError
                                    ? "bg-red-50 dark:bg-red-950/20"
                                    : isSuccess
                                      ? "bg-emerald-50/50 dark:bg-emerald-950/10"
                                      : ""
                                }`}
                              >
                                <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>

                                {/* Cliente */}
                                <td className="px-3 py-2">
                                  {row.isEditing ? (
                                    <Input
                                      value={row.cliente}
                                      onChange={(e) => updateRowField(row.id, "cliente", e.target.value)}
                                      className="h-8 text-sm"
                                    />
                                  ) : (
                                    <span
                                      className={`font-medium ${!row.cliente ? "text-red-500" : "text-foreground"}`}
                                    >
                                      {row.cliente || "—"}
                                    </span>
                                  )}
                                </td>

                                {/* Celular */}
                                <td className="px-3 py-2">
                                  {row.isEditing ? (
                                    <Input
                                      value={row.celular}
                                      onChange={(e) => updateRowField(row.id, "celular", e.target.value)}
                                      className="h-8 text-sm"
                                    />
                                  ) : (
                                    <span className={!row.celular ? "text-red-500" : "text-muted-foreground"}>
                                      {row.celular || "—"}
                                    </span>
                                  )}
                                </td>

                                {/* Dirección */}
                                <td className="px-3 py-2">
                                  {row.isEditing ? (
                                    <Input
                                      value={row.direccion}
                                      onChange={(e) => updateRowField(row.id, "direccion", e.target.value)}
                                      className="h-8 text-sm"
                                    />
                                  ) : (
                                    <div className="max-w-[200px]">
                                      {row.direccion_normalizada ? (
                                        <>
                                          <span className="text-foreground">{row.direccion_normalizada}</span>
                                          <span className="block text-xs text-muted-foreground line-through">
                                            {row.direccion}
                                          </span>
                                        </>
                                      ) : (
                                        <span
                                          className={
                                            !row.direccion
                                              ? "text-red-500"
                                              : row.geocodeStatus === "failed"
                                                ? "text-amber-600"
                                                : "text-muted-foreground"
                                          }
                                        >
                                          {row.direccion || "—"}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>

                                {/* Barrio */}
                                <td className="px-3 py-2">
                                  {row.isEditing ? (
                                    <Input
                                      value={row.barrio}
                                      onChange={(e) => updateRowField(row.id, "barrio", e.target.value)}
                                      className="h-8 text-sm"
                                    />
                                  ) : (
                                    <span className={!row.barrio ? "text-red-500" : "text-muted-foreground"}>
                                      {row.barrio || "—"}
                                    </span>
                                  )}
                                </td>

                                {/* Ciudad */}
                                <td className="px-3 py-2">
                                  {row.isEditing ? (
                                    <Input
                                      value={row.ciudad}
                                      onChange={(e) => updateRowField(row.id, "ciudad", e.target.value)}
                                      className="h-8 text-sm"
                                    />
                                  ) : (
                                    <span className={!row.ciudad ? "text-red-500" : "text-muted-foreground"}>
                                      {row.ciudad || "—"}
                                    </span>
                                  )}
                                </td>

                                {/* Valor */}
                                <td className="px-3 py-2 text-foreground">
                                  {row.valor_recaudo > 0 ? `$${row.valor_recaudo.toLocaleString("es-CO")}` : "—"}
                                </td>

                                {/* GPS Status */}
                                <td className="px-3 py-2">
                                  {isValidating ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs">
                                      <Loader2 className="h-3 w-3 animate-spin" /> Validando...
                                    </span>
                                  ) : isSuccess ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs">
                                      <CheckCircle2 className="h-3 w-3" /> GPS OK
                                    </span>
                                  ) : row.geocodeStatus === "failed" ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs">
                                      <AlertCircle className="h-3 w-3" /> Sin GPS
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs">
                                      <MapPin className="h-3 w-3" /> Pendiente
                                    </span>
                                  )}
                                </td>

                                {/* Actions */}
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1">
                                    {row.isEditing && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 w-7 p-0"
                                        onClick={() => reGeocodeRow(row.id)}
                                        title="Revalidar dirección"
                                      >
                                        <RefreshCw className="h-3.5 w-3.5 text-primary" />
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => (row.isEditing ? reGeocodeRow(row.id) : toggleEditMode(row.id))}
                                      title={row.isEditing ? "Guardar y validar" : "Editar"}
                                    >
                                      {row.isEditing ? (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                      ) : (
                                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                      )}
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {failedCount > 0 && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Pencil className="h-4 w-4" />
                      Haz clic en el ícono de lápiz para editar y re-validar las filas con errores.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 p-6 border-t border-border bg-muted/30">
              <div className="text-sm text-muted-foreground">
                {totalRows > 0 && (
                  <span>
                    {readyCount} de {totalRows} pedidos listos para crear
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button onClick={handleUpload} disabled={!canSubmit || isUploading} className="gap-2">
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Crear {readyCount} Pedido{readyCount !== 1 ? "s" : ""}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BulkOrderUploadModal;
