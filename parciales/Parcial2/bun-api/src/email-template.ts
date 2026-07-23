// Template de los emails transaccionales (HU-055, CA-149).
//
// Vive aparte de `notifications.ts` a propósito: acá no se importa la base ni el
// transporte, así el render se prueba como función pura en `test:unit:pure`.

import type { OrderStatus } from "./db";

export type OrderEmailStatus = OrderStatus | "partially_refunded";

const STATUS_COPY: Record<OrderEmailStatus, { subject: string; headline: string; body: string }> = {
  pending: {
    subject: "Recibimos tu pedido en UrbanSprout",
    headline: "Tu pedido está en camino de confirmarse",
    body: "Estamos esperando la confirmación del pago. Te avisamos apenas se acredite.",
  },
  paid: {
    subject: "¡Pago confirmado! Tu kit UrbanSprout ya se prepara",
    headline: "Pago confirmado",
    body: "Recibimos tu pago. Estamos preparando tu kit para despacharlo.",
  },
  cancelled: {
    subject: "Tu pedido de UrbanSprout fue cancelado",
    headline: "Pedido cancelado",
    body: "El pedido quedó cancelado y no se realizó ningún cargo. Puedes volver a intentarlo cuando quieras.",
  },
  refunded: {
    subject: "Procesamos el reembolso de tu pedido UrbanSprout",
    headline: "Reembolso procesado",
    body: "El reembolso ya fue enviado a tu medio de pago. Suele acreditarse en 5 a 10 días hábiles.",
  },
  partially_refunded: {
    subject: "Procesamos un reembolso parcial de tu pedido UrbanSprout",
    headline: "Reembolso parcial procesado",
    body: "La devolución parcial ya fue enviada a tu medio de pago. El resto de tu pedido conserva su estado pagado.",
  },
};

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );
}

// Tabla centrada con ancho máximo y tipografía de sistema: es lo único que
// renderiza igual en Gmail, Outlook y clientes móviles.
export function renderOrderEmail(input: {
  status: OrderEmailStatus;
  orderId: string;
  productName: string | null;
  amountUsd: number;
}) {
  const copy = STATUS_COPY[input.status];
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(copy.subject)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f4f7f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#16341f">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden">
    <tr><td style="background:#1f7a45;padding:24px;color:#ffffff;font-size:20px;font-weight:700">UrbanSprout</td></tr>
    <tr><td style="padding:24px">
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${escapeHtml(copy.headline)}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3d5847">${escapeHtml(copy.body)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#6b8375">Pedido</td><td style="padding:8px 0;text-align:right"><strong>${escapeHtml(input.orderId)}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#6b8375">Producto</td><td style="padding:8px 0;text-align:right">${escapeHtml(input.productName ?? "Kit UrbanSprout")}</td></tr>
        <tr><td style="padding:8px 0;color:#6b8375">Total</td><td style="padding:8px 0;text-align:right"><strong>US$ ${input.amountUsd.toFixed(2)}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#6b8375">Estado</td><td style="padding:8px 0;text-align:right">${escapeHtml(input.status)}</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:0 24px 24px;font-size:12px;color:#6b8375">Recibes este correo porque hiciste una compra en UrbanSprout.</td></tr>
  </table>
</body></html>`;
  return { subject: copy.subject, html };
}
