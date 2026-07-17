import { describe, expect, test } from "bun:test";
import { couponInputSchema, couponValidationSchema, productInputSchema, reviewInputSchema } from "./validation";

describe("commerce validation", () => {
  test("normaliza cupones y rechaza porcentajes mayores a 100", () => {
    expect(couponValidationSchema.parse({ code: " welcome10 ", subtotalUsd: 25 }).code).toBe("WELCOME10");
    expect(couponInputSchema.safeParse({ code: "x", type: "percent", value: 101 }).success).toBe(false);
  });
  test("sanitiza reseñas y limita la calificación", () => {
    expect(reviewInputSchema.parse({ rating: 5, comment: "<b>Excelente</b>" }).comment).toBe("Excelente");
    expect(reviewInputSchema.safeParse({ rating: 6, comment: "No" }).success).toBe(false);
  });
  test("acepta categoría y etiquetas de producto", () => {
    const product = productInputSchema.parse({ name: "Kit", description: "Huerto", priceUsd: 20, tag: "Inicio", category: "Kits", tags: ["Interior"], imageUrl: "" });
    expect(product).toMatchObject({ category: "Kits", tags: ["Interior"] });
  });
});
