import Stripe from "stripe";
import { Hono } from "hono";
import type { ClientSession } from "mongodb";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import {
  cancelPendingCheckoutOrders,
  createProduct,
  deleteProduct,
  generateSalesReport,
  getActiveProduct,
  getInventoryStock,
  getOrderById,
  listInventory,
  listStockAlerts,
  listOrders,
  listOrdersByBuyer,
  listPendingOrders,
  listProducts,
  OrderStatus,
  ProductInput,
  ProductRecord,
  queryAuditLogs,
  recordAuditLog,
  updateInventory,
  updateOrderStatus,
  updateProduct,
  upsertOrderFromCheckout,
  dbReady,
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

const port = Number(process.env.PORT || process.env.API_PORT || 4000);
const uploadsDir = join(process.cwd(), "public", "uploads");
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

function getCorsHeaders(origin: string | null) {
  const safeOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": safeOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,Stripe-Signature",
  };
}

function jsonResponse(body: unknown, options: { status?: number; origin?: string | null } = {}) {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: getCorsHeaders(options.origin ?? null),
  });
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
      error: jsonResponse(
        { error: "Falta o es inválida la API key (Authorization: Bearer <key>)." },
        { status: 401, origin },
      ),
    };
  }

  if (!roleHasPermission(role, permission)) {
    return {
      error: jsonResponse(
        { error: `El rol '${role}' no tiene el permiso '${permission}'.` },
        { status: 403, origin },
      ),
    };
  }

  return { role };
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

function readProductInput(body: Partial<ProductInput>) {
  const name = body.name?.trim();
  const description = body.description?.trim();
  const priceUsd = Number(body.priceUsd);
  const tag = body.tag?.trim() ?? "";
  const imageUrl = body.imageUrl?.trim() ?? "";

  if (!name) return { error: "El nombre del producto es requerido." };
  if (!description) return { error: "La descripción del producto es requerida." };
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
    return { error: "El precio debe ser un número positivo." };
  }

  return {
    data: {
      name,
      description,
      priceUsd,
      tag,
      imageUrl,
    },
  };
}

type CheckoutLineInput = {
  productId: string;
  quantity: number;
};

type CheckoutLine = {
  product: ProductRecord;
  quantity: number;
  amountUsd: number;
};

function getCheckoutOrderId(sessionId: string, productId: string) {
  return `${sessionId}:${productId}`;
}

function normalizeCheckoutLines(body: {
  productId?: string;
  items?: { productId?: string; quantity?: number }[];
}) {
  const rawItems =
    Array.isArray(body.items) && body.items.length > 0
      ? body.items
      : body.productId
        ? [{ productId: body.productId, quantity: 1 }]
        : [];

  const quantitiesByProduct = new Map<string, number>();
  for (const item of rawItems) {
    const productId = item.productId?.trim();
    if (!productId) continue;

    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    quantitiesByProduct.set(productId, (quantitiesByProduct.get(productId) ?? 0) + quantity);
  }

  return [...quantitiesByProduct.entries()].map(
    ([productId, quantity]): CheckoutLineInput => ({ productId, quantity }),
  );
}

async function buildCheckoutLines(items: CheckoutLineInput[]) {
  const lines: CheckoutLine[] = [];

  for (const item of items) {
    const product = await getActiveProduct(item.productId);
    if (!product) {
      return { error: "Uno de los productos del carrito no es vÃ¡lido." };
    }

    if ((await getInventoryStock(product.id)) < item.quantity) {
      return { error: `${product.name} no tiene stock suficiente.` };
    }

    lines.push({
      product,
      quantity: item.quantity,
      amountUsd: product.priceUsd * item.quantity,
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

await dbReady;

const app = new Hono();

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
      return jsonResponse({ data: await listProducts({ includeInactive }) }, { origin });
    }

    if (req.method === "GET" && url.pathname.startsWith("/uploads/")) {
      const fileName = decodeURIComponent(url.pathname.split("/").at(-1) || "");
      if (!fileName || fileName.includes("/") || fileName.includes("\\")) {
        return jsonResponse({ error: "Nombre de imagen inválido." }, { status: 400, origin });
      }

      const filePath = join(uploadsDir, fileName);
      if (!existsSync(filePath)) {
        return jsonResponse({ error: "Imagen no encontrada." }, { status: 404, origin });
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
      const formData = await req.formData();
      const image = formData.get("image");

      if (!(image instanceof File)) {
        return jsonResponse({ error: "Debes seleccionar una imagen." }, { status: 400, origin });
      }

      if (!image.type.startsWith("image/")) {
        return jsonResponse({ error: "El archivo debe ser una imagen." }, { status: 400, origin });
      }

      if (image.size > 5 * 1024 * 1024) {
        return jsonResponse({ error: "La imagen no puede superar 5 MB." }, { status: 400, origin });
      }

      const fileName = makeUploadedImageName(image.name);
      await Bun.write(join(uploadsDir, fileName), image);

      return jsonResponse({ imageUrl: `${url.origin}/uploads/${fileName}` }, { status: 201, origin });
    }

    if (req.method === "POST" && url.pathname === "/products") {
      const parsed = readProductInput((await req.json()) as Partial<ProductInput>);
      if ("error" in parsed) {
        return jsonResponse({ error: parsed.error }, { status: 400, origin });
      }

      const created = await createProduct(parsed.data);
      await recordAuditLog({ actor: "backoffice", action: "product.create", resource: created?.id ?? "", details: parsed.data.name });
      return jsonResponse({ data: created }, { status: 201, origin });
    }

    if (url.pathname.startsWith("/products/")) {
      const productId = decodeURIComponent(url.pathname.split("/").at(-1) || "");
      if (!productId) {
        return jsonResponse({ error: "ID de producto inválido." }, { status: 400, origin });
      }

      if (req.method === "PATCH") {
        const parsed = readProductInput((await req.json()) as Partial<ProductInput>);
        if ("error" in parsed) {
          return jsonResponse({ error: parsed.error }, { status: 400, origin });
        }

        const product = await updateProduct(productId, parsed.data);
        if (!product) {
          return jsonResponse({ error: "Producto no encontrado." }, { status: 404, origin });
        }

        await recordAuditLog({ actor: "backoffice", action: "product.update", resource: productId });
        return jsonResponse({ data: product }, { origin });
      }

      if (req.method === "DELETE") {
        const deleted = await deleteProduct(productId);
        if (!deleted) {
          return jsonResponse({ error: "Producto no encontrado." }, { status: 404, origin });
        }

        await recordAuditLog({ actor: "backoffice", action: "product.delete", resource: productId });
        return jsonResponse({ ok: true }, { origin });
      }
    }

    if (req.method === "POST" && url.pathname === "/api/checkout") {
      if (!stripeClient) {
        return jsonResponse(
          { error: "Configura STRIPE_SECRET_KEY para habilitar checkout." },
          { status: 503, origin },
        );
      }

      const body = (await req.json()) as {
        productId?: string;
        items?: { productId?: string; quantity?: number }[];
        userId?: string | null;
        userEmail?: string | null;
      };

      const parsedLines = await buildCheckoutLines(normalizeCheckoutLines(body));
      if ("error" in parsedLines) {
        return jsonResponse({ error: parsedLines.error }, { status: 400, origin });
      }
      const checkoutLines = parsedLines.data;

      const storefrontUrl = process.env.APP_URL?.trim() || "http://localhost:3000";
      const normalizedEmail = body.userEmail?.trim().toLowerCase() || undefined;
      const buyerId = body.userId?.trim() || `guest-${Date.now()}`;
      const cartItems = checkoutLines.map((line) => ({
        productId: line.product.id,
        quantity: line.quantity,
        amountUsd: line.amountUsd,
      }));

      let checkoutSession: Stripe.Checkout.Session | null = null;
      try {
        checkoutSession = await stripeClient.checkout.sessions.create({
          mode: "payment",
          success_url: `${storefrontUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${storefrontUrl}/checkout/cancelled`,
          customer_email: normalizedEmail,
          metadata: {
            productId: checkoutLines[0].product.id,
            buyerId,
            cartItems: JSON.stringify(cartItems),
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
              amountUsd: line.amountUsd,
            }, dbSession);
          }
        });

        return jsonResponse({ checkoutUrl: checkoutSession.url }, { origin });
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
        return jsonResponse(
          { error: message },
          { status: message.includes("Stock insuficiente") ? 409 : 500, origin },
        );
      }
    }

    if (req.method === "GET" && url.pathname === "/orders") {
      await refreshPendingOrdersWithStripe();
      return jsonResponse({ data: await listOrders() }, { origin });
    }

    if (req.method === "GET" && url.pathname.startsWith("/customers/") && url.pathname.endsWith("/orders")) {
      const segments = url.pathname.split("/");
      const buyerId = decodeURIComponent(segments[2] || "").trim();
      if (!buyerId) {
        return jsonResponse({ error: "ID de cliente inválido." }, { status: 400, origin });
      }
      const buyerEmail = url.searchParams.get("email");

      await refreshPendingOrdersWithStripe();
      await syncBuyerOrdersWithStripe(buyerId, buyerEmail);
      return jsonResponse({ data: await listOrdersByBuyer(buyerId, buyerEmail) }, { origin });
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/orders/")) {
      const orderId = url.pathname.split("/").at(-1);
      if (!orderId) {
        return jsonResponse({ error: "ID de orden inválido." }, { status: 400, origin });
      }

      const body = (await req.json()) as { status?: OrderStatus };
      if (!body.status || !["pending", "paid", "cancelled"].includes(body.status)) {
        return jsonResponse({ error: "Estado de orden inválido." }, { status: 400, origin });
      }

      const order = await getOrderById(orderId);
      if (!order) {
        return jsonResponse({ error: "Orden no encontrada." }, { status: 404, origin });
      }
      if (body.status === "cancelled") {
        try {
          await cancelCheckoutForOrder(order);
        } catch (error) {
          const message = error instanceof Error ? error.message : "No se pudo cancelar el checkout.";
          return jsonResponse(
            { error: message },
            { status: message.startsWith("Stripe no está configurado") ? 503 : 409, origin },
          );
        }
      } else {
        await updateOrderStatus(orderId, body.status);
      }
      await recordAuditLog({ actor: "backoffice", action: "order.status", resource: orderId, details: body.status });
      return jsonResponse({ ok: true }, { origin });
    }

    if (req.method === "GET" && url.pathname === "/inventory") {
      return jsonResponse({ data: await listInventory() }, { origin });
    }

    if (req.method === "GET" && url.pathname === "/inventory/alerts") {
      return jsonResponse({ data: await listStockAlerts() }, { origin });
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/inventory/")) {
      const sku = decodeURIComponent(url.pathname.split("/").at(-1) || "");
      if (!sku) {
        return jsonResponse({ error: "SKU inválido." }, { status: 400, origin });
      }

      const body = (await req.json()) as { stock?: number; minimumStock?: number };
      if (!Number.isInteger(body.stock) || body.stock < 0) {
        return jsonResponse({ error: "Stock debe ser un entero positivo." }, { status: 400, origin });
      }
      if (body.minimumStock !== undefined && (!Number.isInteger(body.minimumStock) || body.minimumStock < 0)) {
        return jsonResponse({ error: "Stock mínimo debe ser un entero positivo." }, { status: 400, origin });
      }

      await updateInventory({ sku, stock: body.stock, minimumStock: body.minimumStock });
      await recordAuditLog({ actor: "backoffice", action: "inventory.update", resource: sku, details: `stock=${body.stock}` });
      return jsonResponse({ ok: true }, { origin });
    }

    if (req.method === "POST" && url.pathname === "/webhooks/stripe") {
      if (!stripeClient || !stripeWebhookSecret) {
        return jsonResponse(
          { error: "Configura STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET para webhooks." },
          { status: 503, origin },
        );
      }

      const signature = req.headers.get("stripe-signature");
      if (!signature) {
        return jsonResponse({ error: "Falta Stripe-Signature." }, { status: 400, origin });
      }

      const payload = await req.text();
      let event: Stripe.Event;

      try {
        event = stripeClient.webhooks.constructEvent(payload, signature, stripeWebhookSecret);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Firma inválida de Stripe.";
        return jsonResponse({ error: message }, { status: 400, origin });
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

    // Verifica si un rol tiene un permiso (HU-025, authorize_user).
    if (req.method === "POST" && url.pathname === "/auth/authorize") {
      const auth = authorize(req, "auth:read", origin);
      if ("error" in auth) return auth.error;

      const body = (await req.json()) as { role?: Role; permission?: Permission };
      if (!body.role || !body.permission) {
        return jsonResponse({ error: "Se requieren 'role' y 'permission'." }, { status: 400, origin });
      }
      if (!(body.role in ROLE_PERMISSIONS)) {
        return jsonResponse({ error: `Rol desconocido: ${body.role}.` }, { status: 400, origin });
      }

      return jsonResponse(
        { role: body.role, permission: body.permission, allowed: roleHasPermission(body.role, body.permission) },
        { origin },
      );
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

    // Cancela una orden pendiente (HU-066), con guard de estado.
    if (req.method === "POST" && url.pathname.startsWith("/orders/") && url.pathname.endsWith("/cancel")) {
      const auth = authorize(req, "orders:cancel", origin);
      if ("error" in auth) return auth.error;

      const orderId = decodeURIComponent(url.pathname.split("/")[2] || "");
      const order = await getOrderById(orderId);
      if (!order) {
        return jsonResponse({ error: "Orden no encontrada." }, { status: 404, origin });
      }
      if (order.status !== "pending") {
        return jsonResponse(
          { error: `No se puede cancelar una orden en estado '${order.status}'. Solo 'pending'.` },
          { status: 409, origin },
        );
      }

      try {
        await cancelCheckoutForOrder(order);
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo cancelar el checkout.";
        return jsonResponse(
          { error: message },
          { status: message.startsWith("Stripe no está configurado") ? 503 : 409, origin },
        );
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

    return jsonResponse({ error: "Ruta no encontrada." }, { status: 404, origin });
  });

Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`UrbanSprout Bun API running on http://localhost:${port}`);
