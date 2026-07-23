import { describe, expect, test } from "bun:test";
import { escapeHtml, renderOrderEmail } from "./email-template";

describe("template de emails transaccionales (HU-055)", () => {
  test("usa un asunto distinto por estado de la orden", () => {
    const subjects = (["pending", "paid", "cancelled", "refunded", "partially_refunded"] as const).map(
      (status) => renderOrderEmail({ status, orderId: "o-1", productName: "Kit", amountUsd: 10 }).subject,
    );
    expect(new Set(subjects).size).toBe(5);
    expect(renderOrderEmail({ status: "paid", orderId: "o-1", productName: "Kit", amountUsd: 10 }).subject).toContain("Pago confirmado");
  });

  test("distingue un reembolso parcial de uno total", () => {
    const { subject, html } = renderOrderEmail({
      status: "partially_refunded",
      orderId: "o-parcial",
      productName: "Kit",
      amountUsd: 5,
    });
    expect(subject).toContain("parcial");
    expect(html).toContain("Reembolso parcial");
  });

  test("incluye pedido, producto y total formateado", () => {
    const { html } = renderOrderEmail({ status: "paid", orderId: "ord-42", productName: "Kit Balcón", amountUsd: 74.7 });
    expect(html).toContain("ord-42");
    expect(html).toContain("Kit Balcón");
    expect(html).toContain("US$ 74.70");
    // Responsivo: ancho máximo y viewport, que es lo que sostiene CA-149.
    expect(html).toContain("max-width:560px");
    expect(html).toContain("width=device-width");
  });

  test("cae al nombre genérico cuando el producto no existe", () => {
    expect(renderOrderEmail({ status: "pending", orderId: "o", productName: null, amountUsd: 1 }).html).toContain("Kit UrbanSprout");
  });

  test("escapa el contenido interpolado para que no inyecte markup", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    const { html } = renderOrderEmail({ status: "paid", orderId: "<script>", productName: null, amountUsd: 1 });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
