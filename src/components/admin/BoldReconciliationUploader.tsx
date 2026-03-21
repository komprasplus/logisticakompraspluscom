import { useState, useCallback, useRef } from "react";
import { Upload, FileText, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Papa from "papaparse";
import { cn } from "@/lib/utils";

interface ReconciliationResult {
  batch_id: string;
  total: number;
  successful: number;
  failed: number;
  timestamp: string;
}

const BoldReconciliationUploader = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRecords, setParsedRecords] = useState<any[] | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const parseCSVFile = (file: File) => {
    setFile(file);
    setResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: (results) => {
        // Map Bold response columns to our expected format
        const mapped = results.data.map((row: any) => ({
          reference_id: row["Referencia de pago"] || row["reference_id"] || row["Referencia"] || row["ID"] || "",
          status: row["Estado"] || row["status"] || row["Estado de la transferencia"] || "",
          reason: row["Motivo"] || row["reason"] || row["Motivo de rechazo"] || row["Descripción del error"] || "",
        }));
        setParsedRecords(mapped);
        toast.info(`${mapped.length} registros parseados del archivo`);
      },
      error: (err) => {
        toast.error("Error al leer el archivo: " + err.message);
      },
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith(".csv") || droppedFile.type === "text/csv")) {
      parseCSVFile(droppedFile);
    } else {
      toast.error("Solo se aceptan archivos .csv");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) parseCSVFile(selected);
  };

  const handleProcess = async () => {
    if (!parsedRecords || !file) return;

    const validRecords = parsedRecords.filter((r) => r.reference_id && r.status);
    if (validRecords.length === 0) {
      toast.error("No se encontraron registros válidos con reference_id y status");
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc("process_bold_reconciliation", {
        p_filename: file.name,
        p_records: validRecords as any,
      });

      if (error) throw error;

      const res = data as unknown as ReconciliationResult;
      setResult(res);
      toast.success(`Lote procesado: ${res.successful} exitosos, ${res.failed} fallidos`);
    } catch (err: any) {
      console.error("[Reconciliation] Error:", err);
      toast.error("Error al procesar: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedRecords(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Upload className="h-5 w-5 text-primary" />
          Conciliación Bold — Carga de Respuestas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Result summary */}
        {result && (
          <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Lote Procesado
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-background">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-emerald-500/10">
                <p className="text-2xl font-bold text-emerald-600">{result.successful}</p>
                <p className="text-xs text-muted-foreground">Exitosos</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-destructive/10">
                <p className="text-2xl font-bold text-destructive">{result.failed}</p>
                <p className="text-xs text-muted-foreground">Fallidos</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              Procesar otro archivo
            </Button>
          </div>
        )}

        {/* Drop zone */}
        {!result && (
          <>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                isDragging
                  ? "border-primary bg-primary/5 scale-[1.01]"
                  : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/20"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="text-left">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {parsedRecords ? `${parsedRecords.length} registros listos` : "Parseando..."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="font-medium">Arrastra el archivo CSV de Bold aquí</p>
                  <p className="text-sm text-muted-foreground">o haz clic para seleccionar</p>
                </div>
              )}
            </div>

            {/* Preview table */}
            {parsedRecords && parsedRecords.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Vista previa ({Math.min(parsedRecords.length, 5)} de {parsedRecords.length})
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="outline">
                      {parsedRecords.filter((r) => ["EXITOSO", "APROBADO", "SUCCESSFUL", "PAID", "OK"].includes(r.status?.toUpperCase())).length} exitosos
                    </Badge>
                    <Badge variant="destructive">
                      {parsedRecords.filter((r) => ["RECHAZADO", "FALLIDO", "REJECTED", "FAILED", "ERROR"].includes(r.status?.toUpperCase())).length} rechazados
                    </Badge>
                  </div>
                </div>

                <div className="rounded-lg border overflow-auto max-h-48">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2">Referencia</th>
                        <th className="text-left p-2">Estado</th>
                        <th className="text-left p-2">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRecords.slice(0, 5).map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 font-mono text-xs">{r.reference_id?.substring(0, 12)}...</td>
                          <td className="p-2">
                            <Badge
                              variant={
                                ["EXITOSO", "APROBADO", "SUCCESSFUL", "PAID", "OK"].includes(r.status?.toUpperCase())
                                  ? "default"
                                  : "destructive"
                              }
                              className={
                                ["EXITOSO", "APROBADO", "SUCCESSFUL", "PAID", "OK"].includes(r.status?.toUpperCase())
                                  ? "bg-emerald-500/20 text-emerald-700 border-emerald-300"
                                  : ""
                              }
                            >
                              {r.status}
                            </Badge>
                          </td>
                          <td className="p-2 text-muted-foreground text-xs">{r.reason || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleProcess} disabled={processing} className="gap-2">
                    {processing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Procesar Lote ({parsedRecords.length} registros)
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleReset} disabled={processing}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {parsedRecords && parsedRecords.length === 0 && (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg">
                <AlertTriangle className="h-5 w-5" />
                <p className="text-sm">El archivo no contiene registros válidos. Verifica el formato.</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default BoldReconciliationUploader;
