import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";

setDefaultTimeout(30_000);

process.env.MONGODB_URI =
  process.env.TEST_MONGODB_URI ??
  process.env.MONGODB_URI ??
  "mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true";
process.env.MONGODB_DATABASE = `urbansprout_test_${Date.now()}`;

const repository = await import("./db");

beforeAll(async () => {
  await repository.dbReady;
});

afterAll(async () => {
  await repository.db.dropDatabase();
  await repository.closeDatabase();
});

describe("MongoDB repository", () => {
  test("seed is available with inventory", async () => {
    const products = await repository.listProducts();
    expect(products).toHaveLength(3);
    expect(products.every((product) => product.stock > 0)).toBe(true);
  });

  test("low-stock alerts appear only below the configured minimum", async () => {
    const productId = "kit-balcon-basico";
    await repository.updateInventory({ sku: productId, stock: 5, minimumStock: 5 });
    expect((await repository.listStockAlerts()).some((alert) => alert.sku === productId)).toBe(false);

    await repository.upsertOrderFromCheckout({ checkoutSessionId: "cs_low_stock_alert", productId, buyerId: "buyer-alert", status: "paid", amountUsd: 24.9, quantity: 1 });

    const alert = (await repository.listStockAlerts()).find((item) => item.sku === productId);
    expect(alert).toMatchObject({ sku: productId, stock: 4, minimumStock: 5, type: "low_stock", deficit: 1 });
  });

  test("product CRUD preserves the public contract", async () => {
    const created = await repository.createProduct({
      name: "Producto de prueba Mongo",
      description: "Registro aislado y temporal",
      priceUsd: 12.5,
      tag: "QA",
      imageUrl: "",
    });

    expect(created?.active).toBe(1);
    expect(created?.stock).toBe(0);

    const updated = await repository.updateProduct(created!.id, {
      name: "Producto de prueba actualizado",
      description: "Registro aislado y temporal",
      priceUsd: 13.5,
      tag: "QA",
      imageUrl: "",
    });
    expect(updated?.name).toBe("Producto de prueba actualizado");

    expect(await repository.deleteProduct(created!.id)).toBe(true);
    expect(await repository.getActiveProduct(created!.id)).toBeNull();
  });

  test("Stripe event deduplication persists in MongoDB", async () => {
    const eventId = `evt_test_${Date.now()}`;
    expect(await repository.hasProcessedStripeEvent(eventId)).toBe(false);
    expect(await repository.markStripeEventProcessed(eventId, "checkout.session.completed")).toBe(true);
    expect(await repository.hasProcessedStripeEvent(eventId)).toBe(true);
    expect(await repository.markStripeEventProcessed(eventId, "checkout.session.completed")).toBe(false);
  });

  test("paid orders deduct stock once and reject overselling atomically", async () => {
    const productId = "kit-balcon-basico";
    await repository.updateInventory({ sku: productId, stock: 2, minimumStock: 0 });
    await repository.upsertOrderFromCheckout({ checkoutSessionId: "cs_atomic_ok", productId, buyerId: "buyer", status: "paid", amountUsd: 49.8, quantity: 2 });
    expect(await repository.getInventoryStock(productId)).toBe(0);

    await expect(repository.upsertOrderFromCheckout({ checkoutSessionId: "cs_atomic_rejected", productId, buyerId: "buyer", status: "paid", amountUsd: 24.9, quantity: 1 })).rejects.toThrow("Stock insuficiente");
    expect(await repository.getInventoryStock(productId)).toBe(0);
    expect((await repository.listOrders()).some((order) => order.checkoutSessionId === "cs_atomic_rejected")).toBe(false);
  });

  test("Stripe effects and event claim commit or roll back together", async () => {
    const eventId = `evt_atomic_${Date.now()}`;
    await expect(repository.processStripeEventAtomically(eventId, "checkout.session.completed", async () => {
      throw new Error("effect failed");
    })).rejects.toThrow("effect failed");
    expect(await repository.hasProcessedStripeEvent(eventId)).toBe(false);

    expect(await repository.processStripeEventAtomically(eventId, "checkout.session.completed", async () => {})).toBe(true);
    expect(await repository.processStripeEventAtomically(eventId, "checkout.session.completed", async () => {
      throw new Error("must not run");
    })).toBe(false);
  });

  test("concurrent reservations cannot oversell the same unit", async () => {
    const productId = "kit-microverde-rapido";
    await repository.updateInventory({ sku: productId, stock: 1, minimumStock: 0 });

    const attempts = await Promise.allSettled([
      repository.upsertOrderFromCheckout({ checkoutSessionId: "cs_race_a", productId, buyerId: "buyer-a", status: "pending", amountUsd: 29.9, quantity: 1 }),
      repository.upsertOrderFromCheckout({ checkoutSessionId: "cs_race_b", productId, buyerId: "buyer-b", status: "pending", amountUsd: 29.9, quantity: 1 }),
    ]);

    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await repository.getInventoryStock(productId)).toBe(0);
    const raceOrders = (await repository.listOrders()).filter((order) =>
      order.checkoutSessionId === "cs_race_a" || order.checkoutSessionId === "cs_race_b"
    );
    expect(raceOrders).toHaveLength(1);
  });

  test("concurrent delivery of one Stripe event commits its effects once", async () => {
    const productId = "kit-aromaticas-compacto";
    const eventId = `evt_race_${Date.now()}`;
    await repository.updateInventory({ sku: productId, stock: 1, minimumStock: 0 });

    const process = () => repository.processStripeEventAtomically(
      eventId,
      "checkout.session.completed",
      (session) => repository.upsertOrderFromCheckout({
        checkoutSessionId: "cs_event_race",
        productId,
        buyerId: "buyer-race",
        status: "paid",
        amountUsd: 34.9,
        quantity: 1,
      }, session),
    );

    const results = await Promise.all([process(), process()]);
    expect(results.sort()).toEqual([false, true]);
    expect(await repository.getInventoryStock(productId)).toBe(0);
    expect((await repository.listOrders()).filter((order) => order.checkoutSessionId === "cs_event_race")).toHaveLength(1);
  });

  test("only one refund claim can own an order", async () => {
    const checkoutSessionId = `cs_refund_claim_${Date.now()}`;
    await repository.updateInventory({ sku: "kit-balcon-basico", stock: 1, minimumStock: 0 });
    await repository.upsertOrderFromCheckout({
      checkoutSessionId,
      productId: "kit-balcon-basico",
      buyerId: "buyer-refund",
      status: "paid",
      amountUsd: 24.9,
      quantity: 1,
    });
    const order = (await repository.listOrders()).find((row) => row.checkoutSessionId === checkoutSessionId);
    expect(order).toBeDefined();

    const firstClaim = {
      amountUsd: 10,
      reason: "Solicitud original",
      idempotencyKey: `refund-${order!.id}`,
      createdAt: new Date().toISOString(),
    };
    const results = await Promise.all([
      repository.claimOrderRefund(order!.id, firstClaim),
      repository.claimOrderRefund(order!.id, firstClaim),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    await repository.releaseOrderRefundClaim(order!.id, firstClaim.idempotencyKey);

    const staleClaim = {
      ...firstClaim,
      idempotencyKey: `${firstClaim.idempotencyKey}-stale`,
      createdAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    };
    expect(await repository.claimOrderRefund(order!.id, staleClaim)).toBe(true);
    expect(await repository.claimOrderRefund(order!.id, {
      ...firstClaim,
      idempotencyKey: `${firstClaim.idempotencyKey}-recovery`,
    })).toBe(true);
  });

  test("cancelling a checkout releases every pending line atomically", async () => {
    const firstProduct = "kit-balcon-basico";
    const secondProduct = "kit-microverde-rapido";
    const stripeSessionId = "cs_cart_cancel";
    await repository.updateInventory({ sku: firstProduct, stock: 3, minimumStock: 0 });
    await repository.updateInventory({ sku: secondProduct, stock: 3, minimumStock: 0 });

    await repository.runInTransaction(async (session) => {
      await repository.upsertOrderFromCheckout({ checkoutSessionId: `${stripeSessionId}:${firstProduct}`, productId: firstProduct, buyerId: "buyer-cart", status: "pending", amountUsd: 24.9, quantity: 2 }, session);
      await repository.upsertOrderFromCheckout({ checkoutSessionId: `${stripeSessionId}:${secondProduct}`, productId: secondProduct, buyerId: "buyer-cart", status: "pending", amountUsd: 29.9, quantity: 1 }, session);
    });
    expect(await repository.getInventoryStock(firstProduct)).toBe(1);
    expect(await repository.getInventoryStock(secondProduct)).toBe(2);

    const cancelledIds = await repository.cancelPendingCheckoutOrders(stripeSessionId);
    expect(cancelledIds).toHaveLength(2);
    expect(await repository.getInventoryStock(firstProduct)).toBe(3);
    expect(await repository.getInventoryStock(secondProduct)).toBe(3);
    const cancelled = (await repository.listOrders()).filter((order) => cancelledIds.includes(order.id));
    expect(cancelled.every((order) => order.status === "cancelled")).toBe(true);
  });
});
