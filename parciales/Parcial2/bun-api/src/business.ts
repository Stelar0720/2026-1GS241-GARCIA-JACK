import type { ProductInput } from "./db";

export type CheckoutLineInput = { productId: string; quantity: number };

export function validateProductInput(body: Partial<ProductInput>) {
  const name = body.name?.trim();
  const description = body.description?.trim();
  const priceUsd = Number(body.priceUsd);
  const tag = body.tag?.trim() ?? "";
  const imageUrl = body.imageUrl?.trim() ?? "";
  if (!name) return { error: "El nombre del producto es requerido." } as const;
  if (!description) return { error: "La descripción del producto es requerida." } as const;
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return { error: "El precio debe ser un número positivo." } as const;
  return { data: { name, description, priceUsd, tag, imageUrl } } as const;
}

export function normalizeCheckoutLines(body: { productId?: string; items?: { productId?: string; quantity?: number }[] }): CheckoutLineInput[] {
  const rawItems = Array.isArray(body.items) && body.items.length > 0 ? body.items : body.productId ? [{ productId: body.productId, quantity: 1 }] : [];
  const quantities = new Map<string, number>();
  for (const item of rawItems) {
    const productId = item.productId?.trim();
    if (!productId) continue;
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
  }
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
}

export function calculateLineAmountUsd(priceUsd: number, quantity: number) {
  if (!Number.isFinite(priceUsd) || priceUsd < 0) throw new Error("Precio inválido.");
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Cantidad inválida.");
  return Number((priceUsd * quantity).toFixed(2));
}

export function canReserveStock(stock: number, quantity: number) {
  return Number.isInteger(stock) && stock >= 0 && Number.isInteger(quantity) && quantity > 0 && stock >= quantity;
}
