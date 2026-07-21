import Stripe from "stripe";
import { Hono } from "hono";
import type { ClientSession } from "mongodb";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import {
  cancelPendingCheckoutOrders,
  addWishlistItem,
  createProduct,
  deleteCoupon,
  deleteProduct,
  generateSalesReport,
  inviteAdminUser,
  getActiveProduct,
  getCoupon,
  getInventoryStock,
  getOrderById,
  getOrderByCheckoutSession,
  listInventory,
  listCoupons,
  listReviews,
  listTaxonomy,
  listWishlist,
  listStockAlerts,
  markOrderRefunded,
  searchAdminUsers,
  listOrders,
  listOrdersByBuyer,
  listPendingOrders,
  listProducts,
  OrderStatus,
  ProductInput,
  ProductRecord,
  queryAuditLogs,
  recordAuditLog,
  removeWishlistItem,
  saveCoupon,
  saveReview,
  hasPurchasedProduct,
  updateInventory,
  updateOrderStatus,
  updateProduct,
  updateAdminUser,
  upsertOrderFromCheckout,
  dbReady,
  db,
  processStripeEventAtomically,
  runInTransaction,
} from "./db";
import {
  extractBearerKey,
  Permission,
  permissionsForRole,
  resolveRole,
  Role,
  roleHasPermission,
  ROLE_PERMISSIONS,
} from "./auth";
import type { AdminUserRole, AdminUserStatus } from "./db";
import { calculateCouponDiscount, calculateLineAmountUsd, canReserveStock, normalizeCheckoutLines, validateProductInput, type CheckoutLineInput } from "./business";
import { apiConfig } from "./config";
import { authenticateCustomer } from "./customer-auth";
import {
  adminUpdateSchema,
  apiKeyInputSchema,
  checkoutInputSchema,
  couponInputSchema,
  couponValidationSchema,
  formatValidationIssues,
  gdprDeleteSchema,
  inviteAdminSchema,
  inventoryUpdateSchema,
  orderStatusSchema,
  productInputSchema,
  refundInputSchema,
  reviewInputSchema,
  safeId,
} from "./validation";
import { rateLimiter, requestIdentity, type RateLimitRule } from "./rate-limit";
import { captureError, getErrorFeed, initializeObservability, queryLogs, resolveError, writeLog, type LogLevel, type ServiceName } from "./observability";
import { createBackup, listBackups, migrateUp, migrationStatus, restoreBackup, rollbackLatestMigration, scheduleDailyBackups } from "./data-ops";
import { authenticateApiKey, createApiKey, initializeApiKeys, listApiKeys, revokeApiKey, rotateApiKey } from "./api-keys";
import { deleteUserData, exportUserData } from "./privacy";
import { invoiceFileName, renderInvoicePdf } from "./invoices";
import { initializeNotifications, listEmails, sendOrderStatusEmail } from "./notifications";
import { getPerformanceSnapshot, recordRequest } from "./performance";
import { createSetupIntent, detachPaymentMethod, initializePayments, listPaymentMethods } from "./payments";

const port = apiConfig.port;
const uploadsDir = join(process.cwd(), "public", "uploads");
const allowedOrigins = apiConfig.allowedOrigins;

if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

function getCorsHeaders(origin: string | null) {
  const safeOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": safeOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,Stripe-Signature,X-Customer-Id",
  };
}

function jsonResponse(body: unknown, options: { status?: number; origin?: string | null } = {}) {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: getCorsHeaders(options.origin ?? null),
  });
}

type ApiErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

function errorResponse(
  code: ApiErrorCode,
  message: string,
  options: { status: number; origin?: string | null; details?: Record<string, unknown> | null },
) {
  return jsonResponse(
    { error: { code, message, details: options.details ?? null } },
    { status: options.status, origin: options.origin },
  );
}

// Resuelve el rol del request y valida el permiso requerido.
// Devuelve el rol si está autorizado, o una Response de error (401/403) si no.
function authorize(
  req: Request,
  permission: Permission,
  origin: string | null,
): { role: Role } | { error: Response } {
  const key = extractBearerKey(req.headers.get("authorization"));
  const role = resolveRole(key);

  if (role === "public") {
    return {
      error: errorResponse("UNAUTHORIZED", "Falta o es inválida la API key (Authorization: Bearer <key>).", { status: 401, origin }),
    };
  }

  if (!roleHasPermission(role, permission)) {
    return {
      error: errorResponse("FORBIDDEN", `El rol '${role}' no tiene el permiso '${permission}'.`, { status: 403, origin, details: { permission } }),
    };
  }

  return { role };
}

async function authenticateCommerceCustomer(req: Request) {
  const clerkIdentity = await authenticateCustomer(req);
  if (clerkIdentity) return clerkIdentity;
  const e2eKey = process.env.MCP_CLIENT_KEY?.trim();
  const suppliedKey = extractBearerKey(req.headers.get("authorization"));
  const userId = req.headers.get("x-customer-id")?.trim();
  return apiConfig.environment === "test" && e2eKey && suppliedKey === e2eKey && userId && safeId.safeParse(userId).success ? { userId } : null;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escapeCell = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCell(row[header])).join(","));
  }
  return lines.join("\n");
}

function makeUploadedImageName(fileName: string) {
  const extension = extname(fileName).toLowerCase();
  const safeExtension = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension)
    ? extension
    : ".jpg";

  return `producto-${randomUUID()}${safeExtension}`;
}

function getImageContentType(fileName: string) {
  const extension = extname(fileName).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/jpeg";
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
const stripeClient = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2026-04-22.dahlia" })
  : null;

type CheckoutLine = {
  product: ProductRecord;
  quantity: number;
  amountUsd: number;
};

function getCheckoutOrderId(sessionId: string, productId: string) {
  return `${sessionId}:${productId}`;
}

async function buildCheckoutLines(items: CheckoutLineInput[]) {
  const lines: CheckoutLine[] = [];

  for (const item of items) {
    const product = await getActiveProduct(item.productId);
    if (!product) {
      return { error: "Uno de los productos del carrito no es vÃ¡lido." };
    }

    if (!canReserveStock(await getInventoryStock(product.id), item.quantity)) {
      return { error: `${product.name} no tiene stock suficiente.` };
    }

    lines.push({
      product,
      quantity: item.quantity,
      amountUsd: calculateLineAmountUsd(product.priceUsd, item.quantity),
    });
  }

  if (lines.length === 0) {
    return { error: "Agrega al menos un producto al carrito." };
  }

  return { data: lines };
}

function readCheckoutLinesFromSession(session: Stripe.Checkout.Session, fallbackProductId: string) {
  const cartItems = session.metadata?.cartItems;
  if (cartItems) {
    try {
      const parsed = JSON.parse(cartItems) as {
        productId?: string;
        quantity?: number;
        amountUsd?: number;
      }[];
      const lines = parsed
        .map((item) => ({
          productId: item.productId?.trim() || "",
          quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
          amountUsd: Number(item.amountUsd) || 0,
        }))
        .filter((item) => item.productId);

      if (lines.length > 0) return lines;
    } catch {
      console.warn(`[checkout] Metadata cartItems invÃ¡lida para ${session.id}`);
    }
  }

  return [
    {
      productId: session.metadata?.productId ?? fallbackProductId,
      quantity: 1,
      amountUsd: (session.amount_total ?? 0) / 100,
    },
  ];
}

async function upsertOrdersFromCheckoutSession(params: {
  session: Stripe.Checkout.Session;
  fallbackProductId: string;
  fallbackBuyerId: string;
  fallbackBuyerEmail?: string | null;
  status: OrderStatus;
  dbSession?: ClientSession;
}) {
  const buyerId = params.session.metadata?.buyerId ?? params.fallbackBuyerId;
  const buyerEmail =
    params.session.customer_details?.email ??
    params.session.customer_email ??
    params.fallbackBuyerEmail ??
    null;

  for (const line of readCheckoutLinesFromSession(params.session, params.fallbackProductId)) {
    await upsertOrderFromCheckout({
      checkoutSessionId: getCheckoutOrderId(params.session.id, line.productId),
      productId: line.productId,
      buyerId,
      buyerEmail,
      status: params.status,
      quantity: line.quantity,
      amountUsd: line.amountUsd,
    }, params.dbSession);
  }
}

async function refreshPendingOrdersWithStripe() {
  if (!stripeClient) return;

  const pendingOrders = await listPendingOrders();
  for (const order of pendingOrders) {
    try {
      const stripeSessionId = order.checkoutSessionId.split(":")[0];
      const session = await stripeClient.checkout.sessions.retrieve(stripeSessionId);
      const syncedStatus: OrderStatus =
        session.payment_status === "paid" || session.status === "complete"
          ? "paid"
          : session.status === "expired"
            ? "cancelled"
            : "pending";

      await upsertOrdersFromCheckoutSession({
        session,
        fallbackProductId: order.productId,
        fallbackBuyerId: order.buyerId,
        status: syncedStatus,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Stripe sync error";
      console.warn(`[orders-sync] checkout ${order.checkoutSessionId}: ${message}`);
    }
  }
}

async function syncBuyerOrdersWithStripe(buyerId: string, buyerEmail?: string | null) {
  if (!stripeClient) return;

  const normalizedEmail = buyerEmail?.trim().toLowerCase() || null;
  const sessions = await stripeClient.checkout.sessions.list({ limit: 100 });

  for (const session of sessions.data) {
    const sessionBuyerId = session.metadata?.buyerId?.trim() || "";
    const sessionEmail = (session.customer_details?.email ?? session.customer_email ?? "")
      .trim()
      .toLowerCase();
    const belongsToBuyer =
      sessionBuyerId === buyerId || Boolean(normalizedEmail && sessionEmail === normalizedEmail);

    if (!belongsToBuyer) continue;

    const syncedStatus: OrderStatus =
      session.payment_status === "paid" || session.status === "complete"
        ? "paid"
        : session.status === "expired"
          ? "cancelled"
          : "pending";

    try {
      await upsertOrdersFromCheckoutSession({
        session,
        fallbackProductId: session.metadata?.productId ?? "unknown-product",
        fallbackBuyerId: sessionBuyerId || buyerId,
        fallbackBuyerEmail: sessionEmail || normalizedEmail,
        status: syncedStatus,
      });
    } catch (error) {
      // Una sesión histórica de Stripe puede no tener metadata de producto.
      // No debe impedir que el cliente consulte las órdenes válidas ya persistidas.
      const message = error instanceof Error ? error.message : "Unknown Stripe sync error";
      console.warn(`[buyer-orders-sync] checkout ${session.id}: ${message}`);
    }
  }
}

async function cancelCheckoutForOrder(order: NonNullable<Awaited<ReturnType<typeof getOrderById>>>) {
  if (order.status === "paid") {
    throw new Error("Una orden pagada requiere un reembolso; no puede cancelarse directamente.");
  }

  const stripeSessionId = order.checkoutSessionId.split(":")[0];
  if (!stripeClient) {
    throw new Error("Stripe no está configurado; no es seguro liberar la reserva.");
  }

  let checkoutSession = await stripeClient.checkout.sessions.retrieve(stripeSessionId);
  if (checkoutSession.status === "open") {
    checkoutSession = await stripeClient.checkout.sessions.expire(stripeSessionId);
  }
  if (checkoutSession.status !== "expired") {
    if (checkoutSession.status === "complete" || checkoutSession.payment_status === "paid") {
      await upsertOrdersFromCheckoutSession({
        session: checkoutSession,
        fallbackProductId: order.productId,
        fallbackBuyerId: order.buyerId,
        fallbackBuyerEmail: order.buyerEmail,
        status: "paid",
      });
    }
    throw new Error("Stripe ya completó el checkout; la orden requiere un reembolso.");
  }

  return cancelPendingCheckoutOrders(stripeSessionId);
}

// Reembolso total o parcial de una orden pagada (HU-030). Stripe es la fuente de
// verdad: si el refund falla, la orden no se toca.
async function refundOrderWithStripe(
  order: NonNullable<Awaited<ReturnType<typeof getOrderById>>>,
  input: { amountUsd?: number; reason: string },
) {
  if (!stripeClient) throw new Error("Stripe no está configurado; no se puede reembolsar.");
  if (order.status !== "paid") {
    throw new Error(`Solo se reembolsan órdenes pagadas. Estado actual: '${order.status}'.`);
  }
  const amountUsd = Number((input.amountUsd ?? order.amountUsd).toFixed(2));
  if (amountUsd > order.amountUsd) {
    throw new Error(`El monto a reembolsar (${amountUsd}) supera el total de la orden (${order.amountUsd}).`);
  }

  const stripeSessionId = order.checkoutSessionId.split(":")[0];
  const session = await stripeClient.checkout.sessions.retrieve(stripeSessionId);
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!paymentIntentId) throw new Error("La sesión de Stripe no tiene un pago asociado que reembolsar.");

  const refund = await stripeClient.refunds.create({
    payment_intent: paymentIntentId,
    amount: Math.round(amountUsd * 100),
    metadata: { orderId: order.id, reason: input.reason },
  });

  return markOrderRefunded(order.id, {
    refundId: refund.id,
    amountUsd,
    reason: input.reason,
    createdAt: new Date().toISOString(),
  });
}

await dbReady;
await migrateUp(db);
await initializeApiKeys(db);
scheduleDailyBackups(db);
await initializeObservability();
await initializeNotifications();
await initializePayments();

const app = new Hono();

app.onError(async (error, context) => {
  await captureError({ service: "api", message: error.message, stack: error.stack, route: context.req.path, action: `${context.req.method} ${context.req.path}` }).catch(() => console.error("[api] Error no controlado", error));
  return errorResponse("INTERNAL_ERROR", "Ocurrió un error interno.", {
    status: 500,
    origin: context.req.header("origin") ?? null,
  });
});

app.use("*", async (context, next) => {
  const startedAt = performance.now();
  await next();
  const durationMs = performance.now() - startedAt;
  // Latencia y tasa de error por endpoint (HU-035).
  recordRequest({ method: context.req.method, path: context.req.path, status: context.res.status, durationMs });
  if (!context.req.path.startsWith("/observability/")) {
    await writeLog({ level: context.res.status >= 500 ? "error" : context.res.status >= 400 ? "warn" : "info", service: "api", message: "http.request", context: { method: context.req.method, path: context.req.path, status: context.res.status, durationMs: Math.round(durationMs) } }).catch(() => undefined);
  }
});

app.all("*", async (context) => {
    const req = context.req.raw;
    const url = new URL(req.url);
    const origin = req.headers.get("origin");

    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(origin),
      });
    }

    const rateLimit = rateLimiter.check(req.method, url.pathname, requestIdentity(req));
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({
        error: {
          code: "RATE_LIMITED",
          message: "Demasiadas solicitudes. Intenta nuevamente más tarde.",
          details: { retryAfter: rateLimit.retryAfter, limit: rateLimit.limit },
        },
      }), {
        status: 429,
        headers: { ...getCorsHeaders(origin), "Retry-After": String(rateLimit.retryAfter) },
      });
    }

    if (req.method === "GET" && url.pathname === "/health") {
      return jsonResponse(
        {
          ok: true,
          service: "urbansprout-bun-api",
          db: "mongodb",
        },
        { origin },
      );
    }

    if (req.method === "GET" && url.pathname === "/products") {
      const includeInactive = url.searchParams.get("includeInactive") === "true";
      return jsonResponse({ data: await listProducts({ includeInactive, category: url.searchParams.get("category") || undefined, tag: url.searchParams.get("tag") || undefined }) }, { origin });
    }

    if (req.method === "GET" && url.pathname === "/products/taxonomy") {
      return jsonResponse({ data: await listTaxonomy() }, { origin });
    }

    if (req.method === "GET" && url.pathname.startsWith("/uploads/")) {
      const fileName = decodeURIComponent(url.pathname.split("/").at(-1) || "");
      if (!fileName || fileName.includes("/") || fileName.includes("\\")) {
        return errorResponse("INVALID_INPUT", "Nombre de imagen inválido.", { status: 400, origin });
      }

      const filePath = join(uploadsDir, fileName);
      if (!existsSync(filePath)) {
        return errorResponse("NOT_FOUND", "Imagen no encontrada.", { status: 404, origin });
      }

      return new Response(Bun.file(filePath), {
        headers: {
          ...getCorsHeaders(origin),
          "Content-Type": getImageContentType(fileName),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    if (req.method === "POST" && url.pathname === "/uploads/product-image") {
      const auth = authorize(req, "catalog:write", origin);
      if ("error" in auth) return auth.error;
      const formData = await req.formData();
      const image = formData.get("image");

      if (!(image instanceof File)) {
        return errorResponse("INVALID_INPUT", "Debes seleccionar una imagen.", { status: 400, origin });
      }

      if (!image.type.startsWith("image/")) {
        return errorResponse("INVALID_INPUT", "El archivo debe ser una imagen.", { status: 400, origin });
      }

      if (image.size > 5 * 1024 * 1024) {
        return errorResponse("INVALID_INPUT", "La imagen no puede superar 5 MB.", { status: 400, origin, details: { maxBytes: 5 * 1024 * 1024 } });
      }

      const fileName = makeUploadedImageName(image.name);
      await Bun.write(join(uploadsDir, fileName), image);

      return jsonResponse({ imageUrl: `${url.origin}/uploads/${fileName}` }, { status: 201, origin });
    }

    if (req.method === "POST" && url.pathname === "/products") {
      const auth = authorize(req, "catalog:write", origin);
      if ("error" in auth) return auth.error;
      const parsed = productInputSchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) {
        return errorResponse("INVALID_INPUT", "Producto inválido.", {
          status: 400,
          origin,
          details: { issues: formatValidationIssues(parsed.error) },
        });
      }

      const created = await createProduct(parsed.data);
      await recordAuditLog({ actor: "backoffice", action: "product.create", resource: created?.id ?? "", details: parsed.data.name });
      return jsonResponse({ data: created }, { status: 201, origin });
    }

    if (url.pathname.startsWith("/products/")) {
      const productId = decodeURIComponent(url.pathname.split("/").at(-1) || "");
      if (!productId) {
        return errorResponse("INVALID_INPUT", "ID de producto inválido.", { status: 400, origin });
      }

      if (req.method === "PATCH") {
        const auth = authorize(req, "catalog:write", origin);
        if ("error" in auth) return auth.error;
        const parsed = productInputSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
          return errorResponse("INVALID_INPUT", "Producto inválido.", {
            status: 400,
            origin,
            details: { issues: formatValidationIssues(parsed.error) },
          });
        }

        const product = await updateProduct(productId, parsed.data);
        if (!product) {
          return errorResponse("NOT_FOUND", "Producto no encontrado.", { status: 404, origin });
        }

        await recordAuditLog({ actor: "backoffice", action: "product.update", resource: productId });
        return jsonResponse({ data: product }, { origin });
      }

      if (req.method === "DELETE") {
        const auth = authorize(req, "catalog:write", origin);
        if ("error" in auth) return auth.error;
        const deleted = await deleteProduct(productId);
        if (!deleted) {
          return errorResponse("NOT_FOUND", "Producto no encontrado.", { status: 404, origin });
        }

        await recordAuditLog({ actor: "backoffice", action: "product.delete", resource: productId });
        return jsonResponse({ ok: true }, { origin });
      }
    }

    if (req.method === "POST" && url.pathname === "/coupons/validate") {
      const parsed = couponValidationSchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return errorResponse("INVALID_INPUT", "Datos del cupón inválidos.", { status: 400, origin, details: { issues: formatValidationIssues(parsed.error) } });
      const coupon = await getCoupon(parsed.data.code);
      const expired = Boolean(coupon?.expiresAt && new Date(coupon.expiresAt).getTime() <= Date.now());
      if (!coupon || !coupon.active || expired || parsed.data.subtotalUsd < coupon.minimumUsd) {
        return errorResponse("INVALID_INPUT", "El cupón no existe, expiró o no cumple el mínimo.", { status: 400, origin });
      }
      const discountUsd = calculateCouponDiscount(parsed.data.subtotalUsd, coupon);
      return jsonResponse({ data: { code: coupon.code, discountUsd, totalUsd: Number((parsed.data.subtotalUsd - discountUsd).toFixed(2)) } }, { origin });
    }

    if (url.pathname === "/coupons" && req.method === "GET") {
      const auth = authorize(req, "catalog:read", origin); if ("error" in auth) return auth.error;
      return jsonResponse({ data: await listCoupons() }, { origin });
    }
    if (url.pathname === "/coupons" && req.method === "POST") {
      const auth = authorize(req, "catalog:write", origin); if ("error" in auth) return auth.error;
      const parsed = couponInputSchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return errorResponse("INVALID_INPUT", "Cupón inválido.", { status: 400, origin, details: { issues: formatValidationIssues(parsed.error) } });
      const data = await saveCoupon(parsed.data); await recordAuditLog({ actor: auth.role, action: "coupon.save", resource: parsed.data.code });
      return jsonResponse({ data }, { status: 201, origin });
    }
    if (url.pathname.startsWith("/coupons/") && req.method === "DELETE") {
      const auth = authorize(req, "catalog:write", origin); if ("error" in auth) return auth.error;
      const code = decodeURIComponent(url.pathname.split("/")[2] || "").toUpperCase();
      if (!await deleteCoupon(code)) return errorResponse("NOT_FOUND", "Cupón no encontrado.", { status: 404, origin });
      return jsonResponse({ ok: true }, { origin });
    }

    const customerWishlistMatch = url.pathname.match(/^\/customers\/([^/]+)\/wishlist(?:\/([^/]+))?$/);
    const simpleWishlistMatch = url.pathname.match(/^\/wishlist(?:\/([^/]+))?$/);
    if (customerWishlistMatch || simpleWishlistMatch) {
      const identity = await authenticateCommerceCustomer(req);
      if (!identity) return errorResponse("UNAUTHORIZED", "Se requiere una sesión válida.", { status: 401, origin });
      const pathUserId = customerWishlistMatch ? decodeURIComponent(customerWishlistMatch[1]) : identity.userId;
      if (pathUserId !== identity.userId) return errorResponse("FORBIDDEN", "No puedes modificar la wishlist de otro cliente.", { status: 403, origin });
      const productId = decodeURIComponent((customerWishlistMatch?.[2] ?? simpleWishlistMatch?.[1]) || "");
      if (req.method === "GET" && !productId) return jsonResponse({ data: await listWishlist(identity.userId) }, { origin });
      if ((req.method === "POST" || req.method === "DELETE") && !safeId.safeParse(productId).success) return errorResponse("INVALID_INPUT", "Producto inválido.", { status: 400, origin });
      if (req.method === "POST") {
        if (!await addWishlistItem(identity.userId, productId)) return errorResponse("NOT_FOUND", "Producto no encontrado.", { status: 404, origin });
        return jsonResponse({ data: await listWishlist(identity.userId) }, { status: 201, origin });
      }
      if (req.method === "DELETE") { await removeWishlistItem(identity.userId, productId); return jsonResponse({ ok: true }, { origin }); }
    }

    const reviewsMatch = url.pathname.match(/^\/products\/([^/]+)\/reviews$/);
    if (reviewsMatch) {
      const productId = decodeURIComponent(reviewsMatch[1]);
      if (!safeId.safeParse(productId).success) return errorResponse("INVALID_INPUT", "Producto inválido.", { status: 400, origin });
      if (req.method === "GET") return jsonResponse(await listReviews(productId), { origin });
      if (req.method === "POST") {
        const identity = await authenticateCommerceCustomer(req);
        if (!identity) return errorResponse("UNAUTHORIZED", "Se requiere una sesión válida.", { status: 401, origin });
        if (!await hasPurchasedProduct(identity.userId, productId)) return errorResponse("FORBIDDEN", "Solo compradores verificados pueden reseñar este producto.", { status: 403, origin });
        const parsed = reviewInputSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return errorResponse("INVALID_INPUT", "Reseña inválida.", { status: 400, origin, details: { issues: formatValidationIssues(parsed.error) } });
        return jsonResponse({ data: await saveReview(identity.userId, productId, parsed.data) }, { status: 201, origin });
      }
    }

    if (req.method === "POST" && url.pathname === "/api/checkout") {
      const parsedBody = checkoutInputSchema.safeParse(await req.json().catch(() => null));
      if (!parsedBody.success) {
        return errorResponse("INVALID_INPUT", "Datos de checkout inválidos.", { status: 400, origin, details: { issues: formatValidationIssues(parsedBody.error) } });
      }
      const body = parsedBody.data;

      if (body.userId) {
        const identity = await authenticateCustomer(req);
        if (!identity) {
          return errorResponse("UNAUTHORIZED", "Se requiere una sesión válida para comprar con una cuenta.", { status: 401, origin });
        }
        if (identity.userId !== body.userId) {
          return errorResponse("FORBIDDEN", "No puedes crear una compra para otro cliente.", { status: 403, origin });
        }
      }

      const parsedLines = await buildCheckoutLines(normalizeCheckoutLines(body));
      if ("error" in parsedLines) {
        return errorResponse("INVALID_INPUT", parsedLines.error ?? "Carrito inválido.", { status: 400, origin });
      }
      const checkoutLines = parsedLines.data;

      const subtotalUsd = Number(checkoutLines.reduce((sum, line) => sum + line.amountUsd, 0).toFixed(2));
      let appliedCoupon: Awaited<ReturnType<typeof getCoupon>> = null;
      let discountUsd = 0;
      if (body.couponCode) {
        appliedCoupon = await getCoupon(body.couponCode);
        const expired = Boolean(appliedCoupon?.expiresAt && new Date(appliedCoupon.expiresAt).getTime() <= Date.now());
        if (!appliedCoupon || !appliedCoupon.active || expired || subtotalUsd < appliedCoupon.minimumUsd) {
          return errorResponse("INVALID_INPUT", "El cupón no es válido para este carrito.", { status: 400, origin });
        }
        discountUsd = calculateCouponDiscount(subtotalUsd, appliedCoupon);
      }

      if (!stripeClient) {
        return errorResponse("SERVICE_UNAVAILABLE", "Configura STRIPE_SECRET_KEY para habilitar checkout.", { status: 503, origin });
      }

      const storefrontUrl = apiConfig.appUrl;
      const normalizedEmail = body.userEmail?.trim().toLowerCase() || undefined;
      const buyerId = body.userId?.trim() || `guest-${Date.now()}`;
      let remainingDiscountCents = Math.round(discountUsd * 100);
      const discountedAmounts = checkoutLines.map((line, index) => {
        const grossCents = Math.round(line.amountUsd * 100);
        const allocated = index === checkoutLines.length - 1
          ? remainingDiscountCents
          : Math.min(remainingDiscountCents, Math.round(discountUsd * 100 * line.amountUsd / subtotalUsd));
        remainingDiscountCents -= allocated;
        return Math.max(0, grossCents - allocated) / 100;
      });
      const cartItems = checkoutLines.map((line, index) => ({
        productId: line.product.id,
        quantity: line.quantity,
        amountUsd: discountedAmounts[index],
      }));

      let checkoutSession: Stripe.Checkout.Session | null = null;
      let stripeCouponId: string | null = null;
      try {
        if (appliedCoupon && discountUsd > 0) {
          const stripeCoupon = await stripeClient.coupons.create({
            duration: "once",
            name: `UrbanSprout ${appliedCoupon.code}`,
            ...(appliedCoupon.type === "percent"
              ? { percent_off: appliedCoupon.value }
              : { amount_off: Math.round(discountUsd * 100), currency: "usd" }),
            metadata: { urbansproutCode: appliedCoupon.code },
          });
          stripeCouponId = stripeCoupon.id;
        }
        checkoutSession = await stripeClient.checkout.sessions.create({
          mode: "payment",
          success_url: `${storefrontUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${storefrontUrl}/checkout/cancelled`,
          customer_email: normalizedEmail,
          discounts: stripeCouponId ? [{ coupon: stripeCouponId }] : undefined,
          metadata: {
            productId: checkoutLines[0].product.id,
            buyerId,
            cartItems: JSON.stringify(cartItems),
            couponCode: appliedCoupon?.code ?? "",
            discountUsd: discountUsd.toFixed(2),
          },
          line_items: checkoutLines.map((line) => ({
              quantity: line.quantity,
              price_data: {
                currency: "usd",
                unit_amount: Math.round(line.product.priceUsd * 100),
                product_data: {
                  name: line.product.name,
                  description: line.product.description,
                },
              },
            })),
        });

        await runInTransaction(async (dbSession) => {
          for (const line of checkoutLines) {
            await upsertOrderFromCheckout({
              checkoutSessionId: getCheckoutOrderId(checkoutSession!.id, line.product.id),
              productId: line.product.id,
              buyerId,
              buyerEmail: normalizedEmail ?? null,
              status: "pending",
              quantity: line.quantity,
              amountUsd: discountedAmounts[checkoutLines.indexOf(line)],
            }, dbSession);
          }
        });

        return jsonResponse({ checkoutUrl: checkoutSession.url, discountUsd }, { origin });
      } catch (error) {
        if (checkoutSession?.id && checkoutSession.status === "open") {
          try {
            await stripeClient.checkout.sessions.expire(checkoutSession.id);
          } catch (expireError) {
            console.error(`[checkout] No se pudo expirar ${checkoutSession.id}`, expireError);
          }
        }
        const message =
          error instanceof Error ? error.message : "Error al crear la sesión de Stripe.";
        const stockConflict = message.includes("Stock insuficiente");
        return errorResponse(stockConflict ? "CONFLICT" : "INTERNAL_ERROR", message, {
          status: stockConflict ? 409 : 500,
          origin,
        });
      }
    }

    if (req.method === "GET" && url.pathname === "/orders") {
      const auth = authorize(req, "orders:read", origin);
      if ("error" in auth) return auth.error;
      await refreshPendingOrdersWithStripe();
      return jsonResponse({ data: await listOrders() }, { origin });
    }

    if (req.method === "GET" && url.pathname.startsWith("/customers/") && url.pathname.endsWith("/orders")) {
      const segments = url.pathname.split("/");
      const buyerId = decodeURIComponent(segments[2] || "").trim();
      if (!buyerId) {
        return errorResponse("INVALID_INPUT", "ID de cliente inválido.", { status: 400, origin });
      }
      const parsedBuyerId = safeId.safeParse(buyerId);
      if (!parsedBuyerId.success) return errorResponse("INVALID_INPUT", "Formato de ID inválido.", { status: 400, origin });
      const identity = await authenticateCustomer(req);
      if (!identity) return errorResponse("UNAUTHORIZED", "Se requiere una sesión válida.", { status: 401, origin });
      if (identity.userId !== parsedBuyerId.data) return errorResponse("FORBIDDEN", "No puedes consultar datos de otro cliente.", { status: 403, origin });

      await refreshPendingOrdersWithStripe();
      await syncBuyerOrdersWithStripe(identity.userId, null);
      return jsonResponse({ data: await listOrdersByBuyer(identity.userId) }, { origin });
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/orders/")) {
      const auth = authorize(req, "orders:cancel", origin);
      if ("error" in auth) return auth.error;
      const orderId = url.pathname.split("/").at(-1);
      if (!orderId) {
        return errorResponse("INVALID_INPUT", "ID de orden inválido.", { status: 400, origin });
      }

      const parsedStatus = orderStatusSchema.safeParse(await req.json().catch(() => null));
      if (!parsedStatus.success) {
        return errorResponse("INVALID_INPUT", "Estado de orden inválido.", { status: 400, origin, details: { issues: formatValidationIssues(parsedStatus.error) } });
      }
      const body = parsedStatus.data;

      const order = await getOrderById(orderId);
      if (!order) {
        return errorResponse("NOT_FOUND", "Orden no encontrada.", { status: 404, origin });
      }
      if (body.status === "cancelled") {
        try {
          await cancelCheckoutForOrder(order);
        } catch (error) {
          const message = error instanceof Error ? error.message : "No se pudo cancelar el checkout.";
          const unavailable = message.startsWith("Stripe no está configurado");
          return errorResponse(unavailable ? "SERVICE_UNAVAILABLE" : "CONFLICT", message, { status: unavailable ? 503 : 409, origin });
        }
      } else {
        await updateOrderStatus(orderId, body.status);
      }
      await recordAuditLog({ actor: "backoffice", action: "order.status", resource: orderId, details: body.status });
      // Notifica al cliente el nuevo estado (HU-055). No debe tumbar la respuesta.
      await sendOrderStatusEmail({
        to: order.buyerEmail,
        status: body.status,
        orderId,
        amountUsd: order.amountUsd,
      }).catch(() => undefined);
      return jsonResponse({ ok: true }, { origin });
    }

    if (req.method === "GET" && url.pathname === "/inventory") {
      const auth = authorize(req, "catalog:read", origin);
      if ("error" in auth) return auth.error;
      return jsonResponse({ data: await listInventory() }, { origin });
    }

    if (req.method === "GET" && url.pathname === "/inventory/alerts") {
      const auth = authorize(req, "catalog:read", origin);
      if ("error" in auth) return auth.error;
      return jsonResponse({ data: await listStockAlerts() }, { origin });
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/inventory/")) {
      const auth = authorize(req, "catalog:write", origin);
      if ("error" in auth) return auth.error;
      const sku = decodeURIComponent(url.pathname.split("/").at(-1) || "");
      if (!sku) {
        return errorResponse("INVALID_INPUT", "SKU inválido.", { status: 400, origin });
      }

      const parsedInventory = inventoryUpdateSchema.safeParse(await req.json().catch(() => null));
      if (!parsedInventory.success) {
        return errorResponse("INVALID_INPUT", "Inventario inválido.", { status: 400, origin, details: { issues: formatValidationIssues(parsedInventory.error) } });
      }
      const body = parsedInventory.data;
      await updateInventory({ sku, stock: body.stock, minimumStock: body.minimumStock });
      await recordAuditLog({ actor: "backoffice", action: "inventory.update", resource: sku, details: `stock=${body.stock}` });
      return jsonResponse({ ok: true }, { origin });
    }

    if (req.method === "POST" && url.pathname === "/webhooks/stripe") {
      if (!stripeClient || !stripeWebhookSecret) {
        return errorResponse("SERVICE_UNAVAILABLE", "Configura STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET para webhooks.", { status: 503, origin });
      }

      const signature = req.headers.get("stripe-signature");
      if (!signature) {
        return errorResponse("INVALID_INPUT", "Falta Stripe-Signature.", { status: 400, origin });
      }

      const payload = await req.text();
      let event: Stripe.Event;

      try {
        event = stripeClient.webhooks.constructEvent(payload, signature, stripeWebhookSecret);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Firma inválida de Stripe.";
        return errorResponse("INVALID_INPUT", message, { status: 400, origin });
      }

      const processed = await processStripeEventAtomically(event.id, event.type, async (dbSession) => {
        if (event.type === "checkout.session.completed" || event.type === "checkout.session.expired") {
          const checkoutSession = event.data.object as Stripe.Checkout.Session;
          await upsertOrdersFromCheckoutSession({
            session: checkoutSession,
            fallbackProductId: checkoutSession.metadata?.productId ?? "unknown-product",
            fallbackBuyerId: checkoutSession.metadata?.buyerId ?? "unknown-buyer",
            status: event.type === "checkout.session.completed" ? "paid" : "cancelled",
            dbSession,
          });
        }
      });

      if (!processed) {
        return jsonResponse({ ok: true, deduplicated: true }, { origin });
      }

      // Confirmación de pago por email (HU-055). Va fuera de la transacción y
      // después del guard de deduplicación, para no mandar el correo dos veces.
      if (event.type === "checkout.session.completed") {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        const buyerEmail = checkoutSession.customer_details?.email ?? checkoutSession.customer_email ?? null;
        for (const line of readCheckoutLinesFromSession(checkoutSession, checkoutSession.metadata?.productId ?? "unknown-product")) {
          const reference = getCheckoutOrderId(checkoutSession.id, line.productId);
          const order = await getOrderByCheckoutSession(reference).catch(() => null);
          await sendOrderStatusEmail({
            to: buyerEmail,
            status: "paid",
            orderId: order?.id ?? reference,
            amountUsd: line.amountUsd,
          }).catch(() => undefined);
        }
      }

      return jsonResponse({ ok: true }, { origin });
    }

    // ========================================================
    // Endpoints autenticados (para el servidor MCP y agentes)
    // ========================================================

    // Devuelve el rol asociado a la key (o "public" si no hay). Sin permiso: lo usa el MCP al arrancar.
    if (req.method === "GET" && url.pathname === "/auth/whoami") {
      const role = resolveRole(extractBearerKey(req.headers.get("authorization")));
      return jsonResponse({ role, permissions: permissionsForRole(role) }, { origin });
    }

    // Matriz completa de roles y permisos (HU-050).
    if (req.method === "GET" && url.pathname === "/auth/roles") {
      const auth = authorize(req, "auth:read", origin);
      if ("error" in auth) return auth.error;
      return jsonResponse({ data: ROLE_PERMISSIONS }, { origin });
    }

    if (req.method === "POST" && (url.pathname === "/observability/logs" || url.pathname === "/observability/errors")) {
      const rawBody = await req.text();
      if (rawBody.length > 32_768) {
        return errorResponse("INVALID_INPUT", "El evento de observabilidad supera 32 KB.", { status: 413, origin });
      }
      let body: Record<string, unknown> | null = null;
      try { body = JSON.parse(rawBody) as Record<string, unknown>; } catch { body = null; }
      const services: ServiceName[] = ["api", "storefront", "backoffice", "mcp"];
      const levels: LogLevel[] = ["info", "warn", "error"];
      if (!body || typeof body.message !== "string" || body.message.length < 1 || body.message.length > 1_000 || !services.includes(body.service as ServiceName)) return errorResponse("INVALID_INPUT", "Evento de observabilidad invÃ¡lido.", { status: 400, origin });
      if (url.pathname.endsWith("/errors")) {
        const context = body.context && typeof body.context === "object" ? body.context as Record<string, unknown> : {};
        const tracked = await captureError({ service: body.service as ServiceName, message: typeof context.errorMessage === "string" ? context.errorMessage : body.message, stack: typeof context.stack === "string" ? context.stack : null, route: typeof body.route === "string" ? body.route : null, userId: null, action: typeof context.action === "string" ? context.action : null, context });
        return jsonResponse({ data: { fingerprint: tracked?.fingerprint } }, { status: 202, origin });
      }
      if (!levels.includes(body.level as LogLevel)) return errorResponse("INVALID_INPUT", "Nivel de log invÃ¡lido.", { status: 400, origin });
      await writeLog({ level: body.level as LogLevel, service: body.service as ServiceName, message: body.message, context: body.context });
      return jsonResponse({ accepted: true }, { status: 202, origin });
    }

    if (req.method === "GET" && url.pathname === "/observability/logs") {
      const auth = authorize(req, "logs:read", origin); if ("error" in auth) return auth.error;
      return jsonResponse({ data: await queryLogs({ service: url.searchParams.get("service") as ServiceName || undefined, level: url.searchParams.get("level") as LogLevel || undefined, from: url.searchParams.get("from") || undefined, to: url.searchParams.get("to") || undefined, limit: Number(url.searchParams.get("limit")) || undefined }) }, { origin });
    }
    if (req.method === "GET" && url.pathname === "/observability/errors") {
      const auth = authorize(req, "errors:read", origin); if ("error" in auth) return auth.error;
      return jsonResponse({ data: await getErrorFeed({ status: url.searchParams.get("status") as "open" | "resolved" || undefined, service: url.searchParams.get("service") as ServiceName || undefined, limit: Number(url.searchParams.get("limit")) || undefined }) }, { origin });
    }
    if (req.method === "PATCH" && url.pathname.startsWith("/observability/errors/") && url.pathname.endsWith("/resolve")) {
      const auth = authorize(req, "errors:resolve", origin); if ("error" in auth) return auth.error;
      const fingerprint = decodeURIComponent(url.pathname.split("/")[3] || ""); const tracked = await resolveError(fingerprint);
      return tracked ? jsonResponse({ data: tracked }, { origin }) : errorResponse("NOT_FOUND", "Error no encontrado.", { status: 404, origin });
    }

    // Configuración en memoria ajustable en runtime (HU-026). En una réplica
    // académica no requiere Redis; reiniciar restaura los límites seguros.
    if (url.pathname === "/rate-limits" && req.method === "GET") {
      const role = resolveRole(extractBearerKey(req.headers.get("authorization")));
      if (role !== "admin") return errorResponse(role === "public" ? "UNAUTHORIZED" : "FORBIDDEN", "Solo un administrador puede consultar rate limits.", { status: role === "public" ? 401 : 403, origin });
      return jsonResponse({ data: rateLimiter.list(), storage: "memory" }, { origin });
    }

    if (url.pathname === "/rate-limits" && req.method === "POST") {
      const role = resolveRole(extractBearerKey(req.headers.get("authorization")));
      if (role !== "admin") return errorResponse(role === "public" ? "UNAUTHORIZED" : "FORBIDDEN", "Solo un administrador puede configurar rate limits.", { status: role === "public" ? 401 : 403, origin });
      const body = (await req.json()) as Partial<RateLimitRule>;
      try {
        const rule = rateLimiter.configure({
          method: body.method ?? "",
          path: body.path ?? "",
          limit: body.limit ?? 0,
          windowSeconds: body.windowSeconds ?? 0,
          ...(body.identity?.trim() ? { identity: body.identity.trim() } : {}),
        });
        await recordAuditLog({ actor: role, action: "rate-limit.configure", resource: `${rule.method} ${rule.path}`, details: JSON.stringify(rule) });
        return jsonResponse({ data: rule, appliedWithoutRestart: true }, { origin });
      } catch (error) {
        return errorResponse("INVALID_INPUT", error instanceof Error ? error.message : "Configuración inválida.", { status: 400, origin });
      }
    }

    // Verifica si un rol tiene un permiso (HU-025, authorize_user).
    if (req.method === "POST" && url.pathname === "/auth/authorize") {
      const auth = authorize(req, "auth:read", origin);
      if ("error" in auth) return auth.error;

      const body = (await req.json()) as { role?: Role; permission?: Permission };
      if (!body.role || !body.permission) {
        return errorResponse("INVALID_INPUT", "Se requieren 'role' y 'permission'.", { status: 400, origin });
      }
      if (!(body.role in ROLE_PERMISSIONS)) {
        return errorResponse("INVALID_INPUT", `Rol desconocido: ${body.role}.`, { status: 400, origin, details: { field: "role" } });
      }

      return jsonResponse(
        { role: body.role, permission: body.permission, allowed: roleHasPermission(body.role, body.permission) },
        { origin },
      );
    }

    // Operaciones de datos MongoDB (HU-048/HU-063). Se protegen con el rol
    // administrativo existente y todas las mutaciones dejan auditoria.
    if (url.pathname === "/admin/migrations" && req.method === "GET") {
      const auth = authorize(req, "users:manage", origin); if ("error" in auth) return auth.error;
      return jsonResponse({ data: await migrationStatus(db) }, { origin });
    }
    if (url.pathname === "/admin/migrations/run" && req.method === "POST") {
      const auth = authorize(req, "users:manage", origin); if ("error" in auth) return auth.error;
      const result = await migrateUp(db);
      await recordAuditLog({ actor: auth.role, action: "migration.run", resource: "mongodb", details: JSON.stringify(result.executed) });
      return jsonResponse({ data: result }, { origin });
    }
    if (url.pathname === "/admin/migrations/rollback" && req.method === "POST") {
      const auth = authorize(req, "users:manage", origin); if ("error" in auth) return auth.error;
      const body = await req.json().catch(() => null) as { confirmation?: string } | null;
      try {
        const result = await rollbackLatestMigration(db, body?.confirmation ?? "");
        await recordAuditLog({ actor: auth.role, action: "migration.rollback", resource: "mongodb", details: String(result.rolledBack) });
        return jsonResponse({ data: result }, { origin });
      } catch (error) {
        return errorResponse("INVALID_INPUT", error instanceof Error ? error.message : "Rollback invalido.", { status: 400, origin });
      }
    }
    if (url.pathname === "/admin/backups" && req.method === "GET") {
      const auth = authorize(req, "users:manage", origin); if ("error" in auth) return auth.error;
      return jsonResponse({ data: await listBackups(db) }, { origin });
    }
    if (url.pathname === "/admin/backups" && req.method === "POST") {
      const auth = authorize(req, "users:manage", origin); if ("error" in auth) return auth.error;
      const backup = await createBackup(db);
      await recordAuditLog({ actor: auth.role, action: "backup.create", resource: backup.id, details: `${backup.documentCount} documents` });
      return jsonResponse({ data: backup }, { status: 201, origin });
    }
    const restoreMatch = url.pathname.match(/^\/admin\/backups\/([^/]+)\/restore$/);
    if (restoreMatch && req.method === "POST") {
      const auth = authorize(req, "users:manage", origin); if ("error" in auth) return auth.error;
      const id = decodeURIComponent(restoreMatch[1]);
      const body = await req.json().catch(() => null) as { confirmation?: string } | null;
      try {
        const restored = await restoreBackup(db, id, body?.confirmation ?? "");
        if (!restored) return errorResponse("NOT_FOUND", "Backup no encontrado.", { status: 404, origin });
        await recordAuditLog({ actor: auth.role, action: "backup.restore", resource: id, details: JSON.stringify(restored.collections) });
        return jsonResponse({ data: restored }, { origin });
      } catch (error) {
        return errorResponse("INVALID_INPUT", error instanceof Error ? error.message : "Restauracion invalida.", { status: 400, origin });
      }
    }

    // API keys para integraciones (HU-027). El secreto solo se devuelve al
    // crear/rotar; MongoDB conserva exclusivamente SHA-256, nunca el token.
    if (url.pathname === "/admin/api-keys" && req.method === "GET") {
      const auth = authorize(req, "users:manage", origin); if ("error" in auth) return auth.error;
      return jsonResponse({ data: await listApiKeys(db) }, { origin });
    }
    if (url.pathname === "/admin/api-keys" && req.method === "POST") {
      const auth = authorize(req, "users:manage", origin); if ("error" in auth) return auth.error;
      const parsed = apiKeyInputSchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return errorResponse("INVALID_INPUT", "API key invalida.", { status: 400, origin, details: { issues: formatValidationIssues(parsed.error) } });
      const created = await createApiKey(db, parsed.data);
      await recordAuditLog({ actor: auth.role, action: "api-key.create", resource: created.apiKey.id, details: created.apiKey.name });
      return jsonResponse({ data: created.apiKey, token: created.token, warning: "Guarda el token ahora; no volvera a mostrarse." }, { status: 201, origin });
    }
    const apiKeyActionMatch = url.pathname.match(/^\/admin\/api-keys\/([^/]+)\/(rotate|revoke)$/);
    if (apiKeyActionMatch && req.method === "POST") {
      const auth = authorize(req, "users:manage", origin); if ("error" in auth) return auth.error;
      const id = decodeURIComponent(apiKeyActionMatch[1]);
      if (apiKeyActionMatch[2] === "rotate") {
        const rotated = await rotateApiKey(db, id);
        if (!rotated) return errorResponse("NOT_FOUND", "API key no encontrada o revocada.", { status: 404, origin });
        await recordAuditLog({ actor: auth.role, action: "api-key.rotate", resource: id, details: `replacement=${rotated.apiKey.id}` });
        return jsonResponse({ data: rotated.apiKey, token: rotated.token, warning: "Guarda el token ahora; no volvera a mostrarse." }, { origin });
      }
      if (!await revokeApiKey(db, id)) return errorResponse("NOT_FOUND", "API key no encontrada o revocada.", { status: 404, origin });
      await recordAuditLog({ actor: auth.role, action: "api-key.revoke", resource: id });
      return jsonResponse({ ok: true }, { origin });
    }

    // Endpoint real de integracion: valida hash, expiracion y permiso.
    if (url.pathname === "/integrations/catalog" && req.method === "GET") {
      const token = extractBearerKey(req.headers.get("authorization"));
      const key = token ? await authenticateApiKey(db, token, "catalog:read") : null;
      if (!key) return errorResponse("UNAUTHORIZED", "API key invalida, expirada o sin permiso catalog:read.", { status: 401, origin });
      await recordAuditLog({ actor: `api-key:${key.id}`, action: "api-key.authenticate", resource: "catalog:read" });
      return jsonResponse({ data: await listProducts(), integration: { keyId: key.id, name: key.name } }, { origin });
    }

    // Derechos del usuario autenticado (HU-065): exportacion portable y
    // borrado de preferencias/reseñas, conservando ordenes anonimizadas.
    if (url.pathname === "/me/data" && req.method === "GET") {
      const identity = await authenticateCommerceCustomer(req);
      if (!identity) return errorResponse("UNAUTHORIZED", "Se requiere una sesion valida.", { status: 401, origin });
      const payload = await exportUserData(db, identity.userId);
      await recordAuditLog({ actor: identity.userId, action: "gdpr.export", resource: "customer-data" });
      return jsonResponse(payload, { origin });
    }
    if (url.pathname === "/me/data" && req.method === "DELETE") {
      const identity = await authenticateCommerceCustomer(req);
      if (!identity) return errorResponse("UNAUTHORIZED", "Se requiere una sesion valida.", { status: 401, origin });
      const parsed = gdprDeleteSchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return errorResponse("INVALID_INPUT", "Confirma con DELETE_MY_DATA.", { status: 400, origin });
      const result = await deleteUserData(db, identity.userId);
      await recordAuditLog({ actor: result.anonymousId, action: "gdpr.delete", resource: "customer-data", details: JSON.stringify({ anonymizedOrders: result.anonymizedOrders, deletedWishlistItems: result.deletedWishlistItems, deletedReviews: result.deletedReviews }) });
      return jsonResponse({ data: result, clerkAccountDeletionRequired: true }, { origin });
    }

    if (url.pathname === "/admin/users" && req.method === "GET") {
      const auth = authorize(req, "users:manage", origin);
      if ("error" in auth) return auth.error;
      return jsonResponse({ data: await searchAdminUsers(url.searchParams.get("q") ?? "") }, { origin });
    }

    if (url.pathname === "/admin/users/invite" && req.method === "POST") {
      const auth = authorize(req, "users:manage", origin);
      if ("error" in auth) return auth.error;
      const parsed = inviteAdminSchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) {
        return errorResponse("INVALID_INPUT", "Datos de invitación inválidos.", {
          status: 400,
          origin,
          details: { issues: formatValidationIssues(parsed.error) },
        });
      }
      const { name, email, role } = parsed.data;
      try {
        const user = await inviteAdminUser({ name, email, role });
        await recordAuditLog({ actor: auth.role, action: "user.invite", resource: user.id, details: email });
        return jsonResponse({ data: user }, { status: 201, origin });
      } catch (error) {
        if (error instanceof Error && error.message.includes("E11000")) {
          return errorResponse("CONFLICT", "Ya existe un usuario con ese email.", { status: 409, origin, details: { field: "email" } });
        }
        throw error;
      }
    }

    const adminUserMatch = url.pathname.match(/^\/admin\/users\/([^/]+)$/);
    if (adminUserMatch && req.method === "PATCH") {
      const auth = authorize(req, "users:manage", origin);
      if ("error" in auth) return auth.error;
      const parsed = adminUpdateSchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) {
        return errorResponse("INVALID_INPUT", "Actualización de usuario inválida.", {
          status: 400,
          origin,
          details: { issues: formatValidationIssues(parsed.error) },
        });
      }
      const body = parsed.data;
      const user = await updateAdminUser(decodeURIComponent(adminUserMatch[1]), body);
      if (!user) return errorResponse("NOT_FOUND", "Usuario no encontrado.", { status: 404, origin });
      await recordAuditLog({ actor: auth.role, action: body.status === "suspended" ? "user.suspend" : "user.update", resource: user.id, details: JSON.stringify(body) });
      return jsonResponse({ data: user }, { origin });
    }

    // Reporte de ventas por período con desglose por producto (HU-067).
    if (req.method === "GET" && url.pathname === "/reports/sales") {
      const auth = authorize(req, "reports:read", origin);
      if ("error" in auth) return auth.error;

      const report = await generateSalesReport({
        from: url.searchParams.get("from")?.trim() || undefined,
        to: url.searchParams.get("to")?.trim() || undefined,
      });
      await recordAuditLog({ actor: auth.role, action: "reports.sales", resource: "orders" });
      return jsonResponse({ data: report }, { origin });
    }

    // Export de datos a CSV o JSON (HU-064).
    if (req.method === "GET" && url.pathname === "/export") {
      const auth = authorize(req, "export:read", origin);
      if ("error" in auth) return auth.error;

      const type = url.searchParams.get("type") || "orders";
      const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
      const rows =
        type === "products"
          ? (await listProducts({ includeInactive: true }) as unknown as Record<string, unknown>[])
          : type === "inventory"
            ? (await listInventory() as Record<string, unknown>[])
            : (await listOrders() as Record<string, unknown>[]);

      await recordAuditLog({ actor: auth.role, action: "export", resource: type, details: format });

      if (format === "csv") {
        return new Response(toCsv(rows), {
          headers: {
            ...getCorsHeaders(origin),
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${type}.csv"`,
          },
        });
      }
      return jsonResponse({ type, count: rows.length, data: rows }, { origin });
    }

    // Consulta del log de auditoría (HU-029).
    if (req.method === "GET" && url.pathname === "/audit-logs") {
      const auth = authorize(req, "audit:read", origin);
      if ("error" in auth) return auth.error;

      const logs = await queryAuditLogs({
        actor: url.searchParams.get("actor")?.trim() || undefined,
        action: url.searchParams.get("action")?.trim() || undefined,
        from: url.searchParams.get("from")?.trim() || undefined,
        to: url.searchParams.get("to")?.trim() || undefined,
        limit: Number(url.searchParams.get("limit")) || undefined,
      });
      return jsonResponse({ data: logs }, { origin });
    }

    // Métricas de rendimiento agregadas: P50/P95/P99, tasa 4xx/5xx y uptime (HU-035).
    if (req.method === "GET" && url.pathname === "/observability/performance") {
      const auth = authorize(req, "perf:read", origin);
      if ("error" in auth) return auth.error;
      return jsonResponse({ data: getPerformanceSnapshot({ route: url.searchParams.get("route")?.trim() || undefined }) }, { origin });
    }

    // Factura en PDF de una orden (HU-033). La descarga el dueño de la orden con
    // su JWT de Clerk, o un rol con orders:read desde el backoffice.
    const invoiceMatch = url.pathname.match(/^\/orders\/([^/]+)\/invoice$/);
    if (req.method === "GET" && invoiceMatch) {
      // Se autentica antes de tocar la base: así un anónimo no puede sondear
      // qué IDs de orden existen a partir de la diferencia entre 404 y 401.
      const identity = await authenticateCommerceCustomer(req);
      const isStaff = roleHasPermission(resolveRole(extractBearerKey(req.headers.get("authorization"))), "orders:read");
      if (!identity && !isStaff) {
        return errorResponse("UNAUTHORIZED", "Necesitas iniciar sesión para descargar tu factura.", { status: 401, origin });
      }

      const orderId = decodeURIComponent(invoiceMatch[1]);
      const order = await getOrderById(orderId);
      if (!order) return errorResponse("NOT_FOUND", "Orden no encontrada.", { status: 404, origin });
      if (!isStaff && identity?.userId !== order.buyerId) {
        return errorResponse("FORBIDDEN", "No puedes descargar la factura de otra cuenta.", { status: 403, origin });
      }
      if (order.status !== "paid" && order.status !== "refunded") {
        return errorResponse("CONFLICT", `Solo las órdenes pagadas tienen factura. Estado actual: '${order.status}'.`, { status: 409, origin, details: { currentStatus: order.status } });
      }

      const product = await getActiveProduct(order.productId).catch(() => null);
      const pdf = renderInvoicePdf({
        orderId: order.id,
        createdAt: order.createdAt,
        status: order.status,
        buyerEmail: order.buyerEmail,
        buyerId: order.buyerId,
        productName: product?.name ?? null,
        quantity: order.quantity,
        amountUsd: order.amountUsd,
        refund: order.refund ?? null,
      });
      return new Response(pdf, {
        headers: {
          ...getCorsHeaders(origin),
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${invoiceFileName(order.id)}"`,
        },
      });
    }

    // Bandeja de salida de notificaciones por email (HU-055). Deja evidencia
    // consultable de cada aviso enviado sin exponer el HTML completo.
    if (req.method === "GET" && url.pathname === "/notifications") {
      const auth = authorize(req, "orders:read", origin);
      if ("error" in auth) return auth.error;

      return jsonResponse({
        data: await listEmails({
          orderId: url.searchParams.get("orderId")?.trim() || undefined,
          to: url.searchParams.get("to")?.trim() || undefined,
          limit: Number(url.searchParams.get("limit")) || undefined,
        }),
      }, { origin });
    }

    // Cancela una orden pendiente (HU-066), con guard de estado.
    if (req.method === "POST" && url.pathname.startsWith("/orders/") && url.pathname.endsWith("/cancel")) {
      const auth = authorize(req, "orders:cancel", origin);
      if ("error" in auth) return auth.error;

      const orderId = decodeURIComponent(url.pathname.split("/")[2] || "");
      const order = await getOrderById(orderId);
      if (!order) {
        return errorResponse("NOT_FOUND", "Orden no encontrada.", { status: 404, origin });
      }
      if (order.status !== "pending") {
        return errorResponse("CONFLICT", `No se puede cancelar una orden en estado '${order.status}'. Solo 'pending'.`, {
          status: 409,
          origin,
          details: { currentStatus: order.status },
        });
      }

      try {
        await cancelCheckoutForOrder(order);
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo cancelar el checkout.";
        const unavailable = message.startsWith("Stripe no está configurado");
        return errorResponse(unavailable ? "SERVICE_UNAVAILABLE" : "CONFLICT", message, { status: unavailable ? 503 : 409, origin });
      }
      await recordAuditLog({ actor: auth.role, action: "order.cancel", resource: orderId });
      return jsonResponse({ ok: true, order: await getOrderById(orderId) }, { origin });
    }

    // Dispara la sincronización de órdenes pendientes con Stripe (HU-031).
    if (req.method === "POST" && url.pathname === "/orders/sync") {
      const auth = authorize(req, "orders:sync", origin);
      if ("error" in auth) return auth.error;

      const before = (await listPendingOrders()).length;
      await refreshPendingOrdersWithStripe();
      const after = (await listPendingOrders()).length;
      await recordAuditLog({ actor: auth.role, action: "orders.sync", resource: "orders" });
      return jsonResponse(
        { ok: true, pendingBefore: before, pendingAfter: after, reconciled: Math.max(0, before - after) },
        { origin },
      );
    }

    // Reembolso total o parcial de una orden pagada (HU-030).
    const refundMatch = url.pathname.match(/^\/orders\/([^/]+)\/refund$/);
    if (req.method === "POST" && refundMatch) {
      const auth = authorize(req, "orders:refund", origin);
      if ("error" in auth) return auth.error;

      const parsed = refundInputSchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) {
        return errorResponse("INVALID_INPUT", "Datos de reembolso inválidos.", { status: 400, origin, details: { issues: formatValidationIssues(parsed.error) } });
      }

      const orderId = decodeURIComponent(refundMatch[1]);
      const order = await getOrderById(orderId);
      if (!order) return errorResponse("NOT_FOUND", "Orden no encontrada.", { status: 404, origin });

      let refunded: Awaited<ReturnType<typeof markOrderRefunded>>;
      try {
        refunded = await refundOrderWithStripe(order, parsed.data);
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo procesar el reembolso.";
        const unavailable = message.startsWith("Stripe no está configurado");
        return errorResponse(unavailable ? "SERVICE_UNAVAILABLE" : "CONFLICT", message, { status: unavailable ? 503 : 409, origin });
      }

      await recordAuditLog({
        actor: auth.role,
        action: "order.refund",
        resource: orderId,
        details: JSON.stringify({ amountUsd: parsed.data.amountUsd ?? order.amountUsd, reason: parsed.data.reason }),
      });
      await sendOrderStatusEmail({
        to: order.buyerEmail,
        status: "refunded",
        orderId,
        amountUsd: parsed.data.amountUsd ?? order.amountUsd,
      }).catch(() => undefined);

      return jsonResponse({ ok: true, order: refunded }, { origin });
    }

    // Métodos de pago guardados del cliente autenticado (HU-032).
    // La identidad sale del JWT de Clerk: nunca se acepta un customerId del cliente.
    const paymentMethodMatch = url.pathname.match(/^\/me\/payment-methods(?:\/([^/]+))?$/);
    if (paymentMethodMatch) {
      const identity = await authenticateCommerceCustomer(req);
      if (!identity) {
        return errorResponse("UNAUTHORIZED", "Necesitas iniciar sesión para gestionar tus métodos de pago.", { status: 401, origin });
      }
      if (!stripeClient) {
        return errorResponse("SERVICE_UNAVAILABLE", "Stripe no está configurado en este entorno.", { status: 503, origin });
      }

      const email = req.headers.get("x-customer-email")?.trim().toLowerCase() || null;
      if (req.method === "GET" && !paymentMethodMatch[1]) {
        return jsonResponse({ data: await listPaymentMethods(stripeClient, identity.userId, email) }, { origin });
      }
      if (req.method === "POST" && !paymentMethodMatch[1]) {
        return jsonResponse({ data: await createSetupIntent(stripeClient, identity.userId, email) }, { status: 201, origin });
      }
      if (req.method === "DELETE" && paymentMethodMatch[1]) {
        const result = await detachPaymentMethod(stripeClient, identity.userId, decodeURIComponent(paymentMethodMatch[1]));
        if (!result.detached) {
          return errorResponse("NOT_FOUND", "Ese método de pago no pertenece a tu cuenta.", { status: 404, origin });
        }
        return jsonResponse({ ok: true }, { origin });
      }
    }

    return errorResponse("NOT_FOUND", "Ruta no encontrada.", { status: 404, origin, details: { path: url.pathname } });
  });

Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`UrbanSprout Bun API running on http://localhost:${port}`);
