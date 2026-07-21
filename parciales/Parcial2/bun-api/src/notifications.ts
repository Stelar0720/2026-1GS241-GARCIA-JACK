// Notificaciones por email de cambios de estado de orden (HU-055).
//
// Cada envío se persiste en `email_outbox` (append-only) antes de intentar la
// entrega. Eso hace la funcionalidad determinística para las pruebas y deja
// evidencia consultable desde el backoffice sin depender de un proveedor real.
//
// ponytail: el transporte es un POST a EMAIL_WEBHOOK_URL (Resend, Mailgun,
// Zapier, lo que sea). Si algún día hace falta SMTP directo, se agrega un
// transporte más acá sin tocar a los llamadores.

import { randomUUID } from "node:crypto";
import type { Collection, Filter } from "mongodb";
import { db, dbReady, type OrderStatus } from "./db";
import { renderOrderEmail } from "./email-template";
import { writeLog } from "./observability";

export type EmailStatus = "queued" | "sent" | "failed" | "skipped";
// El HTML no se persiste: se rearma con `renderOrderEmail` cuando hace falta.
// La bandeja solo necesita dejar constancia de qué se mandó, a quién y si salió.
export type EmailRecord = {
  id: string;
  to: string;
  subject: string;
  template: string;
  orderId: string | null;
  status: EmailStatus;
  error: string | null;
  createdAt: string;
};

let outbox: Collection<EmailRecord>;

export async function initializeNotifications() {
  await dbReady;
  outbox = db.collection<EmailRecord>("email_outbox");
  await Promise.all([
    outbox.createIndex({ createdAt: -1 }),
    outbox.createIndex({ orderId: 1, createdAt: -1 }),
  ]);
}

async function deliver(message: { to: string; subject: string; html: string }): Promise<{ status: EmailStatus; error: string | null }> {
  const webhook = process.env.EMAIL_WEBHOOK_URL?.trim();
  if (!webhook) return { status: "skipped", error: null };
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.EMAIL_WEBHOOK_TOKEN?.trim()
          ? { Authorization: `Bearer ${process.env.EMAIL_WEBHOOK_TOKEN.trim()}` }
          : {}),
      },
      body: JSON.stringify(message),
    });
    if (!response.ok) return { status: "failed", error: `HTTP ${response.status}` };
    return { status: "sent", error: null };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : "error desconocido" };
  }
}

export async function sendOrderStatusEmail(input: {
  to: string | null;
  status: OrderStatus;
  orderId: string;
  productName?: string | null;
  amountUsd: number;
}): Promise<EmailRecord | null> {
  if (!input.to?.trim()) return null;
  const { subject, html } = renderOrderEmail({
    status: input.status,
    orderId: input.orderId,
    productName: input.productName ?? null,
    amountUsd: input.amountUsd,
  });
  const record: EmailRecord = {
    id: randomUUID(),
    to: input.to.trim().toLowerCase(),
    subject,
    template: `order.${input.status}`,
    orderId: input.orderId,
    status: "queued",
    error: null,
    createdAt: new Date().toISOString(),
  };
  await outbox.insertOne({ ...record });
  const result = await deliver({ to: record.to, subject, html });
  await outbox.updateOne({ id: record.id }, { $set: { status: result.status, error: result.error } });
  await writeLog({
    level: result.status === "failed" ? "warn" : "info",
    service: "api",
    message: "email.order_status",
    context: { orderId: input.orderId, status: input.status, delivery: result.status },
  }).catch(() => undefined);
  return { ...record, status: result.status, error: result.error };
}

export async function listEmails(input: { orderId?: string; to?: string; limit?: number } = {}) {
  const filter: Filter<EmailRecord> = {};
  if (input.orderId) filter.orderId = input.orderId;
  if (input.to) filter.to = input.to.trim().toLowerCase();
  return outbox
    .find(filter, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(input.limit ?? 50, 1), 200))
    .toArray();
}
