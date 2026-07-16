import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { mcpConfig } from "./config.js";

// ============================================================
// Configuración y autenticación
// ============================================================
// El servidor se lanza con una API key (MCP_API_KEY) que lo identifica ante el
// bun-api. Al arrancar consulta /auth/whoami para conocer su rol y permisos, y
// cada tool se habilita/deshabilita según el permiso requerido. Las tools que
// llegan al backend reenvían la key como `Authorization: Bearer`.

const API_URL = mcpConfig.apiUrl;
const API_KEY = mcpConfig.apiKey;

type Permission =
  | "catalog:read"
  | "catalog:write"
  | "orders:read"
  | "orders:cancel"
  | "orders:sync"
  | "metrics:read"
  | "reports:read"
  | "export:read"
  | "audit:read"
  | "auth:read"
  | "users:manage";

let sessionRole = "public";
let sessionPermissions: Permission[] = [];

function authHeaders(): Record<string, string> {
  return API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {};
}

async function loadSession() {
  try {
    const response = await fetch(`${API_URL}/auth/whoami`, { headers: authHeaders() });
    if (response.ok) {
      const body = (await response.json()) as { role: string; permissions: Permission[] };
      sessionRole = body.role;
      sessionPermissions = body.permissions;
    }
  } catch {
    // bun-api no disponible al arrancar: quedamos como public, las tools autenticadas rechazarán.
  }
}

function textResult(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}

// Verifica el permiso a nivel MCP antes de ejecutar. Devuelve null si está OK,
// o un resultado de error si el rol de esta sesión no tiene el permiso.
function denyIfMissing(permission: Permission) {
  if (sessionPermissions.includes(permission)) return null;
  return errorResult(
    `Acceso denegado: el rol '${sessionRole}' no tiene el permiso '${permission}'. ` +
      `Configura MCP_API_KEY con una key de mayor privilegio.`,
  );
}

async function apiGet(path: string) {
  const response = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((body as { error?: string })?.error ?? `bun-api respondió ${response.status}`);
  }
  return body;
}

async function apiSend(method: string, path: string, payload?: unknown) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((body as { error?: string })?.error ?? `bun-api respondió ${response.status}`);
  }
  return body;
}

// ============================================================
// Servidor + tools
// ============================================================

const server = new McpServer({ name: "urbansprout-mcp", version: "0.2.0" });

type ProductRecord = {
  id: string;
  name: string;
  description: string;
  priceUsd: number;
  tag: string;
  active: number;
  stock: number;
};

type OrderRecord = {
  id: string;
  status: "pending" | "paid" | "cancelled";
  amountUsd: number;
};

// --- 1. search_products (HU-053, público) ---
server.registerTool(
  "search_products",
  {
    title: "Buscar productos",
    description:
      "Busca y filtra productos del catálogo por texto, rango de precio y etiqueta, paginado de 12. Público, sin auth (HU-053).",
    inputSchema: {
      query: z.string().optional(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
      tag: z.string().optional(),
      page: z.number().int().min(1).default(1),
    },
  },
  async ({ query, minPrice, maxPrice, tag, page }) => {
    const body = (await apiGet("/products")) as { data: ProductRecord[] };
    const q = query?.trim().toLowerCase();
    const filtered = body.data.filter((p) => {
      if (p.active !== 1) return false;
      if (q && !`${p.name} ${p.description}`.toLowerCase().includes(q)) return false;
      if (minPrice !== undefined && p.priceUsd < minPrice) return false;
      if (maxPrice !== undefined && p.priceUsd > maxPrice) return false;
      if (tag && p.tag !== tag) return false;
      return true;
    });
    const pageSize = 12;
    const start = (page - 1) * pageSize;
    return textResult({
      total: filtered.length,
      page,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
      products: filtered.slice(start, start + pageSize),
    });
  },
);

// --- 2. get_role_permissions (HU-050, auth:read) ---
server.registerTool(
  "get_role_permissions",
  {
    title: "Matriz de permisos por rol",
    description: "Devuelve la matriz completa de roles y sus permisos (HU-050). Requiere auth:read.",
    inputSchema: {},
  },
  async () => {
    const denied = denyIfMissing("auth:read");
    if (denied) return denied;
    return textResult(await apiGet("/auth/roles"));
  },
);

// --- 3. authorize_user (HU-025, auth:read) ---
server.registerTool(
  "authorize_user",
  {
    title: "Verificar permiso de un rol",
    description:
      "Valida si un rol tiene un permiso específico antes de ejecutar una acción (HU-025). Requiere auth:read.",
    inputSchema: {
      role: z.enum(["public", "client", "support", "admin"]),
      permission: z.string(),
    },
  },
  async ({ role, permission }) => {
    const denied = denyIfMissing("auth:read");
    if (denied) return denied;
    return textResult(await apiSend("POST", "/auth/authorize", { role, permission }));
  },
);

// --- 4. get_business_metrics (HU-036, metrics:read) ---
server.registerTool(
  "get_business_metrics",
  {
    title: "Métricas de negocio",
    description: "Revenue total, órdenes por estado y ticket promedio (AOV) (HU-036). Requiere metrics:read.",
    inputSchema: {},
  },
  async () => {
    const denied = denyIfMissing("metrics:read");
    if (denied) return denied;
    const body = (await apiGet("/orders")) as { data: OrderRecord[] };
    const orders = body.data;
    const paid = orders.filter((o) => o.status === "paid");
    const revenue = paid.reduce((sum, o) => sum + o.amountUsd, 0);
    return textResult({
      revenueTotalUsd: Number(revenue.toFixed(2)),
      averageOrderValueUsd: paid.length > 0 ? Number((revenue / paid.length).toFixed(2)) : 0,
      totalOrders: orders.length,
      ordersByStatus: {
        pending: orders.filter((o) => o.status === "pending").length,
        paid: paid.length,
        cancelled: orders.filter((o) => o.status === "cancelled").length,
      },
    });
  },
);

// --- 5. manage_catalog (HU-068, catalog:read / catalog:write) ---
server.registerTool(
  "manage_catalog",
  {
    title: "Gestionar catálogo",
    description:
      "Consulta (list) o modifica (create/update/set-stock) productos e inventario (HU-068). 'list' requiere catalog:read; el resto catalog:write.",
    inputSchema: {
      action: z.enum(["list", "create", "update", "set-stock"]),
      productId: z.string().optional(),
      name: z.string().optional(),
      description: z.string().optional(),
      priceUsd: z.number().optional(),
      tag: z.string().optional(),
      imageUrl: z.string().optional(),
      stock: z.number().int().optional(),
    },
  },
  async (args) => {
    if (args.action === "list") {
      const denied = denyIfMissing("catalog:read");
      if (denied) return denied;
      return textResult(await apiGet("/products?includeInactive=true"));
    }

    const denied = denyIfMissing("catalog:write");
    if (denied) return denied;

    if (args.action === "create") {
      if (!args.name || !args.description || args.priceUsd === undefined) {
        return errorResult("create requiere name, description y priceUsd.");
      }
      const created = (await apiSend("POST", "/products", {
        name: args.name,
        description: args.description,
        priceUsd: args.priceUsd,
        tag: args.tag ?? "",
        imageUrl: args.imageUrl ?? "",
      })) as { data: ProductRecord };
      if (args.stock !== undefined && created.data?.id) {
        await apiSend("PATCH", `/inventory/${encodeURIComponent(created.data.id)}`, { stock: args.stock });
      }
      return textResult(created);
    }

    if (args.action === "update") {
      if (!args.productId) return errorResult("update requiere productId.");
      return textResult(
        await apiSend("PATCH", `/products/${encodeURIComponent(args.productId)}`, {
          name: args.name,
          description: args.description,
          priceUsd: args.priceUsd,
          tag: args.tag,
          imageUrl: args.imageUrl,
        }),
      );
    }

    // set-stock
    if (!args.productId || args.stock === undefined) {
      return errorResult("set-stock requiere productId y stock.");
    }
    return textResult(
      await apiSend("PATCH", `/inventory/${encodeURIComponent(args.productId)}`, { stock: args.stock }),
    );
  },
);

// --- 6. cancel_order (HU-066, orders:cancel) ---
server.registerTool(
  "cancel_order",
  {
    title: "Cancelar orden pendiente",
    description: "Cancela una orden en estado 'pending' (HU-066). Requiere orders:cancel.",
    inputSchema: { orderId: z.string() },
  },
  async ({ orderId }) => {
    const denied = denyIfMissing("orders:cancel");
    if (denied) return denied;
    return textResult(await apiSend("POST", `/orders/${encodeURIComponent(orderId)}/cancel`));
  },
);

// --- 7. sync_orders_stripe (HU-031, orders:sync) ---
server.registerTool(
  "sync_orders_stripe",
  {
    title: "Sincronizar órdenes con Stripe",
    description: "Reconcilia las órdenes pendientes contra Stripe (HU-031). Requiere orders:sync.",
    inputSchema: {},
  },
  async () => {
    const denied = denyIfMissing("orders:sync");
    if (denied) return denied;
    return textResult(await apiSend("POST", "/orders/sync"));
  },
);

// --- 8. export_data (HU-064, export:read) ---
server.registerTool(
  "export_data",
  {
    title: "Exportar datos",
    description: "Exporta órdenes, productos o inventario en JSON o CSV (HU-064). Requiere export:read.",
    inputSchema: {
      type: z.enum(["orders", "products", "inventory"]).default("orders"),
      format: z.enum(["json", "csv"]).default("json"),
    },
  },
  async ({ type, format }) => {
    const denied = denyIfMissing("export:read");
    if (denied) return denied;
    if (format === "csv") {
      const response = await fetch(`${API_URL}/export?type=${type}&format=csv`, { headers: authHeaders() });
      const csv = await response.text();
      return { content: [{ type: "text" as const, text: csv }] };
    }
    return textResult(await apiGet(`/export?type=${type}&format=json`));
  },
);

// --- 9. generate_sales_report (HU-067, reports:read) ---
server.registerTool(
  "generate_sales_report",
  {
    title: "Reporte de ventas",
    description:
      "Reporte de ventas por período con desglose por producto y producto más vendido (HU-067). Requiere reports:read.",
    inputSchema: {
      from: z.string().optional().describe("ISO date/time desde (opcional)"),
      to: z.string().optional().describe("ISO date/time hasta (opcional)"),
    },
  },
  async ({ from, to }) => {
    const denied = denyIfMissing("reports:read");
    if (denied) return denied;
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return textResult(await apiGet(`/reports/sales${qs ? `?${qs}` : ""}`));
  },
);

// --- 10. query_audit_logs (HU-029, audit:read) ---
server.registerTool(
  "query_audit_logs",
  {
    title: "Consultar log de auditoría",
    description:
      "Busca eventos de auditoría por actor, acción y rango de fechas (HU-029). Requiere audit:read.",
    inputSchema: {
      actor: z.string().optional(),
      action: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.number().int().min(1).max(500).optional(),
    },
  },
  async ({ actor, action, from, to, limit }) => {
    const denied = denyIfMissing("audit:read");
    if (denied) return denied;
    const params = new URLSearchParams();
    if (actor) params.set("actor", actor);
    if (action) params.set("action", action);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (limit) params.set("limit", String(limit));
    const qs = params.toString();
    return textResult(await apiGet(`/audit-logs${qs ? `?${qs}` : ""}`));
  },
);

// --- 11. manage_users (HU-051, users:manage) ---
server.registerTool(
  "manage_users",
  {
    title: "Gestionar usuarios administrativos",
    description: "Busca, invita, cambia roles o suspende usuarios del equipo. Requiere users:manage (admin).",
    inputSchema: {
      action: z.enum(["search", "invite", "change-role", "suspend", "activate"]),
      query: z.string().optional(),
      userId: z.string().optional(),
      name: z.string().optional(),
      email: z.string().email().optional(),
      role: z.enum(["support", "admin"]).optional(),
    },
  },
  async (args) => {
    const denied = denyIfMissing("users:manage");
    if (denied) return denied;
    if (args.action === "search") {
      const params = new URLSearchParams();
      if (args.query) params.set("q", args.query);
      return textResult(await apiGet(`/admin/users?${params.toString()}`));
    }
    if (args.action === "invite") {
      if (!args.name || !args.email || !args.role) return errorResult("invite requiere name, email y role.");
      return textResult(await apiSend("POST", "/admin/users/invite", { name: args.name, email: args.email, role: args.role }));
    }
    if (!args.userId) return errorResult(`${args.action} requiere userId.`);
    if (args.action === "change-role") {
      if (!args.role) return errorResult("change-role requiere role.");
      return textResult(await apiSend("PATCH", `/admin/users/${encodeURIComponent(args.userId)}`, { role: args.role }));
    }
    const status = args.action === "suspend" ? "suspended" : "active";
    return textResult(await apiSend("PATCH", `/admin/users/${encodeURIComponent(args.userId)}`, { status }));
  },
);

await loadSession();
const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`UrbanSprout MCP server (stdio) — rol: ${sessionRole}, permisos: ${sessionPermissions.length}`);
