import { describe, expect, test } from "bun:test";
import { authenticateCustomer } from "./customer-auth";
import { checkoutInputSchema, inviteAdminSchema, productInputSchema, sanitizeText } from "./validation";

describe("validación y aislamiento", () => {
  test("sanitiza markup y controles antes de persistir", () => {
    expect(sanitizeText(' <script>alert(1)</script>Kit\u0000 urbano ')).toBe("alert(1)Kit urbano");
    expect(productInputSchema.parse({ name: "<b>Kit</b>", description: "Seguro", priceUsd: 20, tag: "<i>Nuevo</i>", imageUrl: "" }))
      .toMatchObject({ name: "Kit", tag: "Nuevo" });
  });

  test("rechaza campos desconocidos, URL, email y cantidades inválidas", () => {
    expect(productInputSchema.safeParse({ name: "Kit", description: "x", priceUsd: 1, tag: "", imageUrl: "javascript:alert(1)", admin: true }).success).toBe(false);
    expect(checkoutInputSchema.safeParse({ items: [{ productId: "kit", quantity: 0 }] }).success).toBe(false);
    expect(inviteAdminSchema.safeParse({ name: "Ana", email: "no-email", role: "admin" }).success).toBe(false);
  });

  test("la identidad siempre procede del JWT verificado", async () => {
    const request = new Request("http://test/customers/user-victim/orders", { headers: { authorization: "Bearer signed-token" } });
    expect(await authenticateCustomer(request, async () => ({ sub: "user-owner" }))).toEqual({ userId: "user-owner" });
    expect(await authenticateCustomer(request, async () => { throw new Error("bad signature"); })).toBeNull();
  });
});
