import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const defaultLogo = "/logo-oficial.png";

type StoreCacheEntry = {
  logo_url: string | null;
  store_name: string | null;
  store_phone: string | null;
  store_address: string | null;
  at: number;
};

const formatTodayDate = () =>
  new Date().toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" });

interface OrderItem {
  id?: number | string;
  product_name?: string | null;
  sku?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  variant_name?: string | null;
}

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  client_phone: string | null;
  direccion_entrega: string | null;
  barrio: string | null;
  zona: string | null;
  municipio?: string | null;
  departamento?: string | null;
  valor_recaudar: number | null;
  metodo_pago: string | null;
  producto_nombre: string | null;
  fecha_creacion: string | null;
  observaciones?: string | null;
  client_user_id?: string | null;
  order_items?: OrderItem[] | null;
}

interface PrintGuiaModalProps {
  pedido: Pedido | null;
  isOpen: boolean;
  onClose: () => void;
  remitente?: string;
}

const MAX_ITEMS_DISPLAY = 6;

const PrintGuiaModal = ({ pedido, isOpen, onClose, remitente }: PrintGuiaModalProps) => {
  const guiaRef = useRef<HTMLDivElement>(null);
  const [storeLogo, setStoreLogo] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [storePhone, setStorePhone] = useState<string | null>(null);
  const [storeAddress, setStoreAddress] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const storeCacheRef = useRef<Record<string, StoreCacheEntry>>({});

  useEffect(() => {
    let isMounted = true;
    const userId = pedido?.client_user_id ?? null;

    const fetchStore = async () => {
      if (!userId) {
        if (isMounted) {
          setStoreLogo(null);
          setStoreName(null);
          setStorePhone(null);
          setStoreAddress(null);
        }
        return;
      }

      const cached = storeCacheRef.current[userId];
      const CACHE_TTL_MS = 10 * 60 * 1000;
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        if (isMounted) {
          setStoreLogo(cached.logo_url);
          setStoreName(cached.store_name);
          setStorePhone(cached.store_phone);
          setStoreAddress(cached.store_address);
        }
        return;
      }

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("logo_url, store_name, phone, direccion")
          .eq("user_id", userId)
          .maybeSingle();

        const entry: StoreCacheEntry = {
          logo_url: profile?.logo_url || null,
          store_name: profile?.store_name || null,
          store_phone: profile?.phone || null,
          store_address: profile?.direccion || null,
          at: Date.now(),
        };
        storeCacheRef.current[userId] = entry;
        if (isMounted) {
          setStoreLogo(entry.logo_url);
          setStoreName(entry.store_name);
          setStorePhone(entry.store_phone);
          setStoreAddress(entry.store_address);
        }
      } catch (err) {
        console.error("Error fetching store info:", err);
      }
    };

    if (isOpen && pedido) fetchStore();
    return () => {
      isMounted = false;
    };
  }, [isOpen, pedido?.client_user_id]);

  const [fetchedItems, setFetchedItems] = useState<OrderItem[] | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!isOpen || !pedido?.id) {
      setFetchedItems(null);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from("order_items")
          .select("id, product_name, sku, quantity, unit_price, product_variants:variant_id(variant_name)")
          .eq("pedido_id", pedido.id)
          .order("id", { ascending: true });
        if (error) throw error;
        if (!isMounted) return;
        const mapped: OrderItem[] = (data || []).map((r: any) => ({
          id: r.id,
          product_name: r.product_name,
          sku: r.sku,
          quantity: r.quantity,
          unit_price: r.unit_price,
          variant_name: r.product_variants?.variant_name ?? null,
        }));
        setFetchedItems(mapped);
      } catch (err) {
        console.error("Error fetching order_items for guia:", err);
        if (isMounted) setFetchedItems([]);
      }
    })();
    return () => { isMounted = false; };
  }, [isOpen, pedido?.id]);

  const items = useMemo<OrderItem[]>(() => {
    if (!pedido) return [];
    if (fetchedItems && fetchedItems.length > 0) return fetchedItems;
    const raw = pedido.order_items;
    if (Array.isArray(raw) && raw.length > 0) return raw;
    // Fallback: synthesize one row from producto_nombre
    return [{ product_name: pedido.producto_nombre || "Paquete estándar", quantity: 1 }];
  }, [pedido, fetchedItems]);

  const handlePrint = useCallback(async () => {
    if (!pedido || !guiaRef.current) return;
    setIsPrinting(true);
    try {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast.error("No se pudo abrir la ventana de impresión. Desactiva el bloqueador de pop-ups.");
        setIsPrinting(false);
        return;
      }
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Guía ${pedido.numero_guia || pedido.id}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              html, body { width: 100mm; height: 150mm; }
              body {
                font-family: Inter, Arial, Helvetica, sans-serif;
                background: white;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              @page { size: 100mm 150mm; margin: 0; }
              @media print {
                html, body { width: 100mm; height: 150mm; margin: 0; padding: 0; overflow: hidden; }
                .guia-container {
                  width: 100mm !important;
                  height: 150mm !important;
                  max-height: 150mm !important;
                  overflow: hidden !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                .print-hidden { display: none !important; }
              }
              table { border-collapse: collapse; width: 100%; }
              td, th { border: 1px solid #000; padding: 1mm; }
            </style>
          </head>
          <body>${guiaRef.current.innerHTML}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
        setIsPrinting(false);
      }, 300);
    } catch (err) {
      console.error("Print error:", err);
      toast.error("Error al imprimir la guía");
      setIsPrinting(false);
    }
  }, [pedido]);

  const handleDownloadPdf = useCallback(async () => {
    if (!pedido || !guiaRef.current) return;
    setIsGenerating(true);
    toast.info("Generando PDF...", { duration: 1500 });
    try {
      const canvas = await html2canvas(guiaRef.current, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [100, 150],
      });
      pdf.addImage(imgData, "PNG", 0, 0, 100, 150);
      pdf.save(`guia-${pedido.numero_guia || pedido.id}.pdf`);
      toast.success("PDF descargado");
    } catch (err) {
      console.error("PDF error:", err);
      toast.error("No se pudo generar el PDF");
    } finally {
      setIsGenerating(false);
    }
  }, [pedido]);

  if (!pedido) return null;

  const finalGuiaNumero = pedido.numero_guia || `KP-${pedido.id}`;
  const finalIsPagado = pedido.metodo_pago === "anticipado";
  const finalDisplayStoreName = storeName || remitente || "Kompras Plus";
  const finalDisplayLogo = storeLogo || defaultLogo;
  const ciudadDepto = [pedido.municipio, pedido.departamento].filter(Boolean).join(", ") || pedido.zona || "—";

  const visibleItems = items.slice(0, MAX_ITEMS_DISPLAY);
  const hiddenItems = items.length - visibleItems.length;
  const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Guía de Envío</DialogTitle>
        </DialogHeader>

        <div className="flex justify-center bg-muted p-4 rounded-lg overflow-auto max-h-[70vh]">
          <div
            ref={guiaRef}
            className="guia-container"
            style={{
              width: "100mm",
              height: "150mm",
              padding: "2mm",
              backgroundColor: "#ffffff",
              fontFamily: "Inter, Arial, Helvetica, sans-serif",
              color: "#000",
              border: "2px solid #000",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              gap: "1.2mm",
              overflow: "hidden",
              fontSize: "8pt",
            }}
          >
            {/* HEADER 3 columnas */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "30mm 1fr 28mm",
              border: "2px solid #000",
              alignItems: "stretch",
            }}>
              <div style={{ borderRight: "2px solid #000", padding: "1mm", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img
                  src={finalDisplayLogo}
                  alt={finalDisplayStoreName}
                  style={{ maxHeight: "10mm", maxWidth: "26mm", objectFit: "contain", filter: storeLogo ? "none" : "grayscale(100%)" }}
                  onError={(e) => { e.currentTarget.src = defaultLogo; e.currentTarget.style.filter = "grayscale(100%)"; }}
                />
              </div>
              <div style={{ borderRight: "2px solid #000", padding: "1mm", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ fontSize: "6pt", fontWeight: 700, textTransform: "uppercase" }}>Zona</div>
                <div style={{ fontSize: "11pt", fontWeight: 900, lineHeight: 1, marginBottom: "0.8mm" }}>{pedido.zona || "—"}</div>
                <div style={{ fontSize: "6pt", fontWeight: 700, textTransform: "uppercase" }}>Barrio</div>
                <div style={{ fontSize: "9pt", fontWeight: 700, lineHeight: 1 }}>{truncate(pedido.barrio || "—", 28)}</div>
              </div>
              <div style={{ padding: "1mm", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ fontSize: "6pt", fontWeight: 700 }}>GUÍA N°</div>
                <div style={{ fontSize: "9pt", fontWeight: 900, lineHeight: 1.05, wordBreak: "break-all" }}>{finalGuiaNumero}</div>
                <div style={{ fontSize: "6pt", marginTop: "0.6mm" }}>{formatTodayDate()}</div>
              </div>
            </div>

            {/* QR + GUIA */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", border: "2px solid #000", padding: "1mm" }}>
              <QRCodeSVG value={`PEDIDO:${pedido.id}`} size={70} level="H" bgColor="#ffffff" fgColor="#000000" />
              <div style={{ fontSize: "9pt", fontWeight: 900, letterSpacing: "0.5px", marginTop: "0.8mm" }}>{finalGuiaNumero}</div>
            </div>

            {/* DE */}
            <div style={{ border: "2px solid #000", padding: "1mm" }}>
              <div style={{ fontSize: "6pt", fontWeight: 700, background: "#000", color: "#fff", padding: "0.5mm 1mm", display: "inline-block", marginBottom: "0.5mm" }}>
                DE (REMITENTE)
              </div>
              <div style={{ fontSize: "8pt", fontWeight: 700, lineHeight: 1.15 }}>{finalDisplayStoreName}</div>
              <div style={{ fontSize: "7pt", lineHeight: 1.2 }}>
                Tel: {storePhone || "—"}
              </div>
              {storeAddress && (
                <div style={{ fontSize: "7pt", lineHeight: 1.2 }}>{truncate(storeAddress, 60)}</div>
              )}
            </div>

            {/* PARA */}
            <div style={{ border: "2px solid #000", padding: "1mm" }}>
              <div style={{ fontSize: "6pt", fontWeight: 700, background: "#000", color: "#fff", padding: "0.5mm 1mm", display: "inline-block", marginBottom: "0.5mm" }}>
                PARA (DESTINATARIO)
              </div>
              <div style={{ fontSize: "10pt", fontWeight: 900, lineHeight: 1.15 }}>{pedido.cliente_nombre || "—"}</div>
              <div style={{ fontSize: "8pt", fontWeight: 700, lineHeight: 1.2 }}>{truncate(pedido.direccion_entrega || "—", 70)}</div>
              <div style={{ fontSize: "7pt", lineHeight: 1.2 }}>{ciudadDepto}</div>
              <div style={{ fontSize: "8pt", fontWeight: 700, lineHeight: 1.2 }}>Tel: {pedido.client_phone || "—"}</div>
              {pedido.observaciones && (
                <div style={{ fontSize: "6.5pt", marginTop: "0.5mm", fontStyle: "italic" }}>
                  Obs: {truncate(pedido.observaciones, 90)}
                </div>
              )}
            </div>

            {/* FINANCIERO */}
            <div style={{ border: "2.5px solid #000", padding: "1.2mm", textAlign: "center" }}>
              <div style={{ fontSize: "7pt", fontWeight: 700, textTransform: "uppercase" }}>Total a Recaudar</div>
              <div style={{ fontSize: "18pt", fontWeight: 900, lineHeight: 1 }}>
                {finalIsPagado ? "PAGADO" : `$${pedido.valor_recaudar?.toLocaleString("es-CO") || "0"}`}
              </div>
            </div>

            {/* TABLA PRODUCTOS */}
            <div style={{ marginTop: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "6.5pt" }}>
                <thead>
                  <tr style={{ background: "#000", color: "#fff" }}>
                    <th style={{ border: "1px solid #000", padding: "0.6mm", width: "6mm" }}>#</th>
                    <th style={{ border: "1px solid #000", padding: "0.6mm", width: "9mm" }}>CANT</th>
                    <th style={{ border: "1px solid #000", padding: "0.6mm", textAlign: "left" }}>PRODUCTO</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((it, idx) => (
                    <tr key={idx}>
                      <td style={{ border: "1px solid #000", padding: "0.6mm", textAlign: "center" }}>{idx + 1}</td>
                      <td style={{ border: "1px solid #000", padding: "0.6mm", textAlign: "center", fontWeight: 700 }}>{it.quantity ?? 1}</td>
                      <td style={{ border: "1px solid #000", padding: "0.6mm" }}>
                        {truncate((it.product_name || "Producto") + (it.sku ? ` (${it.sku})` : ""), 52)}
                      </td>
                    </tr>
                  ))}
                  {hiddenItems > 0 && (
                    <tr>
                      <td colSpan={3} style={{ border: "1px solid #000", padding: "0.6mm", textAlign: "center", fontStyle: "italic" }}>
                        + {hiddenItems} ítem(s) adicional(es)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{ borderTop: "1px solid #000", paddingTop: "0.8mm", textAlign: "center", fontSize: "5.5pt", fontWeight: 700 }}>
              Plus Envíos · Calle 14 # 19-64 Bod. 403 · Tel 324 222 3825
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-4 print-hidden print:hidden">
          <Button
            variant="outline"
            className="flex-1 h-12 min-h-[44px] text-base"
            onClick={handleDownloadPdf}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Generando...</>
            ) : (
              <><Download className="h-5 w-5 mr-2" />Descargar PDF</>
            )}
          </Button>
          <Button
            className="flex-1 h-12 min-h-[44px] text-base"
            onClick={handlePrint}
            disabled={isPrinting}
          >
            {isPrinting ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Imprimiendo...</>
            ) : (
              <><Printer className="h-5 w-5 mr-2" />Imprimir Guía</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrintGuiaModal;
