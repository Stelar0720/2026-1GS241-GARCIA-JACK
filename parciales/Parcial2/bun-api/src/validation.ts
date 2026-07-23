import { z } from "zod";

const unsafeMarkup = /<[^>]*>/g;
const controlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeText(value: string): string {
  return value.replace(unsafeMarkup, "").replace(controlCharacters, "").trim();
}

export const safeText = (max: number, min = 0) => z.string().transform(sanitizeText).pipe(z.string().min(min).max(max));
export const safeId = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/);

const productDetailsSchema = z.object({
  level: safeText(80).default(""),
  light: safeText(160).default(""),
  space: safeText(160).default(""),
  harvest: safeText(160).default(""),
  cycles: safeText(160).default(""),
  includes: z.array(safeText(300, 1)).max(20).default([]),
  steps: z.array(z.object({
    title: safeText(120, 1),
    text: safeText(500, 1),
  }).strict()).max(12).default([]),
  testimonial: z.object({
    name: safeText(120).default(""),
    text: safeText(1_000).default(""),
  }).strict().default({ name: "", text: "" }),
}).strict();

export const productInputSchema = z.object({
  name: safeText(120, 1),
  description: safeText(2_000, 1),
  priceUsd: z.number().finite().positive().max(100_000),
  tag: safeText(80).default(""),
  category: safeText(80).default(""),
  tags: z.array(safeText(40, 1)).max(10).default([]),
  imageUrl: z.union([z.literal(""), z.url().max(2_048)]).default(""),
  details: productDetailsSchema.nullable().optional(),
}).strict();

export const couponValidationSchema = z.object({
  code: safeText(32, 1).transform((value) => value.toUpperCase()),
  subtotalUsd: z.number().finite().positive().max(1_000_000),
}).strict();

export const couponInputSchema = z.object({
  code: safeText(32, 1).transform((value) => value.toUpperCase()),
  type: z.enum(["percent", "fixed"]),
  value: z.number().finite().positive().max(100_000),
  minimumUsd: z.number().finite().min(0).max(1_000_000).default(0),
  expiresAt: z.iso.datetime().nullable().default(null),
  active: z.boolean().default(true),
}).strict().superRefine((value, ctx) => {
  if (value.type === "percent" && value.value > 100) ctx.addIssue({ code: "custom", path: ["value"], message: "El porcentaje no puede superar 100." });
});

export const wishlistInputSchema = z.object({ productId: safeId }).strict();

export const apiKeyInputSchema = z.object({
  name: safeText(80, 2),
  permissions: z.array(z.enum(["catalog:read", "orders:read", "reports:read"])).min(1).max(3),
  expiresAt: z.iso.datetime().nullable().optional(),
}).strict().refine((value) => !value.expiresAt || new Date(value.expiresAt).getTime() > Date.now(), { message: "La expiracion debe ser futura", path: ["expiresAt"] });

export const gdprDeleteSchema = z.object({ confirm: z.literal("DELETE_MY_DATA") }).strict();

export const reviewInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: safeText(1_000, 1),
}).strict();

export const checkoutInputSchema = z.object({
  productId: safeId.optional(),
  items: z.array(z.object({ productId: safeId, quantity: z.number().int().min(1).max(99) }).strict()).min(1).max(50).optional(),
  userId: safeId.nullish(),
  userEmail: z.email().max(254).transform((value) => value.trim().toLowerCase()).nullish(),
  couponCode: safeText(32, 1).transform((value) => value.toUpperCase()).nullish(),
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
  status: z.enum(["pending", "paid", "cancelled", "refunded"]),
}).strict();

// Reembolso total o parcial (HU-030). Sin `amountUsd` se reembolsa el total.
export const refundInputSchema = z.object({
  amountUsd: z.number().finite().positive().max(1_000_000).optional(),
  reason: safeText(200, 1).default("Solicitado por el cliente"),
}).strict();

export function formatValidationIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
}
