import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface BulkOrderUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientUserId?: string;
  storeName?: string;
}

interface OrderRow {
  cliente: string;
  celular: string;
  direccion: string;
  barrio: string;
  ciudad: string;
  valor_recaudo: number;
  detalles: string;
  isValid: boolean;
  errors: string[];
}

const BulkOrderUploadModal = ({ isOpen, onClose, onSuccess, clientUserId, storeName }: BulkOrderUploadModalProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<OrderRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const templateData = [
      {
        Cliente: "Juan Pérez",
        Celular: "3001234567",
        Direccion: "Calle 100 #15-30 Apto 401",
        Barrio: "Usaquén",
        Ciudad: "Bogotá",
        Valor_Recaudo: 50000,
        Detalles: "Camiseta talla M - Color azul"
      },
      {
        Cliente: "María García",
        Celular: "3109876543",
        Direccion: "Carrera 7 #45-12",
        Barrio: "Chapinero",
        Ciudad: "Bogotá",
        Valor_Recaudo: 75000,
        Detalles: "Kit de maquillaje completo"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
    
    // Set column widths
    ws["!cols"] = [
      { wch: 20 }, // Cliente
      { wch: 15 }, // Celular
      { wch: 35 }, // Direccion
      { wch: 15 }, // Barrio
      { wch: 12 }, // Ciudad
      { wch: 15 }, // Valor_Recaudo
      { wch: 30 }, // Detalles
    ];

    XLSX.writeFile(wb, "plantilla_pedidos_masivos.xlsx");
    toast.success("Plantilla descargada correctamente");
  };

  const validateRow = (row: any, index: number): OrderRow => {
    const errors: string[] = [];
    
    const cliente = String(row.Cliente || row.cliente || "").trim();
    const celular = String(row.Celular || row.celular || "").trim();
    const direccion = String(row.Direccion || row.direccion || "").trim();
    const barrio = String(row.Barrio || row.barrio || "").trim();
    const ciudad = String(row.Ciudad || row.ciudad || "").trim();
    const valorRecaudo = Number(row.Valor_Recaudo || row.valor_recaudo || 0);
    const detalles = String(row.Detalles || row.detalles || "").trim();

    if (!cliente) errors.push("Cliente vacío");
    if (!celular) errors.push("Celular vacío");
    if (!direccion) errors.push("Dirección vacía");
    if (!barrio) errors.push("Barrio vacío");
    if (!ciudad) errors.push("Ciudad vacía");

    return {
      cliente,
      celular,
      direccion,
      barrio,
      ciudad,
      valor_recaudo: valorRecaudo,
      detalles,
      isValid: errors.length === 0,
      errors
    };
  };

  const processFile = useCallback(async (uploadedFile: File) => {
    setIsProcessing(true);
    setFile(uploadedFile);

    try {
      const data = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast.error("El archivo está vacío");
        setFile(null);
        setParsedRows([]);
        return;
      }

      const validatedRows = jsonData.map((row, index) => validateRow(row, index));
      setParsedRows(validatedRows);

      const validCount = validatedRows.filter(r => r.isValid).length;
      const invalidCount = validatedRows.filter(r => !r.isValid).length;

      if (invalidCount > 0) {
        toast.warning(`${validCount} filas válidas, ${invalidCount} con errores`);
      } else {
        toast.success(`${validCount} filas listas para cargar`);
      }
    } catch (error) {
      console.error("Error processing file:", error);
      toast.error("Error al procesar el archivo");
      setFile(null);
      setParsedRows([]);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith(".xlsx") || droppedFile.name.endsWith(".csv"))) {
      processFile(droppedFile);
    } else {
      toast.error("Solo se permiten archivos .xlsx o .csv");
    }
  }, [processFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      toast.error("No hay filas válidas para cargar");
      return;
    }

    setIsUploading(true);

    try {
      const ordersToInsert = validRows.map(row => ({
        cliente_nombre: row.cliente,
        client_phone: row.celular,
        direccion_entrega: row.direccion,
        barrio: row.barrio,
        municipio: row.ciudad,
        valor_recaudar: row.valor_recaudo > 0 ? row.valor_recaudo : null,
        observaciones: row.detalles,
        metodo_pago: row.valor_recaudo > 0 ? "efectivo" : "anticipado",
        estado: "Recibido en Bodega",
        fecha_creacion: new Date().toISOString(),
        client_user_id: clientUserId || null,
      }));

      const { error } = await supabase
        .from("pedidos")
        .insert(ordersToInsert);

      if (error) throw error;

      toast.success(`${validRows.length} pedidos creados exitosamente`);
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Error uploading orders:", error);
      toast.error("Error al crear los pedidos");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedRows([]);
    setIsDragging(false);
    onClose();
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
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
          className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl bg-card shadow-2xl border border-border"
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
                <p className="text-sm text-muted-foreground">Sube múltiples pedidos desde un archivo Excel</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="rounded-full p-2 hover:bg-muted transition-colors"
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
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
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
                ) : file ? (
                  <>
                    <FileSpreadsheet className="h-12 w-12 text-primary" />
                    <p className="font-medium text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground">Click para cambiar archivo</p>
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

            {/* Parsed Results */}
            {parsedRows.length > 0 && (
              <div className="mt-6 space-y-4">
                {/* Summary */}
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">{validCount} válidos</span>
                  </div>
                  {invalidCount > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">{invalidCount} con errores</span>
                    </div>
                  )}
                </div>

                {/* Preview Table */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-foreground">#</th>
                          <th className="px-3 py-2 text-left font-medium text-foreground">Cliente</th>
                          <th className="px-3 py-2 text-left font-medium text-foreground">Celular</th>
                          <th className="px-3 py-2 text-left font-medium text-foreground">Dirección</th>
                          <th className="px-3 py-2 text-left font-medium text-foreground">Valor</th>
                          <th className="px-3 py-2 text-left font-medium text-foreground">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {parsedRows.map((row, idx) => (
                          <tr 
                            key={idx} 
                            className={row.isValid ? "" : "bg-red-50 dark:bg-red-950/20"}
                          >
                            <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                            <td className="px-3 py-2 font-medium text-foreground">{row.cliente || "-"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.celular || "-"}</td>
                            <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{row.direccion || "-"}</td>
                            <td className="px-3 py-2 text-foreground">
                              {row.valor_recaudo > 0 ? `$${row.valor_recaudo.toLocaleString()}` : "-"}
                            </td>
                            <td className="px-3 py-2">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  OK
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-600" title={row.errors.join(", ")}>
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  {row.errors[0]}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-muted/30">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={validCount === 0 || isUploading}
              className="gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Crear {validCount} Pedido{validCount !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BulkOrderUploadModal;
