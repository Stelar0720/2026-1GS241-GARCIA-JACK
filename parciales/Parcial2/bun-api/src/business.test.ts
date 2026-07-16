import { describe, expect, test } from "bun:test";
import { calculateLineAmountUsd, canReserveStock, normalizeCheckoutLines, validateProductInput } from "./business";

describe("lógica de negocio pura", () => {
  test("valida y normaliza productos", () => {
    expect(validateProductInput({ name: " ", description: "x", priceUsd: 10 })).toEqual({ error: "El nombre del producto es requerido." });
    expect(validateProductInput({ name: "Kit", description: " ", priceUsd: 10 })).toEqual({ error: "La descripción del producto es requerida." });
    expect(validateProductInput({ name: "Kit", description: "Huerto", priceUsd: 0 })).toEqual({ error: "El precio debe ser un número positivo." });
    expect(validateProductInput({ name: " Kit ", description: " Huerto ", priceUsd: 12.5, tag: " Inicio ", imageUrl: " foto " })).toEqual({ data: { name: "Kit", description: "Huerto", priceUsd: 12.5, tag: "Inicio", imageUrl: "foto" } });
  });
  test("consolida productos y cantidades", () => {
    expect(normalizeCheckoutLines({ items: [{ productId: "kit-a", quantity: 2 }, { productId: " kit-a ", quantity: 3.8 }, { productId: "" }] })).toEqual([{ productId: "kit-a", quantity: 5 }]);
    expect(normalizeCheckoutLines({ productId: "kit-b" })).toEqual([{ productId: "kit-b", quantity: 1 }]);
    expect(normalizeCheckoutLines({})).toEqual([]);
  });
  test("calcula precios y rechaza valores inválidos", () => {
    expect(calculateLineAmountUsd(24.9, 3)).toBe(74.7);
    expect(() => calculateLineAmountUsd(-1, 1)).toThrow("Precio inválido");
    expect(() => calculateLineAmountUsd(1, 0)).toThrow("Cantidad inválida");
  });
  test("aplica reglas de reserva", () => {
    expect(canReserveStock(3, 3)).toBe(true);
    expect(canReserveStock(2, 3)).toBe(false);
    expect(canReserveStock(-1, 1)).toBe(false);
    expect(canReserveStock(2, 0)).toBe(false);
  });
});
