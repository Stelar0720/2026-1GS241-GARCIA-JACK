import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL = process.env.API_URL?.trim() || "http://localhost:4000";
const ADMIN_KEY = process.env.MCP_ADMIN_KEY?.trim();

type ProductRecord = {
  id: string;
  name: string;
  description: string;
  priceUsd: number;
  tag: string;
  imageUrl: string;
  active: number;
  stock: number;
};

type OrderRecord = {
  id: string;
  status: "pending" | "paid" | "cancelled";
  amountUsd: number;
};

async function fetchProducts(): Promise<ProductRecord[]> {
  const response = await fetch(`${API_URL}/products`);
  if (!response.ok) {
    throw new Error(`bun-api respondió ${response.status} al consultar /products`);
  }
  const body = (await response.json()) as { data: ProductRecord[] };
  return body.data;
}

async function fetchOrders(): Promise<OrderRecord[]> {
  const response = await fetch(`${API_URL}/orders`);
  if (!response.ok) {
    throw new Error(`bun-api respondió ${response.status} al consultar /orders`);
  }
  const body = (await response.json()) as { data: OrderRecord[] };
  return body.data;
}

function textResult(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

const server = new McpServer({ name: "urbansprout-mcp", version: "0.1.0" });

server.registerTool(
  "search_products",
  {
    title: "Buscar productos de UrbanSprout",
    description:
      "Busca y filtra productos del catálogo por texto, rango de precio y etiqueta, con paginación de 12 por página. Corresponde a HU-053 (auth: público).",
    inputSchema: {
      query: z.string().optional().describe("Texto a buscar en nombre o descripción del producto"),
      minPrice: z.number().optional().describe("Precio mínimo en USD"),
      maxPrice: z.number().optional().describe("Precio máximo en USD"),
      tag: z.string().optional().describe("Etiqueta exacta (ej: 'Más vendido', 'Premium')"),
      page: z.number().int().min(1).default(1).describe("Número de página (empieza en 1)"),
    },
  },
  async ({ query, minPrice, maxPrice, tag, page }) => {
    const products = await fetchProducts();
    const normalizedQuery = query?.trim().toLowerCase();

    const filtered = products.filter((product) => {
      if (product.active !== 1) return false;
      if (normalizedQuery) {
        const haystack = `${product.name} ${product.description}`.toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }
      if (minPrice !== undefined && product.priceUsd < minPrice) return false;
      if (maxPrice !== undefined && product.priceUsd > maxPrice) return false;
      if (tag && product.tag !== tag) return false;
      return true;
    });

    const pageSize = 12;
    const start = (page - 1) * pageSize;

    return textResult({
      total: filtered.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
      products: filtered.slice(start, start + pageSize),
    });
  },
);

server.registerTool(
  "get_business_metrics",
  {
    title: "Métricas de negocio de UrbanSprout",
    description:
      "Revenue total, conteo de órdenes por estado y ticket promedio (AOV). Corresponde a HU-036 (auth: admin, requiere MCP_ADMIN_KEY configurada en el servidor). Versión inicial de solo lectura para el primer avance del semestral.",
    inputSchema: {
      adminKey: z.string().describe("Clave de administrador (debe coincidir con MCP_ADMIN_KEY del servidor)"),
    },
  },
  async ({ adminKey }) => {
    if (!ADMIN_KEY) {
      throw new Error("El servidor MCP no tiene MCP_ADMIN_KEY configurada; esta tool está deshabilitada.");
    }
    if (adminKey !== ADMIN_KEY) {
      throw new Error("Clave de administrador inválida.");
    }

    const orders = await fetchOrders();
    const paidOrders = orders.filter((order) => order.status === "paid");
    const revenueTotalUsd = paidOrders.reduce((sum, order) => sum + order.amountUsd, 0);
    const averageOrderValueUsd = paidOrders.length > 0 ? revenueTotalUsd / paidOrders.length : 0;

    return textResult({
      revenueTotalUsd: Number(revenueTotalUsd.toFixed(2)),
      averageOrderValueUsd: Number(averageOrderValueUsd.toFixed(2)),
      totalOrders: orders.length,
      ordersByStatus: {
        pending: orders.filter((order) => order.status === "pending").length,
        paid: paidOrders.length,
        cancelled: orders.filter((order) => order.status === "cancelled").length,
      },
    });
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("UrbanSprout MCP server corriendo (stdio)");
