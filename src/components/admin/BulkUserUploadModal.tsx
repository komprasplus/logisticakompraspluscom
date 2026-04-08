import { useState, useRef, useCallback } from "react";
import { Upload, Download, FileSpreadsheet, Loader2, X, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import Papa from "papaparse";

interface BulkUserUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

interface CsvRow {
  nombre_completo: string;
  email: string;
  password: string;
  rol: string;
  telefono?: string;
  nombre_tienda?: string;
}

interface UploadResult {
  email: string;
  success: boolean;
  error?: string;
}

const VALID_ROLES: Record<string, string> = {
  tienda: "cliente",
  cliente: "cliente",
  motorizado: "motorizado",
  aliado_logistico: "aliado_logistico",
  despachador: "despachador",
  admin: "admin",
};

const TEMPLATE_CSV = `nombre_completo,email,password,rol,telefono,nombre_tienda
Juan Pérez,juan@ejemplo.com,Password123!,tienda,3001234567,Mi Tienda
María López,maria@ejemplo.com,Password456!,motorizado,3009876543,
Carlos Ruiz,carlos@ejemplo.com,Password789!,despachador,,`;

const BulkUserUploadModal = ({ open, onOpenChange, onComplete }: BulkUserUploadModalProps) => {
  const { user, profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<CsvRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<UploadResult[] | null>(null);

  const orgId = profile?.organizacion_id;

  const reset = () => {
    setFile(null);
    setParsedRows([]);
    setValidationErrors([]);
    setProcessing(false);
    setProgress(0);
    setResults(null);
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_usuarios.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResults(null);
    setValidationErrors([]);

    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const errors: string[] = [];
        const rows: CsvRow[] = [];

        result.data.forEach((row, idx) => {
          const lineNum = idx + 2;
          const name = row.nombre_completo?.trim();
          const email = row.email?.trim();
          const password = row.password?.trim();
          const rolRaw = row.rol?.trim().toLowerCase();

          if (!name) errors.push(`Línea ${lineNum}: nombre_completo vacío`);
          if (!email) errors.push(`Línea ${lineNum}: email vacío`);
          else if (!validateEmail(email)) errors.push(`Línea ${lineNum}: email inválido (${email})`);
          if (!password) errors.push(`Línea ${lineNum}: password vacío`);
          else if (password.length < 6) errors.push(`Línea ${lineNum}: password muy corto (min 6)`);
          if (!rolRaw || !VALID_ROLES[rolRaw]) errors.push(`Línea ${lineNum}: rol inválido "${row.rol}" (usa: tienda, motorizado, aliado_logistico, despachador)`);

          if (rolRaw === "tienda" || rolRaw === "cliente") {
            if (!row.nombre_tienda?.trim()) errors.push(`Línea ${lineNum}: nombre_tienda obligatorio para rol tienda`);
          }

          rows.push({
            nombre_completo: name || "",
            email: email || "",
            password: password || "",
            rol: VALID_ROLES[rolRaw] || rolRaw || "",
            telefono: row.telefono?.trim() || "",
            nombre_tienda: row.nombre_tienda?.trim() || "",
          });
        });

        // Check duplicate emails
        const emails = rows.map(r => r.email.toLowerCase());
        const dupes = emails.filter((e, i) => emails.indexOf(e) !== i);
        if (dupes.length > 0) errors.push(`Emails duplicados: ${[...new Set(dupes)].join(", ")}`);

        setParsedRows(rows);
        setValidationErrors(errors);
      },
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".csv") || f.type === "text/csv")) handleFile(f);
    else toast.error("Solo se aceptan archivos CSV");
  }, [handleFile]);

  const processUpload = async () => {
    if (!orgId || parsedRows.length === 0) return;
    setProcessing(true);
    setProgress(0);
    const uploadResults: UploadResult[] = [];
    const token = (await supabase.auth.getSession()).data.session?.access_token;

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      try {
        const { data, error } = await supabase.functions.invoke("create-user", {
          body: {
            email: row.email.trim(),
            password: row.password,
            fullName: row.nombre_completo,
            phone: row.telefono || null,
            role: row.rol,
            storeName: row.nombre_tienda || null,
            organizacionId: orgId,
          },
        });

        if (error) throw new Error(error.message || "Error de función");
        if (data?.error) throw new Error(data.error);

        uploadResults.push({ email: row.email, success: true });
      } catch (err: any) {
        uploadResults.push({ email: row.email, success: false, error: err.message });
      }
      setProgress(Math.round(((i + 1) / parsedRows.length) * 100));
    }

    setResults(uploadResults);
    setProcessing(false);

    const successCount = uploadResults.filter(r => r.success).length;
    const failCount = uploadResults.filter(r => !r.success).length;

    if (failCount === 0) toast.success(`${successCount} usuarios creados exitosamente`);
    else toast.warning(`${successCount} creados, ${failCount} fallidos`);

    if (successCount > 0) onComplete?.();
  };

  const successCount = results?.filter(r => r.success).length || 0;
  const failCount = results?.filter(r => !r.success).length || 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Carga Masiva de Usuarios
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download template */}
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 w-full">
            <Download className="h-4 w-4" />
            Descargar Plantilla CSV
          </Button>

          {/* Drop zone */}
          {!results && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5"
            >
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileSpreadsheet className="h-6 w-6 text-primary" />
                  <span className="font-medium text-foreground">{file.name}</span>
                  <Badge variant="secondary">{parsedRows.length} registros</Badge>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Arrastra un archivo CSV o haz clic para seleccionar
                  </p>
                </div>
              )}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
              <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> {validationErrors.length} errores de validación
              </p>
              {validationErrors.map((err, i) => (
                <p key={i} className="text-xs text-destructive/80">• {err}</p>
              ))}
            </div>
          )}

          {/* Preview table */}
          {parsedRows.length > 0 && !results && validationErrors.length === 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">Nombre</th>
                      <th className="px-2 py-1.5 text-left font-medium">Email</th>
                      <th className="px-2 py-1.5 text-left font-medium">Rol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1.5">{r.nombre_completo}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{r.email}</td>
                        <td className="px-2 py-1.5">
                          <Badge variant="outline" className="text-[10px]">{r.rol}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {processing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Creando usuarios...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 text-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-emerald-700">{successCount}</p>
                  <p className="text-xs text-emerald-600">Exitosos</p>
                </div>
                {failCount > 0 && (
                  <div className="flex-1 bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
                    <AlertCircle className="h-6 w-6 text-red-600 mx-auto mb-1" />
                    <p className="text-lg font-bold text-red-700">{failCount}</p>
                    <p className="text-xs text-red-600">Fallidos</p>
                  </div>
                )}
              </div>

              {failCount > 0 && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 max-h-32 overflow-y-auto">
                  {results.filter(r => !r.success).map((r, i) => (
                    <p key={i} className="text-xs text-destructive">• {r.email}: {r.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            {results ? (
              <Button onClick={() => { reset(); onOpenChange(false); }}>Cerrar</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={processing}>
                  Cancelar
                </Button>
                <Button
                  onClick={processUpload}
                  disabled={processing || parsedRows.length === 0 || validationErrors.length > 0}
                  className="gap-2"
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Crear {parsedRows.length} Usuarios
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkUserUploadModal;
