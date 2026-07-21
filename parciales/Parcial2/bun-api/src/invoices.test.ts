import { describe, expect, test } from "bun:test";
import { invoiceFileName, invoiceTotals, renderInvoicePdf } from "./invoices";

const baseInvoice = {
  orderId: "ord-1234",
  createdAt: "2026-07-18T15:00:00.000Z",
  status: "paid" as const,
  buyerEmail: "cliente@urbansprout.test",
  buyerId: "user_abc",
  productName: "Kit Balcón",
  quantity: 2,
  amountUsd: 74.7,
};

function decode(pdf: Uint8Array) {
  return Buffer.from(pdf).toString("latin1");
}

describe("facturas en PDF (HU-033)", () => {
  test("desglosa subtotal e ITBMS de forma que sumen el total", () => {
    const { subtotal, tax, total } = invoiceTotals(74.7);
    expect(total).toBe(74.7);
    expect(Number((subtotal + tax).toFixed(2))).toBe(74.7);
    expect(tax).toBeGreaterThan(0);
  });

  test("produce un PDF válido con xref y EOF", () => {
    const text = decode(renderInvoicePdf(baseInvoice));
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("xref");
    expect(text).toContain("startxref");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  test("incluye cliente, producto, fecha y totales", () => {
    const text = decode(renderInvoicePdf(baseInvoice));
    expect(text).toContain("ord-1234");
    expect(text).toContain("cliente@urbansprout.test");
    expect(text).toContain("2026-07-18");
    expect(text).toContain("US$ 74.70");
    expect(text).toContain("ITBMS");
  });

  test("agrega el bloque de reembolso solo cuando existe", () => {
    expect(decode(renderInvoicePdf(baseInvoice))).not.toContain("Reembolso aplicado");
    const refunded = renderInvoicePdf({
      ...baseInvoice,
      status: "refunded",
      refund: { refundId: "re_123", amountUsd: 74.7, reason: "Producto danado", createdAt: baseInvoice.createdAt },
    });
    const text = decode(refunded);
    expect(text).toContain("Reembolso aplicado");
    expect(text).toContain("re_123");
  });

  test("sanea el nombre del archivo: fuera separadores y espacios", () => {
    expect(invoiceFileName("ord/../secreto 1")).toBe("factura-ord-..-secreto-1.pdf");
    expect(invoiceFileName('a"b\\c')).toBe("factura-a-b-c.pdf");
  });
});
