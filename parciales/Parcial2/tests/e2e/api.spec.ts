import { expect, test } from "@playwright/test";

// Tests directos contra el bun-api (levantado por `npm run dev` en :4000).
// Deterministas: no dependen del contenido de la base, solo del contrato.
const API_URL = process.env.E2E_API_URL ?? "http://localhost:4010";

test("health: el API responde ok sin autenticación", async ({ request }) => {
  const response = await request.get(`${API_URL}/health`);
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { ok: boolean; service: string };
  expect(body.ok).toBe(true);
  expect(body.service).toContain("urbansprout");
});

test("products: devuelve la lista de productos activos", async ({ request }) => {
  const response = await request.get(`${API_URL}/products`);
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { data: unknown[] };
  expect(Array.isArray(body.data)).toBe(true);
});

test("auth/whoami: sin key resuelve rol público", async ({ request }) => {
  const response = await request.get(`${API_URL}/auth/whoami`);
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { role: string; permissions: string[] };
  expect(body.role).toBe("public");
  expect(body.permissions).toEqual([]);
});

test("auth/roles: sin key rechaza con 401", async ({ request }) => {
  const response = await request.get(`${API_URL}/auth/roles`);
  expect(response.status()).toBe(401);
});

test("reports/sales: sin key rechaza con 401", async ({ request }) => {
  const response = await request.get(`${API_URL}/reports/sales`);
  expect(response.status()).toBe(401);
});

test("orders/sync: sin key rechaza con 401", async ({ request }) => {
  const response = await request.post(`${API_URL}/orders/sync`);
  expect(response.status()).toBe(401);
});
