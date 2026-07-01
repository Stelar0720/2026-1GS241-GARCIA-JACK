import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import {
  createProduct,
  deleteProduct,
  getActiveProduct,
  getInventoryStock,
  listInventory,
  listOrders,
  listOrdersByBuyer,
  listPendingOrders,
  listProducts,
  OrderStatus,
  ProductInput,
  ProductRecord,
  updateInventory,
  updateOrderStatus,
  updateProduct,
  upsertOrderFromCheckout,
} from "./db";

const port = Number(process.env.API_PORT || 4000);
const uploadsDir = join(process.cwd(), "public", "uploads");
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const processedEvents = new Set<string>();
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

function getCorsHeaders(origin: string | null) {
  const safeOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": safeOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Stripe-Signature",
  };
}

function jsonResponse(body: unknown, options: { status?: number; origin?: string | null } = {}) {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: getCorsHeaders(options.origin ?? null),
  });
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
  ? new Stripe(stripeSecretKey, { apiVersion: "2026-03-25.dahlia" })
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

function buildCheckoutLines(items: CheckoutLineInput[]) {
  const lines: CheckoutLine[] = [];

  for (const item of items) {
    const product = getActiveProduct(item.productId);
    if (!product) {
      return { error: "Uno de los productos del carrito no es vÃ¡lido." };
    }

    if (getInventoryStock(product.id) < item.quantity) {
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

function upsertOrdersFromCheckoutSession(params: {
  session: Stripe.Checkout.Session;
  fallbackProductId: string;
  fallbackBuyerId: string;
  fallbackBuyerEmail?: string | null;
  status: OrderStatus;
}) {
  const buyerId = params.session.metadata?.buyerId ?? params.fallbackBuyerId;
  const buyerEmail =
    params.session.customer_details?.email ??
    params.session.customer_email ??
    params.fallbackBuyerEmail ??
    null;

  for (const line of readCheckoutLinesFromSession(params.session, params.fallbackProductId)) {
    upsertOrderFromCheckout({
      checkoutSessionId: getCheckoutOrderId(params.session.id, line.productId),
      productId: line.productId,
      buyerId,
      buyerEmail,
      status: params.status,
      quantity: line.quantity,
      amountUsd: line.amountUsd,
    });
  }
}

async function refreshPendingOrdersWithStripe() {
  if (!stripeClient) return;

  const pendingOrders = listPendingOrders();
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

      upsertOrdersFromCheckoutSession({
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

    upsertOrdersFromCheckoutSession({
      session,
      fallbackProductId: session.metadata?.productId ?? "unknown-product",
      fallbackBuyerId: sessionBuyerId || buyerId,
      fallbackBuyerEmail: sessionEmail || normalizedEmail,
      status: syncedStatus,
    });
  }
}

Bun.serve({
  port,
  async fetch(req) {
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
          db: process.env.BUN_DB_PATH?.trim() || "./data/urbansprout.sqlite",
        },
        { origin },
      );
    }

    if (req.method === "GET" && url.pathname === "/products") {
      const includeInactive = url.searchParams.get("includeInactive") === "true";
      return jsonResponse({ data: listProducts({ includeInactive }) }, { origin });
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

      return jsonResponse({ data: createProduct(parsed.data) }, { status: 201, origin });
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

        const product = updateProduct(productId, parsed.data);
        if (!product) {
          return jsonResponse({ error: "Producto no encontrado." }, { status: 404, origin });
        }

        return jsonResponse({ data: product }, { origin });
      }

      if (req.method === "DELETE") {
        const deleted = deleteProduct(productId);
        if (!deleted) {
          return jsonResponse({ error: "Producto no encontrado." }, { status: 404, origin });
        }

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

      const parsedLines = buildCheckoutLines(normalizeCheckoutLines(body));
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

      try {
        const session = await stripeClient.checkout.sessions.create({
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

        for (const line of checkoutLines) {
          upsertOrderFromCheckout({
            checkoutSessionId: getCheckoutOrderId(session.id, line.product.id),
            productId: line.product.id,
            buyerId,
            buyerEmail: normalizedEmail ?? null,
            status: "pending",
            quantity: line.quantity,
            amountUsd: line.amountUsd,
          });
        }

        return jsonResponse({ checkoutUrl: session.url }, { origin });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error al crear la sesión de Stripe.";
        return jsonResponse({ error: message }, { status: 500, origin });
      }
    }

    if (req.method === "GET" && url.pathname === "/orders") {
      await refreshPendingOrdersWithStripe();
      return jsonResponse({ data: listOrders() }, { origin });
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
      return jsonResponse({ data: listOrdersByBuyer(buyerId, buyerEmail) }, { origin });
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

      updateOrderStatus(orderId, body.status);
      return jsonResponse({ ok: true }, { origin });
    }

    if (req.method === "GET" && url.pathname === "/inventory") {
      return jsonResponse({ data: listInventory() }, { origin });
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/inventory/")) {
      const sku = decodeURIComponent(url.pathname.split("/").at(-1) || "");
      if (!sku) {
        return jsonResponse({ error: "SKU inválido." }, { status: 400, origin });
      }

      const body = (await req.json()) as { stock?: number; minimumStock?: number };
      if (typeof body.stock !== "number") {
        return jsonResponse({ error: "Stock es requerido." }, { status: 400, origin });
      }

      updateInventory({ sku, stock: body.stock, minimumStock: body.minimumStock ?? 0 });
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

      if (processedEvents.has(event.id)) {
        return jsonResponse({ ok: true, deduplicated: true }, { origin });
      }
      processedEvents.add(event.id);

      if (event.type === "checkout.session.completed" || event.type === "checkout.session.expired") {
        const session = event.data.object as Stripe.Checkout.Session;
        upsertOrdersFromCheckoutSession({
          session,
          fallbackProductId: session.metadata?.productId ?? "unknown-product",
          fallbackBuyerId: session.metadata?.buyerId ?? "unknown-buyer",
          status: event.type === "checkout.session.completed" ? "paid" : "cancelled",
        });
      }

      return jsonResponse({ ok: true }, { origin });
    }

    return jsonResponse({ error: "Ruta no encontrada." }, { status: 404, origin });
  },
});

console.log(`UrbanSprout Bun API running on http://localhost:${port}`);
