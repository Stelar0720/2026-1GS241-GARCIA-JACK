// Métodos de pago guardados con SetupIntents de Stripe (HU-032).
//
// El customer de Stripe se mapea 1:1 con el usuario de Clerk y ese mapeo vive en
// Mongo, no en el token: así el mismo usuario reutiliza sus tarjetas entre
// sesiones y nunca se manda un customerId desde el cliente.
//
// Ningún dato de tarjeta pasa por el API: el frontend confirma el SetupIntent
// contra Stripe directamente con el client_secret y acá solo se listan los
// PaymentMethod ya tokenizados (últimos 4 dígitos y marca).

import type Stripe from "stripe";
import type { Collection } from "mongodb";
import { db, dbReady } from "./db";

type StripeCustomerLink = { userId: string; customerId: string; email: string | null; createdAt: string };

let links: Collection<StripeCustomerLink>;

export async function initializePayments() {
  await dbReady;
  links = db.collection<StripeCustomerLink>("stripe_customers");
  await links.createIndex({ userId: 1 }, { unique: true });
}

export class PaymentsUnavailableError extends Error {}

export async function resolveStripeCustomerId(stripe: Stripe, userId: string, email?: string | null) {
  // `links` queda sin asignar si la inicialización falló. Mejor un 503 explícito
  // que un 500 opaco por leer una propiedad de undefined.
  if (!links) throw new PaymentsUnavailableError("El registro de clientes de Stripe no está disponible.");
  const existing = await links.findOne({ userId });
  if (existing) return existing.customerId;
  const customer = await stripe.customers.create({
    ...(email ? { email } : {}),
    metadata: { clerkUserId: userId },
  });
  try {
    await links.insertOne({
      userId,
      customerId: customer.id,
      email: email?.trim().toLowerCase() || null,
      createdAt: new Date().toISOString(),
    });
    return customer.id;
  } catch (error) {
    const duplicateKey = typeof error === "object" && error !== null && "code" in error && error.code === 11000;
    if (!duplicateKey) throw error;

    // Otra petición ganó la carrera. Reutilizamos su vínculo y eliminamos el
    // customer huérfano que acabamos de crear.
    const winner = await links.findOne({ userId });
    await stripe.customers.del(customer.id).catch((cleanupError) => {
      console.error(`[payments] No se pudo eliminar el customer huérfano ${customer.id}:`, cleanupError);
    });
    if (winner) return winner.customerId;
    throw error;
  }
}

export type SavedPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
};

export async function listPaymentMethods(stripe: Stripe, userId: string, email?: string | null) {
  const customerId = await resolveStripeCustomerId(stripe, userId, email);
  const methods = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 20 });
  return methods.data.map((method) => ({
    id: method.id,
    brand: method.card?.brand ?? "desconocida",
    last4: method.card?.last4 ?? "0000",
    expMonth: method.card?.exp_month ?? null,
    expYear: method.card?.exp_year ?? null,
  }));
}

// Devuelve el client_secret para que el frontend confirme la tarjeta con Stripe.js.
export async function createSetupIntent(stripe: Stripe, userId: string, email?: string | null) {
  const customerId = await resolveStripeCustomerId(stripe, userId, email);
  const intent = await stripe.setupIntents.create({
    customer: customerId,
    usage: "off_session",
    payment_method_types: ["card"],
  });
  return { id: intent.id, clientSecret: intent.client_secret, customerId };
}

// Solo desasocia métodos que pertenecen al customer del usuario autenticado.
export async function detachPaymentMethod(stripe: Stripe, userId: string, paymentMethodId: string) {
  const link = await links.findOne({ userId });
  if (!link) return { detached: false, reason: "sin-customer" as const };
  const method = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (method.customer !== link.customerId) return { detached: false, reason: "ajeno" as const };
  await stripe.paymentMethods.detach(paymentMethodId);
  return { detached: true, reason: null };
}
