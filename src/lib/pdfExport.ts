// PDF Export utility for liquidations
// Uses jsPDF-compatible structure with HTML rendering

interface LiquidacionData {
  id: string;
  fecha: string;
  tipo: "motorizado" | "tienda";
  nombre: string;
  telefono?: string | null;
  pedidosCount: number;
  totalRecaudado: number;
  totalFletes?: number;
  costoEnvios?: number;
  saldoNeto: number;
  pedidoIds: number[];
}

// Format currency in Colombian Pesos
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);
};

// Generate unique liquidation ID
const generateLiquidacionId = (): string => {
  const date = new Date();
  const dateStr = date.toISOString().split("T")[0].replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `LIQ-${dateStr}-${random}`;
};

// Create HTML content for PDF
const createLiquidacionHTML = (data: LiquidacionData): string => {
  const isMotorizado = data.tipo === "motorizado";
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Liquidación ${data.id}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
          background: #fff;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 20px;
          border-bottom: 3px solid #0d9488;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 28px;
          font-weight: 800;
        }
        .logo span:first-child { color: #0d9488; }
        .logo span:last-child { color: #64748b; }
        .doc-info {
          text-align: right;
          color: #64748b;
        }
        .doc-info .id {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
        }
        .doc-info .date {
          font-size: 12px;
        }
        .title {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #64748b;
          font-size: 14px;
          margin-bottom: 30px;
        }
        .recipient {
          background: #f1f5f9;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 30px;
        }
        .recipient-label {
          font-size: 12px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .recipient-name {
          font-size: 20px;
          font-weight: 600;
          color: #0f172a;
        }
        .recipient-phone {
          color: #64748b;
          font-size: 14px;
        }
        .summary {
          margin-bottom: 30px;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .summary-row:last-child {
          border-bottom: none;
        }
        .summary-label {
          color: #475569;
          font-size: 14px;
        }
        .summary-value {
          font-weight: 600;
          font-size: 14px;
          color: #0f172a;
        }
        .summary-value.positive { color: #059669; }
        .summary-value.negative { color: #dc2626; }
        .total-row {
          background: linear-gradient(135deg, #0d9488, #0891b2);
          color: white;
          padding: 20px;
          border-radius: 12px;
          margin-top: 20px;
        }
        .total-row .summary-label {
          color: rgba(255,255,255,0.9);
          font-size: 16px;
        }
        .total-row .summary-value {
          color: white;
          font-size: 24px;
          font-weight: 700;
        }
        .orders-section {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
        }
        .orders-title {
          font-size: 14px;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 10px;
        }
        .orders-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .order-chip {
          background: #e2e8f0;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          color: #475569;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          color: #94a3b8;
          font-size: 12px;
        }
        .signature-section {
          margin-top: 50px;
          display: flex;
          justify-content: space-between;
        }
        .signature-box {
          width: 200px;
          text-align: center;
        }
        .signature-line {
          border-top: 1px solid #64748b;
          padding-top: 8px;
          font-size: 12px;
          color: #64748b;
        }
        @media print {
          body { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">
          <span>Plus</span><span> Envíos</span>
        </div>
        <div class="doc-info">
          <div class="id">${data.id}</div>
          <div class="date">${data.fecha}</div>
        </div>
      </div>

      <h1 class="title">Comprobante de Liquidación</h1>
      <p class="subtitle">${isMotorizado ? "Liquidación de Motorizado" : "Liquidación de Tienda"}</p>

      <div class="recipient">
        <div class="recipient-label">${isMotorizado ? "Motorizado" : "Tienda"}</div>
        <div class="recipient-name">${data.nombre}</div>
        ${data.telefono ? `<div class="recipient-phone">Tel: ${data.telefono}</div>` : ""}
      </div>

      <div class="summary">
        <div class="summary-row">
          <span class="summary-label">Pedidos Entregados</span>
          <span class="summary-value">${data.pedidosCount}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Total Recaudado (Efectivo)</span>
          <span class="summary-value positive">${formatCurrency(data.totalRecaudado)}</span>
        </div>
        ${isMotorizado ? `
        <div class="summary-row">
          <span class="summary-label">Fletes Ganados (-)</span>
          <span class="summary-value negative">${formatCurrency(data.totalFletes || 0)}</span>
        </div>
        ` : `
        <div class="summary-row">
          <span class="summary-label">Costo de Envíos (-)</span>
          <span class="summary-value negative">${formatCurrency(data.costoEnvios || 0)}</span>
        </div>
        `}
      </div>

      <div class="total-row">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="summary-label">${isMotorizado ? "Saldo a Entregar a Bodega" : "Valor Neto a Transferir"}</span>
          <span class="summary-value">${formatCurrency(data.saldoNeto)}</span>
        </div>
      </div>

      <div class="orders-section">
        <div class="orders-title">Pedidos incluidos en esta liquidación:</div>
        <div class="orders-list">
          ${data.pedidoIds.map(id => `<span class="order-chip">#${id}</span>`).join("")}
        </div>
      </div>

      <div class="signature-section">
        <div class="signature-box">
          <div style="height: 60px;"></div>
          <div class="signature-line">Entrega / ${isMotorizado ? "Motorizado" : "Tienda"}</div>
        </div>
        <div class="signature-box">
          <div style="height: 60px;"></div>
          <div class="signature-line">Recibe / Administrador</div>
        </div>
      </div>

      <div class="footer">
        <p>Generado por Plus Envíos • ${new Date().toLocaleString("es-CO")}</p>
        <p>Este documento es un comprobante de liquidación. Conservar para soporte contable.</p>
      </div>
    </body>
    </html>
  `;
};

// Export liquidation as PDF (opens in new window for printing/saving)
export const exportLiquidacionPDF = (data: Omit<LiquidacionData, "id" | "fecha">): void => {
  const fullData: LiquidacionData = {
    ...data,
    id: generateLiquidacionId(),
    fecha: new Date().toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  };

  const htmlContent = createLiquidacionHTML(fullData);

  // Open in new window for printing/saving as PDF
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load, then trigger print dialog
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  }
};

// Export multiple liquidations
export const exportMultipleLiquidaciones = (
  items: Array<Omit<LiquidacionData, "id" | "fecha">>
): void => {
  items.forEach((item, index) => {
    setTimeout(() => {
      exportLiquidacionPDF(item);
    }, index * 500); // Stagger to avoid popup blocking
  });
};
