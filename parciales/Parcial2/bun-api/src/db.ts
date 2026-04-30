import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

const dbPath = process.env.BUN_DB_PATH?.trim() || "./data/urbansprout.sqlite";
const dbDir = dirname(dbPath);
if (dbDir !== "." && !existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath, { create: true });

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    checkout_session_id TEXT UNIQUE NOT NULL,
    product_id TEXT NOT NULL,
    buyer_id TEXT NOT NULL,
    buyer_email TEXT,
    status TEXT NOT NULL,
    amount_usd REAL NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const orderColumns = db.query("PRAGMA table_info(orders)").all() as { name: string }[];
if (!orderColumns.some((column) => column.name === "buyer_email")) {
  db.exec("ALTER TABLE orders ADD COLUMN buyer_email TEXT");
}
if (!orderColumns.some((column) => column.name === "quantity")) {
  db.exec("ALTER TABLE orders ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS inventory (
    sku TEXT PRIMARY KEY,
    stock INTEGER NOT NULL,
    minimum_stock INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price_usd REAL NOT NULL,
    tag TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const inventoryCount = db.query("SELECT COUNT(*) AS count FROM inventory").get() as
  | { count: number }
  | undefined;

if (!inventoryCount || inventoryCount.count === 0) {
  const now = new Date().toISOString();
  const insertInventory = db.query(
    "INSERT INTO inventory (sku, stock, minimum_stock, updated_at) VALUES (?, ?, ?, ?)",
  );
  insertInventory.run("kit-balcon-basico", 18, 5, now);
  insertInventory.run("kit-microverde-rapido", 24, 8, now);
  insertInventory.run("kit-aromaticas-compacto", 15, 5, now);
}

const productCount = db.query("SELECT COUNT(*) AS count FROM products").get() as
  | { count: number }
  | undefined;

if (!productCount || productCount.count === 0) {
  const now = new Date().toISOString();
  const insertProduct = db.query(
    `INSERT INTO products (
      id, name, description, price_usd, tag, image_url, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  insertProduct.run(
    "kit-balcon-basico",
    "Kit balcón básico",
    "Lechuga, cilantro y cebollín para espacios con 2-3 horas de luz.",
    24.9,
    "Inicio",
    "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop",
    1,
    now,
    now,
  );
  insertProduct.run(
    "kit-microverde-rapido",
    "Kit microverde rápido",
    "Microbrotes listos en 7-10 días, ideal para cocinas en apartamentos.",
    29.9,
    "Más vendido",
    "https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?w=400&h=300&fit=crop",
    1,
    now,
    now,
  );
  insertProduct.run(
    "kit-aromaticas-compacto",
    "Kit aromáticas compacto",
    "Albahaca, menta y perejil con guía de poda y riego urbano.",
    34.9,
    "Premium",
    "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=400&h=300&fit=crop",
    1,
    now,
    now,
  );
}

export type OrderStatus = "pending" | "paid" | "cancelled";

export type PendingOrder = {
  checkoutSessionId: string;
  productId: string;
  buyerId: string;
  amountUsd: number;
  quantity: number;
};

export type ProductInput = {
  name: string;
  description: string;
  priceUsd: number;
  tag: string;
  imageUrl: string;
};

export type ProductRecord = ProductInput & {
  id: string;
  active: number;
  stock: number;
  minimumStock: number;
  inventoryUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function createInventoryIfMissing(sku: string) {
  const now = new Date().toISOString();
  db.query(
    `INSERT OR IGNORE INTO inventory (sku, stock, minimum_stock, updated_at)
     VALUES (?, 0, 0, ?)`,
  ).run(sku, now);
}

export function listOrders() {
  return db
    .query(
      `SELECT
        id,
        checkout_session_id AS checkoutSessionId,
        product_id AS productId,
        buyer_id AS buyerId,
        buyer_email AS buyerEmail,
        status,
        quantity,
        amount_usd AS amountUsd,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM orders
      ORDER BY created_at DESC`,
    )
    .all();
}

export function listOrdersByBuyer(buyerId: string, buyerEmail?: string | null) {
  const normalizedEmail = buyerEmail?.trim().toLowerCase() || null;
  const whereClause = normalizedEmail
    ? "WHERE orders.buyer_id = ? OR LOWER(orders.buyer_email) = ?"
    : "WHERE orders.buyer_id = ?";
  const params = normalizedEmail ? [buyerId, normalizedEmail] : [buyerId];

  return db
    .query(
      `SELECT
        orders.id,
        orders.checkout_session_id AS checkoutSessionId,
        orders.product_id AS productId,
        orders.buyer_id AS buyerId,
        orders.buyer_email AS buyerEmail,
        orders.status,
        orders.quantity,
        orders.amount_usd AS amountUsd,
        orders.created_at AS createdAt,
        orders.updated_at AS updatedAt,
        products.name AS productName,
        products.description AS productDescription,
        products.image_url AS productImageUrl
      FROM orders
      LEFT JOIN products ON products.id = orders.product_id
      ${whereClause}
      ORDER BY orders.created_at DESC`,
    )
    .all(...params);
}

export function listPendingOrders(): PendingOrder[] {
  return db
    .query(
      `SELECT
        checkout_session_id AS checkoutSessionId,
        product_id AS productId,
        buyer_id AS buyerId,
        amount_usd AS amountUsd,
        quantity
      FROM orders
      WHERE status = 'pending'`,
    )
    .all() as PendingOrder[];
}

export function updateOrderStatus(orderId: string, status: OrderStatus) {
  const previous = db
    .query("SELECT product_id AS productId, status, quantity FROM orders WHERE id = ?")
    .get(orderId) as { productId: string; status: OrderStatus; quantity: number } | null;
  const now = new Date().toISOString();
  db.query("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(status, now, orderId);

  if (previous?.productId && previous.status !== status) {
    adjustInventoryForStatusChange(previous.productId, previous.status, status, previous.quantity);
  }
}

function adjustInventoryForStatusChange(
  productId: string,
  previousStatus: OrderStatus | null,
  nextStatus: OrderStatus,
  quantity: number,
) {
  createInventoryIfMissing(productId);

  if (previousStatus !== "paid" && nextStatus === "paid") {
    decreaseInventory(productId, quantity);
  }

  if (previousStatus === "paid" && nextStatus !== "paid") {
    increaseInventory(productId, quantity);
  }
}

export function getInventoryStock(sku: string) {
  createInventoryIfMissing(sku);
  const row = db.query("SELECT stock FROM inventory WHERE sku = ?").get(sku) as
    | { stock: number }
    | null;

  return row?.stock ?? 0;
}

function decreaseInventory(sku: string, quantity: number) {
  const now = new Date().toISOString();
  db.query(
    `UPDATE inventory
     SET stock = MAX(stock - ?, 0), updated_at = ?
     WHERE sku = ?`,
  ).run(quantity, now, sku);
}

function increaseInventory(sku: string, quantity: number) {
  const now = new Date().toISOString();
  db.query(
    `UPDATE inventory
     SET stock = stock + ?, updated_at = ?
     WHERE sku = ?`,
  ).run(quantity, now, sku);
}

export function upsertOrderFromCheckout(params: {
  checkoutSessionId: string;
  productId: string;
  buyerId: string;
  buyerEmail?: string | null;
  status: OrderStatus;
  amountUsd: number;
  quantity?: number;
}) {
  const existing = db
    .query("SELECT id, status, quantity FROM orders WHERE checkout_session_id = ?")
    .get(params.checkoutSessionId) as { id: string; status: OrderStatus; quantity: number } | null;
  const now = new Date().toISOString();
  const quantity = Math.max(1, Math.floor(params.quantity ?? 1));

  if (existing?.id) {
    db.query(
      `UPDATE orders
       SET status = ?, amount_usd = ?, quantity = ?, product_id = ?, buyer_id = ?, buyer_email = COALESCE(?, buyer_email), updated_at = ?
       WHERE checkout_session_id = ?`,
    ).run(
      params.status,
      params.amountUsd,
      quantity,
      params.productId,
      params.buyerId,
      params.buyerEmail?.trim().toLowerCase() || null,
      now,
      params.checkoutSessionId,
    );
    adjustInventoryForStatusChange(params.productId, existing.status, params.status, quantity);
    return;
  }

  db.query(
    `INSERT INTO orders (
      id, checkout_session_id, product_id, buyer_id, buyer_email, status, quantity, amount_usd, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    params.checkoutSessionId,
    params.productId,
    params.buyerId,
    params.buyerEmail?.trim().toLowerCase() || null,
    params.status,
    quantity,
    params.amountUsd,
    now,
    now,
  );
  adjustInventoryForStatusChange(params.productId, null, params.status, quantity);
}

export function listInventory() {
  return db
    .query(
      `SELECT
        sku,
        stock,
        minimum_stock AS minimumStock,
        updated_at AS updatedAt
      FROM inventory
      ORDER BY sku ASC`,
    )
    .all();
}

export function updateInventory(params: { sku: string; stock: number; minimumStock: number }) {
  createInventoryIfMissing(params.sku);
  const now = new Date().toISOString();
  db.query("UPDATE inventory SET stock = ?, minimum_stock = ?, updated_at = ? WHERE sku = ?").run(
    params.stock,
    params.minimumStock,
    now,
    params.sku,
  );
}

function mapProduct(row: unknown): ProductRecord | null {
  if (!row) return null;
  const product = row as {
    id: string;
    name: string;
    description: string;
    priceUsd: number;
    tag: string;
    imageUrl: string;
    active: number;
    stock: number | null;
    minimumStock: number | null;
    inventoryUpdatedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };

  return product;
}

function makeProductId(name: string) {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${slug || "producto"}-${randomUUID().slice(0, 8)}`;
}

export function listProducts(options: { includeInactive?: boolean } = {}) {
  const whereClause = options.includeInactive ? "" : "WHERE active = 1";
  return db
    .query(
      `SELECT
        products.id,
        products.name,
        products.description,
        products.price_usd AS priceUsd,
        products.tag,
        products.image_url AS imageUrl,
        products.active,
        COALESCE(inventory.stock, 0) AS stock,
        COALESCE(inventory.minimum_stock, 0) AS minimumStock,
        inventory.updated_at AS inventoryUpdatedAt,
        products.created_at AS createdAt,
        products.updated_at AS updatedAt
      FROM products
      LEFT JOIN inventory ON inventory.sku = products.id
      ${whereClause}
      ORDER BY products.created_at DESC`,
    )
    .all() as ProductRecord[];
}

export function getActiveProduct(productId: string) {
  return mapProduct(
    db
      .query(
        `SELECT
          products.id,
          products.name,
          products.description,
          products.price_usd AS priceUsd,
          products.tag,
          products.image_url AS imageUrl,
          products.active,
          COALESCE(inventory.stock, 0) AS stock,
          COALESCE(inventory.minimum_stock, 0) AS minimumStock,
          inventory.updated_at AS inventoryUpdatedAt,
          products.created_at AS createdAt,
          products.updated_at AS updatedAt
        FROM products
        LEFT JOIN inventory ON inventory.sku = products.id
        WHERE products.id = ? AND products.active = 1`,
      )
      .get(productId),
  );
}

export function createProduct(params: ProductInput) {
  const now = new Date().toISOString();
  const id = makeProductId(params.name);
  db.query(
    `INSERT INTO products (
      id, name, description, price_usd, tag, image_url, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  ).run(
    id,
    params.name,
    params.description,
    params.priceUsd,
    params.tag,
    params.imageUrl,
    now,
    now,
  );
  createInventoryIfMissing(id);

  return getActiveProduct(id);
}

export function updateProduct(productId: string, params: ProductInput) {
  const now = new Date().toISOString();
  db.query(
    `UPDATE products
     SET name = ?, description = ?, price_usd = ?, tag = ?, image_url = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    params.name,
    params.description,
    params.priceUsd,
    params.tag,
    params.imageUrl,
    now,
    productId,
  );

  return mapProduct(
    db
      .query(
        `SELECT
          products.id,
          products.name,
          products.description,
          products.price_usd AS priceUsd,
          products.tag,
          products.image_url AS imageUrl,
          products.active,
          COALESCE(inventory.stock, 0) AS stock,
          COALESCE(inventory.minimum_stock, 0) AS minimumStock,
          inventory.updated_at AS inventoryUpdatedAt,
          products.created_at AS createdAt,
          products.updated_at AS updatedAt
        FROM products
        LEFT JOIN inventory ON inventory.sku = products.id
        WHERE products.id = ?`,
      )
      .get(productId),
  );
}

export function deleteProduct(productId: string) {
  const result = db.query("DELETE FROM products WHERE id = ?").run(productId);
  return result.changes > 0;
}
