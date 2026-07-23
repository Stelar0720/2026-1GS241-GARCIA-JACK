import { randomUUID } from "node:crypto";
import { MongoClient, MongoServerError, type ClientSession, type Collection, type Db, type Filter } from "mongodb";
import { apiConfig } from "./config";

const mongoUri = apiConfig.mongoUri;
const mongoDatabase = apiConfig.mongoDatabase;

const client = new MongoClient(mongoUri);
export let db: Db;

export type OrderStatus = "pending" | "paid" | "cancelled" | "refunded";
export type PendingOrder = { checkoutSessionId: string; productId: string; buyerId: string; amountUsd: number; quantity: number };
export type ProductDetails = {
  level: string;
  light: string;
  space: string;
  harvest: string;
  cycles: string;
  includes: string[];
  steps: { title: string; text: string }[];
  testimonial: { name: string; text: string };
};
export type ProductInput = { name: string; description: string; priceUsd: number; tag: string; category?: string; tags?: string[]; imageUrl: string; details?: ProductDetails | null };
export type ProductRecord = ProductInput & { id: string; active: number; stock: number; minimumStock: number; inventoryUpdatedAt: string | null; createdAt: string; updatedAt: string };
export type AuditLogEntry = { id: string; timestamp: string; actor: string; action: string; resource: string; details: string };
export type AdminUserRole = "support" | "admin";
export type AdminUserStatus = "invited" | "active" | "suspended";
export type AdminUser = { id: string; name: string; email: string; role: AdminUserRole; status: AdminUserStatus; createdAt: string; updatedAt: string };
export type SalesReport = {
  from: string | null; to: string | null; totalOrders: number; paidOrders: number;
  revenueTotalUsd: number; averageOrderValueUsd: number;
  topProduct: { productId: string; productName: string | null; unitsSold: number } | null;
  byProduct: { productId: string; productName: string | null; unitsSold: number; revenueUsd: number }[];
};

type RefundClaim = { amountUsd: number; reason: string; idempotencyKey: string; createdAt: string };
type OrderDocument = { id: string; checkoutSessionId: string; productId: string; buyerId: string; buyerEmail: string | null; status: OrderStatus; quantity: number; amountUsd: number; createdAt: string; updatedAt: string; refund?: OrderRefund | null; refundClaim?: RefundClaim | null };
export type OrderRefund = { refundId: string; amountUsd: number; reason: string; createdAt: string };
type InventoryDocument = { sku: string; stock: number; minimumStock: number; updatedAt: string };
export type StockAlert = InventoryDocument & { type: "low_stock"; deficit: number };
type ProductDocument = ProductInput & { id: string; active: number; createdAt: string; updatedAt: string };
type ProcessedStripeEvent = { eventId: string; type: string; processedAt: string };
export type Coupon = { code: string; type: "percent" | "fixed"; value: number; minimumUsd: number; expiresAt: string | null; active: boolean; createdAt: string; updatedAt: string };
export type Review = { id: string; productId: string; userId: string; rating: number; comment: string; createdAt: string; updatedAt: string };
type WishlistItem = { userId: string; productId: string; createdAt: string };

let orders: Collection<OrderDocument>;
let inventory: Collection<InventoryDocument>;
let products: Collection<ProductDocument>;
let auditLogs: Collection<AuditLogEntry>;
let processedStripeEvents: Collection<ProcessedStripeEvent>;
let adminUsers: Collection<AdminUser>;
let coupons: Collection<Coupon>;
let reviews: Collection<Review>;
let wishlist: Collection<WishlistItem>;

const seedProducts: ProductDocument[] = [
  { id: "kit-balcon-basico", name: "Kit balcón básico", description: "Lechuga, cilantro y cebollín para espacios con 2-3 horas de luz.", priceUsd: 24.9, tag: "Inicio", imageUrl: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop", active: 1, createdAt: "", updatedAt: "" },
  { id: "kit-microverde-rapido", name: "Kit microverde rápido", description: "Microbrotes listos en 7-10 días, ideal para cocinas en apartamentos.", priceUsd: 29.9, tag: "Más vendido", imageUrl: "https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?w=400&h=300&fit=crop", active: 1, createdAt: "", updatedAt: "" },
  { id: "kit-aromaticas-compacto", name: "Kit aromáticas compacto", description: "Albahaca, menta y perejil con guía de poda y riego urbano.", priceUsd: 34.9, tag: "Premium", imageUrl: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=400&h=300&fit=crop", active: 1, createdAt: "", updatedAt: "" },
];
const seedTaxonomy = [
  { category: "Hortalizas", tags: ["Principiantes", "Balcon"] },
  { category: "Microverdes", tags: ["Cosecha rapida", "Interior"] },
  { category: "Aromaticas", tags: ["Cocina", "Compacto"] },
];

async function initialize() {
  await client.connect();
  db = client.db(mongoDatabase);
  orders = db.collection<OrderDocument>("orders"); inventory = db.collection<InventoryDocument>("inventory");
  products = db.collection<ProductDocument>("products"); auditLogs = db.collection<AuditLogEntry>("audit_logs");
  processedStripeEvents = db.collection<ProcessedStripeEvent>("processed_stripe_events");
  adminUsers = db.collection<AdminUser>("admin_users");
  coupons = db.collection<Coupon>("coupons"); reviews = db.collection<Review>("reviews"); wishlist = db.collection<WishlistItem>("wishlist");
  await Promise.all([
    orders.createIndex({ checkoutSessionId: 1 }, { unique: true }), orders.createIndex({ buyerId: 1, createdAt: -1 }),
    orders.createIndex({ buyerEmail: 1, createdAt: -1 }), products.createIndex({ id: 1 }, { unique: true }),
    inventory.createIndex({ sku: 1 }, { unique: true }), auditLogs.createIndex({ timestamp: -1 }),
    processedStripeEvents.createIndex({ eventId: 1 }, { unique: true }),
    adminUsers.createIndex({ email: 1 }, { unique: true }), adminUsers.createIndex({ name: "text", email: "text" }),
    coupons.createIndex({ code: 1 }, { unique: true }), reviews.createIndex({ productId: 1, createdAt: -1 }),
    reviews.createIndex({ productId: 1, userId: 1 }, { unique: true }), wishlist.createIndex({ userId: 1, productId: 1 }, { unique: true }),
  ]);
  const now = new Date().toISOString();
  await Promise.all(seedProducts.flatMap((product, index) => [
    products.updateOne({ id: product.id }, { $set: seedTaxonomy[index], $setOnInsert: { ...product, createdAt: now, updatedAt: now } }, { upsert: true }),
    inventory.updateOne({ sku: product.id }, { $setOnInsert: { sku: product.id, stock: [18, 24, 15][index], minimumStock: [5, 8, 5][index], updatedAt: now } }, { upsert: true }),
  ]));
  await coupons.updateOne({ code: "WELCOME10" }, { $setOnInsert: { code: "WELCOME10", type: "percent", value: 10, minimumUsd: 0, expiresAt: null, active: true, createdAt: now, updatedAt: now } }, { upsert: true });
}

export const dbReady = initialize();
async function ready() { await dbReady; }
async function createInventoryIfMissing(sku: string, session?: ClientSession) { await ready(); const now = new Date().toISOString(); await inventory.updateOne({ sku }, { $setOnInsert: { sku, stock: 0, minimumStock: 0, updatedAt: now } }, { upsert: true, session }); }

export async function listOrders() { await ready(); return orders.find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray(); }
export async function listOrdersByBuyer(buyerId: string, buyerEmail?: string | null) {
  await ready(); const email = buyerEmail?.trim().toLowerCase();
  const filter: Filter<OrderDocument> = email ? { $or: [{ buyerId }, { buyerEmail: email }] } : { buyerId };
  const rows = await orders.find(filter, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
  const productMap = new Map((await products.find({ id: { $in: rows.map((r) => r.productId) } }).toArray()).map((p) => [p.id, p]));
  return rows.map((row) => { const product = productMap.get(row.productId); return { ...row, productName: product?.name ?? null, productDescription: product?.description ?? null, productImageUrl: product?.imageUrl ?? null }; });
}
export async function listPendingOrders(): Promise<PendingOrder[]> { await ready(); return orders.find({ status: "pending" }, { projection: { _id: 0, checkoutSessionId: 1, productId: 1, buyerId: 1, amountUsd: 1, quantity: 1 } }).toArray() as Promise<PendingOrder[]>; }

async function adjustInventory(productId: string, delta: number, session: ClientSession) {
  if (!delta) return;
  await createInventoryIfMissing(productId, session);
  const now = new Date().toISOString();
  const filter: Filter<InventoryDocument> = delta < 0 ? { sku: productId, stock: { $gte: -delta } } : { sku: productId };
  const result = await inventory.updateOne(filter, { $inc: { stock: delta }, $set: { updatedAt: now } }, { session });
  if (result.matchedCount === 0) throw new Error(`Stock insuficiente para ${productId}: se requieren ${-delta} unidades`);
}
function holdsInventory(status: OrderStatus) {
  return status === "pending" || status === "paid";
}

async function reconcileReservedInventory(previous: Pick<OrderDocument, "productId" | "status" | "quantity"> | null, next: Pick<OrderDocument, "productId" | "status" | "quantity">, session: ClientSession) {
  const deltas = new Map<string, number>();
  if (previous && holdsInventory(previous.status)) deltas.set(previous.productId, (deltas.get(previous.productId) ?? 0) + previous.quantity);
  if (holdsInventory(next.status)) deltas.set(next.productId, (deltas.get(next.productId) ?? 0) - next.quantity);
  for (const [productId, delta] of deltas) await adjustInventory(productId, delta, session);
}
export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  await ready();
  await client.withSession(async (session) => session.withTransaction(async () => {
    const previous = await orders.findOne({ id: orderId }, { session });
    if (!previous || previous.status === status) return;
    await reconcileReservedInventory(previous, { ...previous, status }, session);
    await orders.updateOne({ id: orderId }, { $set: { status, updatedAt: new Date().toISOString() } }, { session });
  }));
}
export async function claimOrderRefund(orderId: string, claim: RefundClaim) {
  await ready();
  const expiredBefore = new Date(Date.now() - 5 * 60_000).toISOString();
  const result = await orders.updateOne(
    {
      id: orderId,
      status: "paid",
      refund: { $in: [null, undefined] },
      $or: [
        { refundClaim: { $in: [null, undefined] } },
        { "refundClaim.createdAt": { $lt: expiredBefore } },
      ],
    },
    { $set: { refundClaim: claim, updatedAt: new Date().toISOString() } },
  );
  return result.matchedCount === 1;
}

export async function releaseOrderRefundClaim(orderId: string, idempotencyKey: string) {
  await ready();
  await orders.updateOne(
    { id: orderId, "refundClaim.idempotencyKey": idempotencyKey, refund: { $in: [null, undefined] } },
    { $unset: { refundClaim: "" }, $set: { updatedAt: new Date().toISOString() } },
  );
}

// Registra el único reembolso permitido por orden. Un reembolso total pasa la
// orden a 'refunded'; uno parcial queda 'paid' pero no admite otra devolución.
export async function markOrderRefunded(orderId: string, refund: OrderRefund) {
  await ready();
  return client.withSession(async (session) => session.withTransaction(async () => {
    const previous = await orders.findOne({ id: orderId }, { session });
    if (!previous || previous.refund) return null;
    const total = refund.amountUsd >= previous.amountUsd;
    if (total) await reconcileReservedInventory(previous, { ...previous, status: "refunded" }, session);
    await orders.updateOne(
      { id: orderId },
      {
        $set: { ...(total ? { status: "refunded" as OrderStatus } : {}), refund, updatedAt: new Date().toISOString() },
        $unset: { refundClaim: "" },
      },
      { session },
    );
    return orders.findOne({ id: orderId }, { projection: { _id: 0 }, session });
  }));
}

export async function cancelPendingCheckoutOrders(stripeSessionId: string) {
  await ready();
  const escaped = stripeSessionId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return client.withSession(async (session) => session.withTransaction(async () => {
    const pending = await orders.find(
      { checkoutSessionId: { $regex: `^${escaped}:` }, status: "pending" },
      { session },
    ).toArray();
    for (const order of pending) {
      await reconcileReservedInventory(order, { ...order, status: "cancelled" }, session);
    }
    if (pending.length > 0) {
      await orders.updateMany(
        { id: { $in: pending.map((order) => order.id) }, status: "pending" },
        { $set: { status: "cancelled", updatedAt: new Date().toISOString() } },
        { session },
      );
    }
    return pending.map((order) => order.id);
  }));
}
export async function getInventoryStock(sku: string) { await createInventoryIfMissing(sku); return (await inventory.findOne({ sku }))?.stock ?? 0; }

export async function upsertOrderFromCheckout(params: { checkoutSessionId: string; productId: string; buyerId: string; buyerEmail?: string | null; status: OrderStatus; amountUsd: number; quantity?: number }, session?: ClientSession) {
  await ready();
  const execute = async (activeSession: ClientSession) => {
    const existing = await orders.findOne({ checkoutSessionId: params.checkoutSessionId }, { session: activeSession }); const now = new Date().toISOString(); const quantity = Math.max(1, Math.floor(params.quantity ?? 1));
    const next = { productId: params.productId, status: params.status, quantity };
    await reconcileReservedInventory(existing, next, activeSession);
    if (existing) { await orders.updateOne({ id: existing.id }, { $set: { status: params.status, amountUsd: params.amountUsd, quantity, productId: params.productId, buyerId: params.buyerId, ...(params.buyerEmail ? { buyerEmail: params.buyerEmail.trim().toLowerCase() } : {}), updatedAt: now } }, { session: activeSession }); return; }
    await orders.insertOne({ id: randomUUID(), checkoutSessionId: params.checkoutSessionId, productId: params.productId, buyerId: params.buyerId, buyerEmail: params.buyerEmail?.trim().toLowerCase() || null, status: params.status, quantity, amountUsd: params.amountUsd, createdAt: now, updatedAt: now }, { session: activeSession });
  };
  if (session) return execute(session);
  return client.withSession(async (newSession) => newSession.withTransaction(() => execute(newSession)));
}
export async function listInventory() { await ready(); return inventory.find({}, { projection: { _id: 0 } }).sort({ sku: 1 }).toArray(); }
export async function listStockAlerts(): Promise<StockAlert[]> {
  await ready();
  const rows = await inventory.find(
    { $expr: { $lt: ["$stock", "$minimumStock"] } },
    { projection: { _id: 0 } },
  ).sort({ stock: 1, sku: 1 }).toArray();
  return rows.map((row) => ({ ...row, type: "low_stock", deficit: row.minimumStock - row.stock }));
}
export async function updateInventory(params: { sku: string; stock: number; minimumStock?: number }) { await createInventoryIfMissing(params.sku); await inventory.updateOne({ sku: params.sku }, { $set: { stock: params.stock, ...(params.minimumStock !== undefined ? { minimumStock: params.minimumStock } : {}), updatedAt: new Date().toISOString() } }); }

function makeProductId(name: string) { const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48); return `${slug || "producto"}-${randomUUID().slice(0, 8)}`; }
async function hydrateProduct(product: (ProductDocument & { _id?: unknown }) | null): Promise<ProductRecord | null> { if (!product) return null; const item = await inventory.findOne({ sku: product.id }); const { _id: _ignored, ...clean } = product; return { ...clean, stock: item?.stock ?? 0, minimumStock: item?.minimumStock ?? 0, inventoryUpdatedAt: item?.updatedAt ?? null }; }
export async function listProducts(options: { includeInactive?: boolean; category?: string; tag?: string } = {}) { await ready(); const filter: Filter<ProductDocument> = options.includeInactive ? {} : { active: 1 }; if (options.category) filter.category = options.category; if (options.tag) filter.$or = [{ tag: options.tag }, { tags: options.tag }]; const rows = await products.find(filter).sort({ createdAt: -1 }).toArray(); return (await Promise.all(rows.map(hydrateProduct))).filter((row): row is ProductRecord => row !== null); }
export async function listTaxonomy() { await ready(); const rows = await products.find({ active: 1 }, { projection: { category: 1, tag: 1, tags: 1 } }).toArray(); return { categories: [...new Set(rows.map((row) => row.category).filter((item): item is string => Boolean(item)))].sort(), tags: [...new Set(rows.flatMap((row) => [row.tag, ...(row.tags ?? [])]).filter((item): item is string => Boolean(item)))].sort() }; }
export async function getActiveProduct(productId: string) { await ready(); return hydrateProduct(await products.findOne({ id: productId, active: 1 })); }
export async function createProduct(params: ProductInput) { await ready(); const now = new Date().toISOString(); const product = { ...params, id: makeProductId(params.name), active: 1, createdAt: now, updatedAt: now }; await products.insertOne(product); await createInventoryIfMissing(product.id); return hydrateProduct(product); }
export async function updateProduct(productId: string, params: ProductInput) {
  await ready();
  const { details, ...fields } = params;
  await products.updateOne(
    { id: productId },
    {
      $set: { ...fields, ...(details ? { details } : {}), updatedAt: new Date().toISOString() },
      ...(details === null ? { $unset: { details: "" } } : {}),
    },
  );
  return hydrateProduct(await products.findOne({ id: productId }));
}
export async function deleteProduct(productId: string) { await ready(); return (await products.deleteOne({ id: productId })).deletedCount > 0; }

export async function getCoupon(code: string) { await ready(); return coupons.findOne({ code: code.trim().toUpperCase() }, { projection: { _id: 0 } }); }
export async function saveCoupon(input: Omit<Coupon, "createdAt" | "updatedAt">) { await ready(); const now = new Date().toISOString(); await coupons.updateOne({ code: input.code }, { $set: { ...input, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true }); return getCoupon(input.code); }
export async function deleteCoupon(code: string) { await ready(); return (await coupons.deleteOne({ code: code.trim().toUpperCase() })).deletedCount > 0; }
export async function listCoupons() { await ready(); return coupons.find({}, { projection: { _id: 0 } }).sort({ code: 1 }).toArray(); }

export async function listWishlist(userId: string) { await ready(); const items = await wishlist.find({ userId }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray(); const records = await products.find({ id: { $in: items.map((item) => item.productId) }, active: 1 }).toArray(); const map = new Map(records.map((item) => [item.id, item])); return (await Promise.all(items.map((item) => hydrateProduct(map.get(item.productId) ?? null)))).filter((item): item is ProductRecord => item !== null); }
export async function addWishlistItem(userId: string, productId: string) { await ready(); if (!await products.findOne({ id: productId, active: 1 })) return false; await wishlist.updateOne({ userId, productId }, { $setOnInsert: { userId, productId, createdAt: new Date().toISOString() } }, { upsert: true }); return true; }
export async function removeWishlistItem(userId: string, productId: string) { await ready(); return (await wishlist.deleteOne({ userId, productId })).deletedCount > 0; }

function toPublicReview(review: Review | null) { return review ? { id: review.id, productId: review.productId, authorName: "Comprador verificado", rating: review.rating, comment: review.comment, createdAt: review.createdAt, updatedAt: review.updatedAt } : null; }
export async function listReviews(productId: string) { await ready(); const rows = await reviews.find({ productId }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray(); const data = rows.map(toPublicReview); const average = rows.length ? Number((rows.reduce((sum, item) => sum + item.rating, 0) / rows.length).toFixed(1)) : 0; return { data, summary: { count: rows.length, average } }; }
export async function hasPurchasedProduct(userId: string, productId: string) { await ready(); return Boolean(await orders.findOne({ buyerId: userId, productId, status: "paid" })); }
export async function saveReview(userId: string, productId: string, input: { rating: number; comment: string }) { await ready(); const now = new Date().toISOString(); await reviews.updateOne({ userId, productId }, { $set: { ...input, updatedAt: now }, $setOnInsert: { id: randomUUID(), userId, productId, createdAt: now } }, { upsert: true }); return toPublicReview(await reviews.findOne({ userId, productId }, { projection: { _id: 0 } })); }

export async function recordAuditLog(params: { actor: string; action: string; resource: string; details?: string }) { await ready(); await auditLogs.insertOne({ id: randomUUID(), timestamp: new Date().toISOString(), actor: params.actor, action: params.action, resource: params.resource, details: params.details ?? "" }); }
export async function queryAuditLogs(filters: { actor?: string; action?: string; from?: string; to?: string; limit?: number }): Promise<AuditLogEntry[]> { await ready(); const filter: Filter<AuditLogEntry> = {}; if (filters.actor) filter.actor = filters.actor; if (filters.action) filter.action = filters.action; if (filters.from || filters.to) filter.timestamp = { ...(filters.from ? { $gte: filters.from } : {}), ...(filters.to ? { $lte: filters.to } : {}) }; const limit = Math.max(1, Math.min(Math.floor(filters.limit ?? 100), 500)); return auditLogs.find(filter, { projection: { _id: 0 } }).sort({ timestamp: -1 }).limit(limit).toArray(); }

export async function searchAdminUsers(query = ""): Promise<AdminUser[]> {
  await ready();
  const normalized = query.trim();
  const filter: Filter<AdminUser> = normalized
    ? { $or: [{ name: { $regex: normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }, { email: { $regex: normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }] }
    : {};
  return adminUsers.find(filter, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
}

export async function inviteAdminUser(params: { name: string; email: string; role: AdminUserRole }): Promise<AdminUser> {
  await ready();
  const now = new Date().toISOString();
  const user: AdminUser = { id: randomUUID(), name: params.name.trim(), email: params.email.trim().toLowerCase(), role: params.role, status: "invited", createdAt: now, updatedAt: now };
  await adminUsers.insertOne(user);
  return user;
}

export async function updateAdminUser(userId: string, changes: { role?: AdminUserRole; status?: AdminUserStatus }): Promise<AdminUser | null> {
  await ready();
  await adminUsers.updateOne({ id: userId }, { $set: { ...changes, updatedAt: new Date().toISOString() } });
  return adminUsers.findOne({ id: userId }, { projection: { _id: 0 } });
}

export async function generateSalesReport(filters: { from?: string; to?: string }): Promise<SalesReport> {
  await ready(); const dateFilter = { ...(filters.from ? { $gte: filters.from } : {}), ...(filters.to ? { $lte: filters.to } : {}) }; const base: Filter<OrderDocument> = (filters.from || filters.to) ? { createdAt: dateFilter } : {};
  const all = await orders.find(base).toArray(); const paid = all.filter((o) => o.status === "paid"); const names = new Map((await products.find({ id: { $in: paid.map((o) => o.productId) } }).toArray()).map((p) => [p.id, p.name]));
  const grouped = new Map<string, { productId: string; productName: string | null; unitsSold: number; revenueUsd: number }>();
  for (const order of paid) { const row = grouped.get(order.productId) ?? { productId: order.productId, productName: names.get(order.productId) ?? null, unitsSold: 0, revenueUsd: 0 }; row.unitsSold += order.quantity; row.revenueUsd += order.amountUsd; grouped.set(order.productId, row); }
  const byProduct = [...grouped.values()].sort((a, b) => b.unitsSold - a.unitsSold).map((x) => ({ ...x, revenueUsd: Number(x.revenueUsd.toFixed(2)) })); const revenue = paid.reduce((sum, o) => sum + o.amountUsd, 0);
  return { from: filters.from ?? null, to: filters.to ?? null, totalOrders: all.length, paidOrders: paid.length, revenueTotalUsd: Number(revenue.toFixed(2)), averageOrderValueUsd: paid.length ? Number((revenue / paid.length).toFixed(2)) : 0, topProduct: byProduct[0] ? { productId: byProduct[0].productId, productName: byProduct[0].productName, unitsSold: byProduct[0].unitsSold } : null, byProduct };
}
export async function getOrderById(orderId: string) { await ready(); return orders.findOne({ id: orderId }, { projection: { _id: 0 } }); }
export async function getOrderByCheckoutSession(checkoutSessionId: string) { await ready(); return orders.findOne({ checkoutSessionId }, { projection: { _id: 0 } }); }

export async function hasProcessedStripeEvent(eventId: string) { await ready(); return Boolean(await processedStripeEvents.findOne({ eventId })); }
export async function markStripeEventProcessed(eventId: string, type: string) { await ready(); const result = await processedStripeEvents.updateOne({ eventId }, { $setOnInsert: { eventId, type, processedAt: new Date().toISOString() } }, { upsert: true }); return result.upsertedCount === 1; }
export async function processStripeEventAtomically(eventId: string, type: string, handler: (session: ClientSession) => Promise<void>) {
  await ready();
  try {
    return await client.withSession(async (session) => session.withTransaction(async () => {
      await processedStripeEvents.insertOne({ eventId, type, processedAt: new Date().toISOString() }, { session });
      await handler(session);
      return true;
    }));
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) return false;
    throw error;
  }
}
export async function runInTransaction<T>(handler: (session: ClientSession) => Promise<T>) {
  await ready();
  return client.withSession(async (session) => session.withTransaction(() => handler(session)));
}
export async function closeDatabase() { await client.close(); }
