import { z } from "zod";

const unsafeMarkup = /<[^>]*>/g;
const controlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeText(value: string): string {
  return value.replace(unsafeMarkup, "").replace(controlCharacters, "").trim();
}

export const safeText = (max: number, min = 0) => z.string().transform(sanitizeText).pipe(z.string().min(min).max(max));
export const safeId = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/);

export const productInputSchema = z.object({
  name: safeText(120, 1),
  description: safeText(2_000, 1),
  priceUsd: z.number().finite().positive().max(100_000),
  tag: safeText(80).default(""),
  imageUrl: z.union([z.literal(""), z.url().max(2_048)]).default(""),
}).strict();

export const checkoutInputSchema = z.object({
  productId: safeId.optional(),
  items: z.array(z.object({ productId: safeId, quantity: z.number().int().min(1).max(99) }).strict()).min(1).max(50).optional(),
  userId: safeId.nullish(),
  userEmail: z.email().max(254).transform((value) => value.trim().toLowerCase()).nullish(),
}).strict().refine((value) => Boolean(value.productId || value.items?.length), "El carrito no puede estar vacío.");

export const inviteAdminSchema = z.object({
  name: safeText(120, 1),
  email: z.email().max(254).transform((value) => value.trim().toLowerCase()),
  role: z.enum(["support", "admin"]),
}).strict();

export const adminUpdateSchema = z.object({
  role: z.enum(["support", "admin"]).optional(),
  status: z.enum(["invited", "active", "suspended"]).optional(),
}).strict().refine((value) => value.role !== undefined || value.status !== undefined, "No hay cambios válidos.");

export const inventoryUpdateSchema = z.object({
  stock: z.number().int().min(0).max(1_000_000),
  minimumStock: z.number().int().min(0).max(1_000_000).optional(),
}).strict();

export const orderStatusSchema = z.object({
  status: z.enum(["pending", "paid", "cancelled"]),
}).strict();

export function formatValidationIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
}
