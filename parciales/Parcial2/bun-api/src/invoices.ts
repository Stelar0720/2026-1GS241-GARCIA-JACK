// Facturas en PDF generadas del lado del servidor (HU-033).
//
// ponytail: el PDF se arma a mano con las fuentes base14 (Helvetica), que todo
// lector trae incorporadas. Un PDF de una página con texto plano son ~60 líneas
// de sintaxis; meter pdfkit/puppeteer para esto serían decenas de MB de
// dependencia. Si algún día la factura necesita logo, tablas con bordes o varias
// páginas, ahí sí conviene cambiar a una librería.

import type { OrderRefund, OrderStatus } from "./db";

const TAX_RATE = 0.07; // ITBMS Panamá

export type InvoiceInput = {
  orderId: string;
  createdAt: string;
  status: OrderStatus;
  buyerEmail: string | null;
  buyerId: string;
  productName: string | null;
  quantity: number;
  amountUsd: number;
  refund?: OrderRefund | null;
};

export function invoiceTotals(amountUsd: number) {
  const total = Number(amountUsd.toFixed(2));
  const subtotal = Number((total / (1 + TAX_RATE)).toFixed(2));
  const tax = Number((total - subtotal).toFixed(2));
  return { subtotal, tax, total, taxRate: TAX_RATE };
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

type Line = { text: string; size: number; bold?: boolean; gap?: number };

function buildContentStream(lines: Line[]) {
  const parts: string[] = ["BT", "1 0 0 1 56 786 Tm", "14 TL"];
  for (const line of lines) {
    parts.push(`/${line.bold ? "F2" : "F1"} ${line.size} Tf`);
    parts.push(`${line.gap ?? Math.round(line.size * 1.6)} TL`);
    parts.push(`(${escapePdfText(line.text)}) Tj T*`);
  }
  parts.push("ET");
  return parts.join("\n");
}

function assemblePdf(contentStream: string): Uint8Array<ArrayBuffer> {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(contentStream, "latin1")} >>\nstream\n${contentStream}\nendstream`,
  ];

  const chunks: Buffer[] = [];
  const offsets: number[] = [];
  let cursor = 0;
  const push = (text: string) => {
    const buffer = Buffer.from(text, "latin1");
    chunks.push(buffer);
    cursor += buffer.length;
  };

  push("%PDF-1.4\n");
  objects.forEach((body, index) => {
    offsets.push(cursor);
    push(`${index + 1} 0 obj\n${body}\nendobj\n`);
  });

  const xrefOffset = cursor;
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    "0000000000 65535 f \n",
    ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
  ].join("");
  push(xref);
  push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return new Uint8Array(Buffer.concat(chunks));
}

export function renderInvoicePdf(input: InvoiceInput): Uint8Array<ArrayBuffer> {
  const { subtotal, tax, total, taxRate } = invoiceTotals(input.amountUsd);
  const issuedAt = new Date(input.createdAt);
  const unit = input.quantity > 0 ? subtotal / input.quantity : subtotal;

  const lines: Line[] = [
    { text: "UrbanSprout", size: 22, bold: true, gap: 30 },
    { text: "Kits de cultivo urbano  ·  Ciudad de Panama", size: 10, gap: 28 },
    { text: `FACTURA ${input.orderId}`, size: 14, bold: true, gap: 24 },
    { text: `Fecha de emision: ${issuedAt.toISOString().slice(0, 10)}`, size: 10 },
    { text: `Estado del pedido: ${input.status}`, size: 10, gap: 26 },
    { text: "Facturar a", size: 11, bold: true },
    { text: `Cliente: ${input.buyerEmail ?? input.buyerId}`, size: 10 },
    { text: `ID de cliente: ${input.buyerId}`, size: 10, gap: 28 },
    { text: "Detalle", size: 11, bold: true },
    { text: "Descripcion                          Cant.     Unitario        Importe", size: 10 },
    { text: "----------------------------------------------------------------------", size: 10 },
    {
      text: `${(input.productName ?? "Kit UrbanSprout").slice(0, 34).padEnd(34)} ${String(input.quantity).padStart(5)}  ${`US$ ${unit.toFixed(2)}`.padStart(12)}  ${`US$ ${subtotal.toFixed(2)}`.padStart(12)}`,
      size: 10,
    },
    { text: "----------------------------------------------------------------------", size: 10, gap: 24 },
    { text: `Subtotal                                             US$ ${subtotal.toFixed(2)}`, size: 10 },
    { text: `ITBMS (${(taxRate * 100).toFixed(0)}%)                                          US$ ${tax.toFixed(2)}`, size: 10 },
    { text: `TOTAL                                                US$ ${total.toFixed(2)}`, size: 12, bold: true, gap: 26 },
  ];

  if (input.refund) {
    lines.push(
      { text: "Reembolso aplicado", size: 11, bold: true },
      { text: `Monto: US$ ${input.refund.amountUsd.toFixed(2)}  ·  Motivo: ${input.refund.reason}`, size: 10 },
      { text: `Referencia Stripe: ${input.refund.refundId}`, size: 10, gap: 26 },
    );
  }

  lines.push(
    { text: "Gracias por cultivar con UrbanSprout.", size: 10 },
    { text: "Documento generado automaticamente. No requiere firma.", size: 9 },
  );

  return assemblePdf(buildContentStream(lines));
}

export function invoiceFileName(orderId: string) {
  return `factura-${orderId.replace(/[^A-Za-z0-9._-]/g, "-")}.pdf`;
}
