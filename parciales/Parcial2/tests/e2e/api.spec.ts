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

test("auth/whoami: la key CI solo obtiene permiso de QA", async ({ request }) => {
  const response = await request.get(`${API_URL}/auth/whoami`, { headers: { Authorization: "Bearer e2e-ci-key" } });
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toEqual({ role: "ci", permissions: ["qa:run"] });
});

test("auth/roles: sin key rechaza con 401", async ({ request }) => {
  const response = await request.get(`${API_URL}/auth/roles`);
  expect(response.status()).toBe(401);
});

test("usuarios admin: invita, busca, cambia rol y suspende con key admin", async ({ request }) => {
  const headers = { Authorization: "Bearer e2e-admin-key" };
  const email = `qa-${Date.now()}@urbansprout.test`;
  const invited = await request.post(`${API_URL}/admin/users/invite`, {
    headers,
    data: { name: "QA Support", email, role: "support" },
  });
  expect(invited.status()).toBe(201);
  const user = ((await invited.json()) as { data: { id: string } }).data;

  const search = await request.get(`${API_URL}/admin/users?q=${encodeURIComponent(email)}`, { headers });
  expect(search.status()).toBe(200);
  expect(((await search.json()) as { data: unknown[] }).data).toHaveLength(1);

  const promoted = await request.patch(`${API_URL}/admin/users/${user.id}`, { headers, data: { role: "admin" } });
  expect(promoted.status()).toBe(200);
  expect(((await promoted.json()) as { data: { role: string } }).data.role).toBe("admin");

  const suspended = await request.patch(`${API_URL}/admin/users/${user.id}`, { headers, data: { status: "suspended" } });
  expect(suspended.status()).toBe(200);
  expect(((await suspended.json()) as { data: { status: string } }).data.status).toBe("suspended");
});

test("usuarios admin: rechaza gestión sin key admin", async ({ request }) => {
  const response = await request.get(`${API_URL}/admin/users`);
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

test("catálogo e inventario: rechazan mutaciones sin key admin", async ({ request }) => {
  const product = await request.post(`${API_URL}/products`, {
    data: { name: "No autorizado", description: "Intento", priceUsd: 10 },
  });
  const inventory = await request.patch(`${API_URL}/inventory/kit-inicio`, {
    data: { stock: 5, minimumStock: 1 },
  });
  expect(product.status()).toBe(401);
  expect(inventory.status()).toBe(401);
});

test("observabilidad: el feed requiere permisos", async ({ request }) => {
  const logs = await request.get(`${API_URL}/observability/logs`);
  const errors = await request.get(`${API_URL}/observability/errors`);
  expect(logs.status()).toBe(401);
  expect(errors.status()).toBe(401);
});

test("rate limiting: se configura sin reiniciar y responde Retry-After", async ({ request }) => {
  const headers = { Authorization: "Bearer e2e-admin-key" };
  const path = `/qa-rate-limit-${Date.now()}`;
  const configured = await request.post(`${API_URL}/rate-limits`, {
    headers,
    data: { method: "GET", path, limit: 1, windowSeconds: 30 },
  });
  expect(configured.status()).toBe(200);

  expect((await request.get(`${API_URL}${path}`)).status()).toBe(404);
  const limited = await request.get(`${API_URL}${path}`);
  expect(limited.status()).toBe(429);
  expect(Number(limited.headers()["retry-after"])).toBeGreaterThan(0);
  expect(((await limited.json()) as { error: { code: string } }).error.code).toBe("RATE_LIMITED");
});

test("commerce taxonomy and deterministic coupon", async ({ request }) => {
  const taxonomy = await request.get(`${API_URL}/products/taxonomy`);
  expect(taxonomy.status()).toBe(200);
  const taxonomyBody = (await taxonomy.json()) as { data: { categories: string[]; tags: string[] } };
  expect(taxonomyBody.data.categories.length).toBeGreaterThan(1);
  expect(taxonomyBody.data.tags.length).toBeGreaterThan(1);
  const coupon = await request.post(`${API_URL}/coupons/validate`, { data: { code: "welcome10", subtotalUsd: 100 } });
  expect(coupon.status()).toBe(200);
  expect(await coupon.json()).toMatchObject({ data: { code: "WELCOME10", discountUsd: 10, totalUsd: 90 } });
});

test("wishlist isolates authenticated customers", async ({ request }) => {
  const productsResponse = await request.get(`${API_URL}/products`);
  const productId = ((await productsResponse.json()) as { data: { id: string }[] }).data[0].id;
  const headers = { Authorization: "Bearer e2e-client-key", "X-Customer-Id": "e2e-customer-a" };
  expect((await request.post(`${API_URL}/wishlist/${productId}`, { headers })).status()).toBe(201);
  const own = await request.get(`${API_URL}/wishlist`, { headers });
  expect(((await own.json()) as { data: { id: string }[] }).data.map((item) => item.id)).toContain(productId);
  const other = await request.get(`${API_URL}/wishlist`, { headers: { Authorization: "Bearer e2e-client-key", "X-Customer-Id": "e2e-customer-b" } });
  expect(((await other.json()) as { data: unknown[] }).data).toHaveLength(0);
  expect((await request.delete(`${API_URL}/wishlist/${productId}`, { headers })).status()).toBe(200);
});

test("reviews are public but creation requires a verified purchase", async ({ request }) => {
  const productsResponse = await request.get(`${API_URL}/products`);
  const productId = ((await productsResponse.json()) as { data: { id: string }[] }).data[0].id;
  expect((await request.get(`${API_URL}/products/${productId}/reviews`)).status()).toBe(200);
  const rejected = await request.post(`${API_URL}/products/${productId}/reviews`, {
    headers: { Authorization: "Bearer e2e-client-key", "X-Customer-Id": "e2e-customer-no-purchase" },
    data: { rating: 5, comment: "Un kit excelente para el apartamento." },
  });
  expect(rejected.status()).toBe(403);
});

test("API keys: create, authenticate, rotate and revoke without exposing hashes", async ({ request }) => {
  const adminHeaders = { Authorization: "Bearer e2e-admin-key" };
  const created = await request.post(`${API_URL}/admin/api-keys`, { headers: adminHeaders, data: { name: `QA integration ${Date.now()}`, permissions: ["catalog:read"], expiresAt: null } });
  expect(created.status()).toBe(201);
  const createdBody = (await created.json()) as { data: { id: string; secretHash?: string }; token: string };
  expect(createdBody.token).toMatch(/^usk_/);
  expect(createdBody.data.secretHash).toBeUndefined();
  expect((await request.get(`${API_URL}/integrations/catalog`, { headers: { Authorization: `Bearer ${createdBody.token}` } })).status()).toBe(200);

  const rotated = await request.post(`${API_URL}/admin/api-keys/${createdBody.data.id}/rotate`, { headers: adminHeaders });
  expect(rotated.status()).toBe(200);
  const rotatedBody = (await rotated.json()) as { data: { id: string }; token: string };
  expect((await request.get(`${API_URL}/integrations/catalog`, { headers: { Authorization: `Bearer ${createdBody.token}` } })).status()).toBe(401);
  expect((await request.get(`${API_URL}/integrations/catalog`, { headers: { Authorization: `Bearer ${rotatedBody.token}` } })).status()).toBe(200);
  expect((await request.post(`${API_URL}/admin/api-keys/${rotatedBody.data.id}/revoke`, { headers: adminHeaders })).status()).toBe(200);
  expect((await request.get(`${API_URL}/integrations/catalog`, { headers: { Authorization: `Bearer ${rotatedBody.token}` } })).status()).toBe(401);
});

test("data operations: migrations and confirmed backups are admin-only", async ({ request }) => {
  const headers = { Authorization: "Bearer e2e-admin-key" };
  const migrations = await request.get(`${API_URL}/admin/migrations`, { headers });
  expect(migrations.status()).toBe(200);
  expect(((await migrations.json()) as { data: { applied: boolean }[] }).data.every((item) => item.applied)).toBe(true);
  const backup = await request.post(`${API_URL}/admin/backups`, { headers });
  expect(backup.status()).toBe(201);
  const id = ((await backup.json()) as { data: { id: string } }).data.id;
  expect((await request.post(`${API_URL}/admin/backups/${id}/restore`, { headers, data: { confirmation: "WRONG" } })).status()).toBe(400);
  expect((await request.get(`${API_URL}/admin/backups`)).status()).toBe(401);
});

test("GDPR: exports personal data and deletes it with explicit confirmation", async ({ request }) => {
  const customerId = `gdpr-${Date.now()}`;
  const headers = { Authorization: "Bearer e2e-client-key", "X-Customer-Id": customerId };
  const products = await request.get(`${API_URL}/products`);
  const productId = ((await products.json()) as { data: { id: string }[] }).data[0].id;
  await request.post(`${API_URL}/wishlist/${productId}`, { headers });
  const exported = await request.get(`${API_URL}/me/data`, { headers });
  expect(exported.status()).toBe(200);
  expect(await exported.json()).toMatchObject({ userId: customerId, data: { wishlist: [{ productId }] } });
  expect((await request.delete(`${API_URL}/me/data`, { headers, data: { confirm: "NO" } })).status()).toBe(400);
  const deleted = await request.delete(`${API_URL}/me/data`, { headers, data: { confirm: "DELETE_MY_DATA" } });
  expect(deleted.status()).toBe(200);
  expect(await deleted.json()).toMatchObject({ data: { deletedWishlistItems: 1 }, clerkAccountDeletionRequired: true });
});
