import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type RouteCase = { name: string; url: string; ready?: (page: Page) => Promise<void> };

const routes: RouteCase[] = [
  { name: "storefront home", url: "/" },
  { name: "detalle de producto", url: "/producto/kit-balcon-basico" },
  { name: "términos", url: "/terminos" },
  { name: "checkout cancelado", url: "/checkout/cancelled" },
  { name: "dashboard", url: "/dashboard" },
  {
    name: "backoffice",
    url: "http://localhost:5173",
    ready: async (page) => {
      await expect(page.getByText("Cargando datos del backoffice...")).toHaveCount(0, {
        timeout: 15_000,
      });
    },
  },
];

function workflowEscape(value: string) {
  return value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

for (const route of routes) {
  test(`accesibilidad: ${route.name} cumple WCAG 2.1 AA sin impactos bloqueantes`, async ({ page }) => {
    await page.goto(route.url);
    await route.ready?.(page);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    for (const violation of results.violations) {
      const targets = violation.nodes.flatMap((node) => node.target).join(", ");
      const description = `${route.name}: ${violation.id} (${violation.impact ?? "sin impacto"}) — ${violation.help}. Elementos: ${targets}`;
      test.info().annotations.push({ type: "warning", description });
      if (process.env.CI) console.log(`::warning title=axe ${violation.id}::${workflowEscape(description)}`);
    }

    const blocking = results.violations
      .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        targets: violation.nodes.flatMap((node) => node.target),
      }));

    expect(blocking, `Regresiones de accesibilidad bloqueantes en ${route.name}`).toEqual([]);
  });
}

test("accesibilidad: navegación principal funciona con teclado y Escape", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  const cart = page.getByRole("button", { name: /Carrito con/ });
  await cart.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Resumen del carrito" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Resumen del carrito" })).toHaveCount(0);
  await expect(cart).toBeFocused();
});

test("accesibilidad: todas las imágenes visibles tienen texto alternativo", async ({ page }) => {
  for (const url of ["/", "/producto/kit-balcon-basico", "http://localhost:5173"]) {
    await page.goto(url);
    expect(await page.locator("img:not([alt])").count(), `Imagen sin alt en ${url}`).toBe(0);
  }
});
