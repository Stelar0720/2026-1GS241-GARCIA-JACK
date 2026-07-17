import { expect, test, type Page } from "@playwright/test";

async function hasVisibleText(page: Page, text: string) {
  const locator = page.getByText(text, { exact: false }).first();
  return (await locator.count()) > 0 && (await locator.isVisible());
}

async function expectAnyVisibleText(page: Page, texts: string[]) {
  for (const text of texts) {
    if (await hasVisibleText(page, text)) {
      return;
    }
  }
  throw new Error(`No se encontró ninguno de estos textos: ${texts.join(" | ")}`);
}

test("home: muestra hero, catálogo y compra", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("mini huerto");
  await expect(
    page.getByRole("heading", { level: 2, name: "Kits para arrancar en una tarde" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar al carrito" })).toHaveCount(3);

  await expectAnyVisibleText(page, [
    "Iniciar sesión",
    "Configura Clerk para login",
    "Panel",
  ]);
});

test("carrito: persiste en localStorage tras recargar la página", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Agregar al carrito" }).first().click();

  const cartButton = page.getByRole("button", { name: /Carrito con \d+ productos?/ });
  await expect(cartButton).toContainText("1");

  await page.reload();

  await expect(page.getByRole("button", { name: /Carrito con \d+ productos?/ })).toContainText("1");
});

test("carrito: se puede quitar un producto agregado", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Agregar al carrito" }).first().click();
  await expect(page.getByRole("button", { name: /Carrito con \d+ productos?/ })).toContainText("1");

  // El dropdown del carrito se abre al agregar; quitamos con el botón de eliminar.
  await page.getByRole("button", { name: /Eliminar .* del carrito/ }).first().click();
  await expect(page.getByRole("button", { name: /Carrito con \d+ productos?/ })).toContainText("0");
  await expect(page.getByRole("button", { name: "Deshacer" })).toBeVisible();
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByRole("button", { name: /Carrito con \d+ productos?/ })).toContainText("1");
});

test("catálogo: activa VanillaTilt en las tres tarjetas", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator("[data-tilt-card]");
  await expect(cards).toHaveCount(3);
  await expect(cards.first().locator(".js-tilt-glare")).toHaveCount(1);
});

test("experiencia: renderiza cursor personalizado y hero animable", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".cursor-dot")).toHaveCount(1);
  await expect(page.locator(".cursor-ring")).toHaveCount(1);
  await expect(page.locator("[data-hero-reveal]")).toHaveCount(5);
});

test("tema: el toggle claro/oscuro persiste tras recargar", async ({ page }) => {
  await page.goto("/");

  const initialTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.getByRole("button", { name: /Cambiar a modo (claro|oscuro)/ }).click();
  const toggledTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(toggledTheme).not.toBe(initialTheme);

  await page.reload();
  const persistedTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(persistedTheme).toBe(toggledTheme);
});

test("tema: usa la preferencia oscura del sistema cuando no hay valor guardado", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => window.localStorage.removeItem("urbansprout-theme"));
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
});

test("landing: muestra estadísticas, propuesta de valor y testimonios", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("hogares ya cultivan con nosotros")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cultivar en la ciudad, sin fricción" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cómo funciona" })).toBeVisible();
  await expect(page.getByText("María G.")).toBeVisible();
});

test("faq: expande y colapsa una pregunta", async ({ page }) => {
  await page.goto("/");

  const question = page.getByRole("button", { name: "¿Cuánta luz necesita mi kit?" });
  await question.scrollIntoViewIfNeeded();
  await question.click();
  await expect(page.getByText("los microverdes crecen con luz indirecta")).toBeVisible();

  await question.click();
  await expect(page.getByText("los microverdes crecen con luz indirecta")).toHaveCount(0);
});

test("detalle de producto: navega desde el catálogo y agrega al carrito", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Ver detalles" }).first().click();
  await expect(page).toHaveURL(/\/producto\//);
  await expect(page.getByText("Qué incluye la caja")).toBeVisible();
  await expect(page.getByText("Así se cultiva")).toBeVisible();
  await expect(page.getByText("Luz necesaria")).toBeVisible();

  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByRole("button", { name: /Carrito con \d+ productos?/ })).toContainText("1");
});

test("legales: términos, privacidad y devoluciones muestran contenido", async ({ page }) => {
  await page.goto("/terminos");
  await expect(page.getByRole("heading", { name: "Términos y condiciones" })).toBeVisible();

  await page.goto("/privacidad");
  await expect(page.getByRole("heading", { name: "Política de privacidad" })).toBeVisible();

  await page.goto("/devoluciones");
  await expect(page.getByRole("heading", { name: "Envíos y devoluciones" })).toBeVisible();
});

test("footer: contiene los enlaces legales", async ({ page }) => {
  await page.goto("/");

  const footer = page.locator("footer");
  await expect(footer.getByRole("link", { name: "Términos y condiciones" })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Política de privacidad" })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Envíos y devoluciones" })).toBeVisible();
});

test("sign-in: la ruta responde correctamente", async ({ page }) => {
  const response = await page.goto("/sign-in");

  expect(response).not.toBeNull();
  expect(response!.status()).toBeLessThan(500);
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.locator("main")).toBeVisible();
});

test("sign-up: la ruta responde correctamente", async ({ page }) => {
  const response = await page.goto("/sign-up");

  expect(response).not.toBeNull();
  expect(response!.status()).toBeLessThan(500);
  await expect(page).toHaveURL(/\/sign-up/);
  await expect(page.locator("main")).toBeVisible();
});

test("dashboard: protege o renderiza estado esperado", async ({ page }) => {
  const response = await page.goto("/dashboard");
  expect(response).not.toBeNull();
  expect(response!.status()).toBeLessThan(500);

  if (page.url().includes("/sign-in")) {
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.locator("main")).toBeVisible();
    return;
  }

  await expect(page.getByRole("heading", { level: 1, name: "Mi cuenta" })).toBeVisible();
});

test("admin: protege o renderiza estado esperado", async ({ page }) => {
  const response = await page.goto("/admin");
  expect(response).not.toBeNull();
  expect(response!.status()).toBeLessThan(500);
  await expectAnyVisibleText(page, ["Backoffice separado", "Abrir backoffice"]);
});

test("checkout success: muestra confirmación con la referencia de pago", async ({ page }) => {
  const response = await page.goto("/checkout/success?session_id=cs_test_abcdefghijklmnop");
  expect(response).not.toBeNull();
  expect(response!.status()).toBeLessThan(500);

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Gracias por tu compra");
  await expect(page.getByText("cs_test_abcdefgh")).toBeVisible();
});

test("checkout cancelled: muestra motivos comunes y vuelta al catálogo", async ({ page }) => {
  const response = await page.goto("/checkout/cancelled");
  expect(response).not.toBeNull();
  expect(response!.status()).toBeLessThan(500);

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pago cancelado");
  await expect(page.getByRole("link", { name: "Volver al catálogo" })).toBeVisible();
});

test("api checkout: devuelve error controlado para producto inválido", async ({ page }) => {
  const response = await page.request.post("/api/checkout", {
    data: { productId: "producto-inexistente" },
  });

  expect(response.status()).toBeGreaterThanOrEqual(400);
  expect(response.status()).toBeLessThan(600);

  const body = (await response.json()) as { error?: { code?: string; message?: string; details?: unknown } };
  expect(body.error?.code).toBe("INVALID_INPUT");
  expect(typeof body.error?.message).toBe("string");
  expect(body.error).toHaveProperty("details");
});
