import { beforeEach, describe, expect, test } from "bun:test";
import { getPerformanceSnapshot, normalizeRoute, percentile, recordRequest, resetPerformanceMetrics } from "./performance";

describe("métricas de rendimiento (HU-035)", () => {
  beforeEach(() => resetPerformanceMetrics());

  test("colapsa identificadores variables para no explotar la cardinalidad", () => {
    expect(normalizeRoute("/orders/8f2c1b90-11ac/refund")).toBe("/orders/:id/refund");
    expect(normalizeRoute("/products")).toBe("/products");
    expect(normalizeRoute("/products/taxonomy")).toBe("/products/taxonomy");
  });

  test("calcula percentiles sobre una muestra ordenada", () => {
    const sample = Array.from({ length: 100 }, (_, index) => index + 1);
    expect(percentile(sample, 0.5)).toBe(50);
    expect(percentile(sample, 0.95)).toBe(95);
    expect(percentile(sample, 0.99)).toBe(99);
    expect(percentile([], 0.5)).toBe(0);
  });

  test("separa errores 4xx de 5xx y calcula la tasa", () => {
    recordRequest({ method: "GET", path: "/products", status: 200, durationMs: 10 });
    recordRequest({ method: "GET", path: "/products", status: 404, durationMs: 12 });
    recordRequest({ method: "GET", path: "/products", status: 500, durationMs: 90 });
    recordRequest({ method: "GET", path: "/products", status: 200, durationMs: 8 });

    const snapshot = getPerformanceSnapshot();
    const route = snapshot.routes.find((item) => item.route === "GET /products");
    expect(route?.requests).toBe(4);
    expect(route?.errors4xx).toBe(1);
    expect(route?.errors5xx).toBe(1);
    expect(route?.errorRate).toBe(0.5);
    expect(route?.maxMs).toBe(90);
    expect(snapshot.totals.requests).toBe(4);
  });

  test("marca el API como no saludable cuando los 5xx pasan el 5%", () => {
    for (let index = 0; index < 19; index += 1) {
      recordRequest({ method: "GET", path: "/health", status: 200, durationMs: 1 });
    }
    expect(getPerformanceSnapshot().uptime.healthy).toBe(true);
    recordRequest({ method: "GET", path: "/health", status: 503, durationMs: 1 });
    recordRequest({ method: "GET", path: "/health", status: 500, durationMs: 1 });
    expect(getPerformanceSnapshot().uptime.healthy).toBe(false);
  });

  test("filtra por ruta cuando se pide", () => {
    recordRequest({ method: "GET", path: "/products", status: 200, durationMs: 5 });
    recordRequest({ method: "POST", path: "/api/checkout", status: 200, durationMs: 5 });
    expect(getPerformanceSnapshot({ route: "checkout" }).routes).toHaveLength(1);
  });
});
