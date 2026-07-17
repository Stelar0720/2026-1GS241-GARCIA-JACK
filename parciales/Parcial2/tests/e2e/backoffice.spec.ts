import { expect, test } from "@playwright/test";

const BACKOFFICE_URL = "http://localhost:5173";

test.describe("Backoffice admin", () => {
  test("carga el panel con secciones de Productos y Órdenes", async ({ page }) => {
    await page.goto(BACKOFFICE_URL);

    await expect(page.getByRole("heading", { name: "UrbanSprout Backoffice" })).toBeVisible();
    await expect(page.getByText("Cargando datos del backoffice...")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Productos" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Órdenes" })).toBeVisible();
  });

  test("lista los productos del catálogo", async ({ page }) => {
    await page.goto(BACKOFFICE_URL);

    // Espera a que termine la carga inicial de datos del bun-api.
    await expect(page.getByText("Cargando datos del backoffice...")).toHaveCount(0, { timeout: 15_000 });

    // Debe haber al menos un producto (semilla) o el botón de nuevo producto.
    await expect(page.getByRole("button", { name: "+ Nuevo producto" })).toBeVisible();
  });

  test("abre el modal de nuevo producto y valida el precio", async ({ page }) => {
    await page.goto(BACKOFFICE_URL);
    await expect(page.getByText("Cargando datos del backoffice...")).toHaveCount(0, { timeout: 15_000 });

    await page.getByRole("button", { name: "+ Nuevo producto" }).click();
    await expect(page.getByRole("heading", { name: "Nuevo producto" })).toBeVisible();

    // El precio inválido se reporta al perder el foco y bloquea el submit.
    await page.getByLabel("Nombre del producto *").fill("Kit sin precio");
    await page.getByLabel("Descripción *").fill("Producto de prueba");
    await page.getByLabel("Precio (USD) *").focus();
    await page.getByLabel("Precio (USD) *").blur();
    await expect(page.getByText("El precio debe ser mayor que cero.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar producto" })).toBeDisabled();

    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("heading", { name: "Nuevo producto" })).toHaveCount(0);
  });

  test("crea un producto y luego lo elimina (ciclo completo)", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto(BACKOFFICE_URL);
    await expect(page.getByText("Cargando datos del backoffice...")).toHaveCount(0, { timeout: 15_000 });

    const uniqueName = `Kit E2E ${Date.now()}`;

    await page.getByRole("button", { name: "+ Nuevo producto" }).click();
    await page.getByLabel("Nombre del producto *").fill(uniqueName);
    await page.getByLabel("Descripción *").fill("Creado por Playwright E2E");
    await page.getByLabel("Precio (USD) *").fill("21.5");
    await page.getByLabel("Stock disponible").fill("7");
    await page.getByRole("button", { name: "Guardar producto" }).click();

    // Aparece en la lista.
    await expect(page.getByRole("heading", { name: uniqueName })).toBeVisible({ timeout: 15_000 });

    // Lo eliminamos para dejar el estado limpio (el confirm se acepta arriba).
    const card = page.locator(".product-card", { hasText: uniqueName });
    await card.getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByRole("heading", { name: uniqueName })).toHaveCount(0, { timeout: 15_000 });
  });

  test("gestiona invitación, rol y suspensión de un usuario", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto(BACKOFFICE_URL);
    await expect(page.getByText("Cargando datos del backoffice...")).toHaveCount(0, { timeout: 15_000 });

    await page.getByLabel("Clave administrativa").fill("e2e-admin-key");
    await page.getByRole("button", { name: "Validar clave" }).click();
    const email = `panel-${Date.now()}@urbansprout.test`;
    await page.getByLabel("Nombre del usuario").fill("Panel Support");
    await page.getByLabel("Email del usuario").fill(email);
    await page.getByRole("button", { name: "Invitar usuario" }).click();
    await expect(page.getByText(email)).toBeVisible();

    await page.getByLabel(`Rol de ${email}`).selectOption("admin");
    await expect(page.getByLabel(`Rol de ${email}`)).toHaveValue("admin");
    const userCard = page.locator(".user-card", { hasText: email });
    await userCard.getByRole("button", { name: "Suspender" }).click();
    await expect(userCard.getByText("suspended")).toBeVisible();
  });
});
