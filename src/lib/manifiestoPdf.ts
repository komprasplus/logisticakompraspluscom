// Manifiesto de Recogida PDF generator using jsPDF + autotable
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ManifiestoItem {
  product_name: string;
  quantity: number;
  variant_name?: string | null;
}

export interface ManifiestoPedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  municipio: string | null;
  direccion_entrega: string | null;
  items?: ManifiestoItem[];
}

export interface ManifiestoData {
  manifiestoNumero: string;
  storeName: string;
  fecha: string;
  pedidos: ManifiestoPedido[];
}

export const generateManifiestoNumero = (): string => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `MAN-${datePart}-${random}`;
};

const formatItems = (items?: ManifiestoItem[]): string => {
  if (!items || items.length === 0) return "—";
  return items
    .map((it) => {
      const qty = it.quantity ?? 1;
      const name = it.product_name || "Producto";
      const variant = it.variant_name ? ` - ${it.variant_name}` : "";
      return `${qty}x ${name}${variant}`;
    })
    .join("\n");
};

export const generateManifiestoPDF = (data: ManifiestoData): void => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Total de artículos físicos (suma de cantidades)
  const totalArticulos = data.pedidos.reduce((acc, p) => {
    const itemsTotal = (p.items ?? []).reduce((s, i) => s + (i.quantity ?? 1), 0);
    return acc + (itemsTotal || 1); // Si no hay items, asume 1 artículo
  }, 0);

  // ─── Header ───────────────────────────────────────────────────────
  // Brand bar
  doc.setFillColor(13, 148, 136); // teal-600
  doc.rect(0, 0, pageWidth, 22, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Plus Envíos", 14, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Manifiesto de Recogida", pageWidth - 14, 14, { align: "right" });

  // ─── Document info ────────────────────────────────────────────────
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Documento de Soporte de Recogida", 14, 32);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`N° Manifiesto: ${data.manifiestoNumero}`, 14, 38);
  doc.text(`Fecha: ${data.fecha}`, 14, 43);
  doc.text(`Tienda: ${data.storeName}`, 14, 48);
  doc.text(`Total de Paquetes: ${data.pedidos.length}`, 14, 53);
  doc.text(`Total Artículos Físicos: ${totalArticulos}`, 14, 58);

  // ─── Tabla de paquetes ────────────────────────────────────────────
  const tableData = data.pedidos.map((p) => [
    `#${p.id}`,
    p.numero_guia || "—",
    p.cliente_nombre || "Sin destinatario",
    formatItems(p.items),
    p.municipio || "—",
    "", // Estado Físico (vacío para anotar)
  ]);

  autoTable(doc, {
    startY: 65,
    head: [
      [
        "ID",
        "N° Guía",
        "Destinatario",
        "Contenido del Paquete\n(Cant - Producto - Variante)",
        "Ciudad",
        "Estado Físico",
      ],
    ],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [13, 148, 136],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      valign: "middle",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [15, 23, 42],
      valign: "top",
    },
    alternateRowStyles: {
      fillColor: [241, 245, 249],
    },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 26 },
      2: { cellWidth: 36 },
      3: { cellWidth: 60, overflow: "linebreak" },
      4: { cellWidth: 26 },
      5: { cellWidth: 20 },
    },
    margin: { left: 14, right: 14 },
  });

  // ─── Footer ───────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY ?? 80;
  let cursorY = finalY + 10;

  // Total box
  if (cursorY > pageHeight - 60) {
    doc.addPage();
    cursorY = 20;
  }

  doc.setFillColor(13, 148, 136);
  doc.setTextColor(255, 255, 255);
  doc.roundedRect(14, cursorY, pageWidth - 28, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    `Total Paquetes: ${data.pedidos.length}   ·   Total Artículos Físicos: ${totalArticulos}`,
    pageWidth / 2,
    cursorY + 9,
    { align: "center" },
  );

  cursorY += 28;

  // Signatures (two columns)
  doc.setTextColor(15, 23, 42);
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);

  const sigY = Math.min(cursorY + 20, pageHeight - 30);
  const col1X = 30;
  const col2X = pageWidth - 30 - 60;
  const sigW = 60;

  doc.line(col1X, sigY, col1X + sigW, sigY);
  doc.line(col2X, sigY, col2X + sigW, sigY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Entrega (Tienda)", col1X + sigW / 2, sigY + 5, { align: "center" });
  doc.text("Recibe (Transportador)", col2X + sigW / 2, sigY + 5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Nombre / C.C. / Firma", col1X + sigW / 2, sigY + 10, { align: "center" });
  doc.text("Nombre / C.C. / Firma", col2X + sigW / 2, sigY + 10, { align: "center" });

  // Footer note
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Generado por Plus Envíos · ${new Date().toLocaleString("es-CO")} · Conservar para auditoría`,
    pageWidth / 2,
    pageHeight - 8,
    { align: "center" },
  );

  // Save
  doc.save(`${data.manifiestoNumero}.pdf`);
};
