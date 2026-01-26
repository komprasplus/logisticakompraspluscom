import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, MapPin, Pencil, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const GOOGLE_MAPS_API_KEY = "AIzaSyDvV2fL5jv0OIp45Si4m4-gaWSt9gIXznA";

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
  // Geocoding fields
  latitud: number | null;
  longitud: number | null;
  direccion_normalizada: string | null;
  geocodeStatus: 'pending' | 'success' | 'failed' | 'validating';
  isEditing: boolean;
}

// Load Google Maps script
let googleMapsLoaded = false;
let googleMapsLoading = false;

const loadGoogleMaps = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (googleMapsLoaded && window.google?.maps) {
      resolve();
      return;
    }

    if (googleMapsLoading) {
      const checkInterval = setInterval(() => {
        if (googleMapsLoaded && window.google?.maps) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      return;
    }

    googleMapsLoading = true;

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geocoding&language=es&region=CO`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      googleMapsLoaded = true;
      googleMapsLoading = false;
      resolve();
    };

    script.onerror = () => {
      googleMapsLoading = false;
      reject(new Error("Failed to load Google Maps"));
    };

    document.head.appendChild(script);
  });
};

const BulkOrderUploadModal = ({ isOpen, onClose, onSuccess, clientUserId, storeName }: BulkOrderUploadModalProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<OrderRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState({ current: 0, total: 0 });
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
    
    ws["!cols"] = [
      { wch: 20 },
      { wch: 15 },
      { wch: 35 },
      { wch: 15 },
      { wch: 12 },
      { wch: 15 },
      { wch: 30 },
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
      id: `row-${index}-${Date.now()}`,
      cliente,
      celular,
      direccion,
      barrio,
      ciudad,
      valor_recaudo: valorRecaudo,
      detalles,
      isValid: errors.length === 0,
      errors,
      latitud: null,
      longitud: null,
      direccion_normalizada: null,
      geocodeStatus: 'pending',
      isEditing: false,
    };
  };

  // Geocode a single address
  const geocodeAddress = async (row: OrderRow): Promise<Partial<OrderRow>> => {
    if (!window.google?.maps) {
      return { geocodeStatus: 'failed' as const };
    }

    const geocoder = new google.maps.Geocoder();
    const searchQuery = `${row.direccion}, ${row.barrio}, ${row.ciudad}, Colombia`;

    return new Promise((resolve) => {
      geocoder.geocode(
        { 
          address: searchQuery,
          componentRestrictions: { country: "co" }
        },
        (results, status) => {
          if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
            const location = results[0].geometry.location;
            resolve({
              latitud: location.lat(),
              longitud: location.lng(),
              direccion_normalizada: results[0].formatted_address || null,
              geocodeStatus: 'success' as const,
            });
          } else {
            // Try fallback with just barrio and city
            geocoder.geocode(
              { 
                address: `${row.barrio}, ${row.ciudad}, Colombia`,
                componentRestrictions: { country: "co" }
              },
              (fallbackResults, fallbackStatus) => {
                if (fallbackStatus === google.maps.GeocoderStatus.OK && fallbackResults && fallbackResults[0]) {
                  const location = fallbackResults[0].geometry.location;
                  resolve({
                    latitud: location.lat(),
                    longitud: location.lng(),
                    direccion_normalizada: null, // Mark as needing review
                    geocodeStatus: 'failed' as const, // Mark as failed so user knows to review
                  });
                } else {
                  resolve({ geocodeStatus: 'failed' as const });
                }
              }
            );
          }
        }
      );
    });
  };

  // Geocode all addresses
  const geocodeAllAddresses = async (rows: OrderRow[]) => {
    setIsGeocoding(true);
    setGeocodeProgress({ current: 0, total: rows.length });

    try {
      await loadGoogleMaps();
    } catch (error) {
      toast.error("Error al cargar Google Maps");
      setIsGeocoding(false);
      return rows;
    }

    const updatedRows = [...rows];

    for (let i = 0; i < updatedRows.length; i++) {
      const row = updatedRows[i];
      if (row.isValid && row.geocodeStatus === 'pending') {
        const geocodeResult = await geocodeAddress(row);
        updatedRows[i] = { ...row, ...geocodeResult };
        setGeocodeProgress({ current: i + 1, total: rows.length });
        setParsedRows([...updatedRows]);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }

    setIsGeocoding(false);
    return updatedRows;
  };

  // Re-geocode a single row (for inline editing)
  const reGeocodeRow = async (rowId: string) => {
    const rowIndex = parsedRows.findIndex(r => r.id === rowId);
    if (rowIndex === -1) return;

    const row = parsedRows[rowIndex];
    
    setParsedRows(prev => prev.map(r => 
      r.id === rowId ? { ...r, geocodeStatus: 'validating' as const, isEditing: false } : r
    ));

    try {
      await loadGoogleMaps();
      const geocodeResult = await geocodeAddress(row);
      
      setParsedRows(prev => prev.map(r => 
        r.id === rowId ? { ...r, ...geocodeResult } : r
      ));

      if (geocodeResult.geocodeStatus === 'success') {
        toast.success("Dirección validada correctamente");
      } else {
        toast.warning("No se pudo validar la dirección");
      }
    } catch (error) {
      toast.error("Error al validar dirección");
      setParsedRows(prev => prev.map(r => 
        r.id === rowId ? { ...r, geocodeStatus: 'failed' as const } : r
      ));
    }
  };

  // Update a field in a row
  const updateRowField = (rowId: string, field: keyof OrderRow, value: string) => {
    setParsedRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      
      const updated = { ...r, [field]: value };
      
      // Re-validate basic fields
      const errors: string[] = [];
      if (!updated.cliente) errors.push("Cliente vacío");
      if (!updated.celular) errors.push("Celular vacío");
      if (!updated.direccion) errors.push("Dirección vacía");
      if (!updated.barrio) errors.push("Barrio vacío");
      if (!updated.ciudad) errors.push("Ciudad vacía");
      
      updated.errors = errors;
      updated.isValid = errors.length === 0;
      
      // Mark as needing re-geocoding if address fields changed
      if (['direccion', 'barrio', 'ciudad'].includes(field)) {
        updated.geocodeStatus = 'pending';
        updated.latitud = null;
        updated.longitud = null;
        updated.direccion_normalizada = null;
      }
      
      return updated;
    }));
  };

  // Toggle edit mode for a row
  const toggleEditMode = (rowId: string) => {
    setParsedRows(prev => prev.map(r => 
      r.id === rowId ? { ...r, isEditing: !r.isEditing } : r
    ));
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
      setIsProcessing(false);

      // Start geocoding
      toast.info("Validando direcciones con Google Maps...");
      await geocodeAllAddresses(validatedRows);

      const successCount = validatedRows.filter(r => r.geocodeStatus === 'success').length;
      const failedCount = validatedRows.filter(r => r.geocodeStatus === 'failed').length;

      if (failedCount > 0) {
        toast.warning(`${successCount} direcciones válidas, ${failedCount} requieren corrección`);
      } else {
        toast.success(`${successCount} direcciones validadas correctamente`);
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
    const validRows = parsedRows.filter(r => r.isValid && r.geocodeStatus === 'success');
    if (validRows.length === 0) {
      toast.error("No hay filas válidas para cargar");
      return;
    }

    setIsUploading(true);

    try {
      const ordersToInsert = validRows.map(row => ({
        cliente_nombre: row.cliente,
        client_phone: row.celular,
        direccion_entrega: row.direccion_normalizada || row.direccion,
        barrio: row.barrio,
        municipio: row.ciudad,
        latitud: row.latitud,
        longitud: row.longitud,
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
    setGeocodeProgress({ current: 0, total: 0 });
    onClose();
  };

  // Calculate counts
  const totalRows = parsedRows.length;
  const readyCount = parsedRows.filter(r => r.isValid && r.geocodeStatus === 'success').length;
  const pendingGeocode = parsedRows.filter(r => r.isValid && r.geocodeStatus === 'pending').length;
  const failedCount = parsedRows.filter(r => !r.isValid || r.geocodeStatus === 'failed').length;
  const validatingCount = parsedRows.filter(r => r.geocodeStatus === 'validating').length;

  // Button is only enabled when all rows are either ready or explicitly invalid
  const canSubmit = readyCount > 0 && pendingGeocode === 0 && validatingCount === 0;

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
                    style={{ width: `${(geocodeProgress.current / geocodeProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {geocodeProgress.current} de {geocodeProgress.total} direcciones procesadas
                </p>
              </div>
            )}

            {/* Parsed Results */}
            {parsedRows.length > 0 && !isGeocoding && (
              <div className="space-y-4">
                {/* Summary Counter */}
                <div className="flex items-center gap-4 flex-wrap p-4 rounded-2xl bg-muted/30 border border-border">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-bold text-lg">{readyCount}</span>
                    <span className="text-sm">direcciones listas</span>
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
                      <span className="text-sm">pendientes de validar</span>
                    </div>
                  )}
                </div>

                {/* Editable Table */}
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
                          <th className="px-3 py-3 text-left font-medium text-foreground w-28">Estado GPS</th>
                          <th className="px-3 py-3 text-left font-medium text-foreground w-20">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {parsedRows.map((row, idx) => {
                          const hasError = !row.isValid || row.geocodeStatus === 'failed';
                          const isSuccess = row.isValid && row.geocodeStatus === 'success';
                          const isValidating = row.geocodeStatus === 'validating';
                          
                          return (
                            <tr 
                              key={row.id} 
                              className={`transition-colors ${
                                hasError ? "bg-red-50 dark:bg-red-950/20" : 
                                isSuccess ? "bg-emerald-50/50 dark:bg-emerald-950/10" : ""
                              }`}
                            >
                              <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                              
                              {/* Cliente */}
                              <td className="px-3 py-2">
                                {row.isEditing ? (
                                  <Input
                                    value={row.cliente}
                                    onChange={(e) => updateRowField(row.id, 'cliente', e.target.value)}
                                    className="h-8 text-sm"
                                  />
                                ) : (
                                  <span className={`font-medium ${!row.cliente ? 'text-red-500' : 'text-foreground'}`}>
                                    {row.cliente || "—"}
                                  </span>
                                )}
                              </td>
                              
                              {/* Celular */}
                              <td className="px-3 py-2">
                                {row.isEditing ? (
                                  <Input
                                    value={row.celular}
                                    onChange={(e) => updateRowField(row.id, 'celular', e.target.value)}
                                    className="h-8 text-sm"
                                  />
                                ) : (
                                  <span className={!row.celular ? 'text-red-500' : 'text-muted-foreground'}>
                                    {row.celular || "—"}
                                  </span>
                                )}
                              </td>
                              
                              {/* Dirección */}
                              <td className="px-3 py-2">
                                {row.isEditing ? (
                                  <Input
                                    value={row.direccion}
                                    onChange={(e) => updateRowField(row.id, 'direccion', e.target.value)}
                                    className="h-8 text-sm"
                                  />
                                ) : (
                                  <div className="max-w-[200px]">
                                    {row.direccion_normalizada ? (
                                      <div>
                                        <span className="text-foreground">{row.direccion_normalizada}</span>
                                        <span className="block text-xs text-muted-foreground line-through">{row.direccion}</span>
                                      </div>
                                    ) : (
                                      <span className={`${!row.direccion ? 'text-red-500' : row.geocodeStatus === 'failed' ? 'text-amber-600' : 'text-muted-foreground'}`}>
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
                                    onChange={(e) => updateRowField(row.id, 'barrio', e.target.value)}
                                    className="h-8 text-sm"
                                  />
                                ) : (
                                  <span className={!row.barrio ? 'text-red-500' : 'text-muted-foreground'}>
                                    {row.barrio || "—"}
                                  </span>
                                )}
                              </td>
                              
                              {/* Ciudad */}
                              <td className="px-3 py-2">
                                {row.isEditing ? (
                                  <Input
                                    value={row.ciudad}
                                    onChange={(e) => updateRowField(row.id, 'ciudad', e.target.value)}
                                    className="h-8 text-sm"
                                  />
                                ) : (
                                  <span className={!row.ciudad ? 'text-red-500' : 'text-muted-foreground'}>
                                    {row.ciudad || "—"}
                                  </span>
                                )}
                              </td>
                              
                              {/* Valor */}
                              <td className="px-3 py-2 text-foreground">
                                {row.valor_recaudo > 0 ? `$${row.valor_recaudo.toLocaleString()}` : "—"}
                              </td>
                              
                              {/* GPS Status */}
                              <td className="px-3 py-2">
                                {isValidating ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Validando...
                                  </span>
                                ) : isSuccess ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs">
                                    <CheckCircle2 className="h-3 w-3" />
                                    GPS OK
                                  </span>
                                ) : row.geocodeStatus === 'failed' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs">
                                    <AlertCircle className="h-3 w-3" />
                                    Sin GPS
                                  </span>
                                ) : row.geocodeStatus === 'pending' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs">
                                    <MapPin className="h-3 w-3" />
                                    Pendiente
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </td>
                              
                              {/* Actions */}
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1">
                                  {row.isEditing ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => reGeocodeRow(row.id)}
                                      title="Validar dirección"
                                    >
                                      <RefreshCw className="h-3.5 w-3.5 text-primary" />
                                    </Button>
                                  ) : null}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={() => row.isEditing ? reGeocodeRow(row.id) : toggleEditMode(row.id)}
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

                {/* Help text */}
                {failedCount > 0 && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Pencil className="h-4 w-4" />
                    Haz clic en el ícono de lápiz para editar las direcciones con errores y re-validarlas.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 p-6 border-t border-border bg-muted/30">
            <div className="text-sm text-muted-foreground">
              {parsedRows.length > 0 && (
                <span>
                  {readyCount} de {totalRows} pedidos listos para crear
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!canSubmit || isUploading}
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
                    Crear {readyCount} Pedido{readyCount !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BulkOrderUploadModal;
