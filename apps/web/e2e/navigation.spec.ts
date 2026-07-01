import { test, expect } from "@playwright/test";

// Mismas 6 secciones que las tabs de la app mobile — Medidas corporales y
// Herramientas ya no son ítems de primer nivel, se acceden desde Configuración.
const NAV_LINKS = [
  { name: "Hoy", url: /\/dashboard/, heading: /Entrenamiento/ },
  { name: "Calendario", url: /\/calendar/, heading: "Calendario" },
  { name: "Ejercicios", url: /\/exercise/, heading: "Ejercicios" },
  { name: "Progreso", url: /\/progress/, heading: "Progreso" },
  { name: "Rutinas", url: /\/routines/, heading: "Rutinas" },
  { name: "Configuración", url: /\/settings/, heading: "Configuración" },
] as const;

test.describe("Navegación global", () => {
  test.beforeEach(async ({ page }) => {
    const email = process.env["PLAYWRIGHT_USER_EMAIL"];
    const password = process.env["PLAYWRIGHT_USER_PASSWORD"];
    if (!email || !password) {
      test.skip();
      return;
    }
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/dashboard/);
  });

  test("recorre todas las rutas del sidebar sin errores de consola", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    const nav = page.getByRole("navigation", { name: "Navegación principal" });

    for (const { name, url, heading } of NAV_LINKS) {
      await nav.getByRole("link", { name }).click();
      await expect(page).toHaveURL(url);
      await expect(page.locator("h1", { hasText: heading }).first()).toBeVisible({ timeout: 8_000 });
    }

    expect(errors, `Errores de consola encontrados:\n${errors.join("\n")}`).toEqual([]);
  });

  test("sidebar solo tiene 6 secciones (igual que las tabs de mobile)", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav.getByRole("link")).toHaveCount(6);
    await expect(nav.getByRole("link", { name: "Medidas corporales" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Herramientas" })).toHaveCount(0);
  });

  test("Medidas corporales y Herramientas se acceden desde Configuración", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("link", { name: "Medidas corporales" }).click();
    await expect(page).toHaveURL(/\/body-tracker/);

    await page.goto("/settings");
    await page.getByRole("link", { name: "Calculadoras de entrenamiento" }).click();
    await expect(page).toHaveURL(/\/tools/);
  });

  test("el link activo del sidebar recibe aria-current=page", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Navegación principal" });

    await nav.getByRole("link", { name: "Calendario" }).click();
    await expect(page).toHaveURL(/\/calendar/);
    await expect(nav.getByRole("link", { name: "Calendario" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Hoy" })).not.toHaveAttribute("aria-current", "page");

    await nav.getByRole("link", { name: "Rutinas" }).click();
    await expect(page).toHaveURL(/\/routines/);
    await expect(nav.getByRole("link", { name: "Rutinas" })).toHaveAttribute("aria-current", "page");
  });

  test("búsqueda global de ejercicios desde Ejercicios [paridad con mobile]", async ({ page }) => {
    await page.goto("/exercise");
    await page.getByRole("link", { name: "Historial de búsqueda" }).click();
    await expect(page).toHaveURL(/\/search/);
    await expect(page.getByPlaceholder("Buscar ejercicio…")).toBeVisible();
  });
});
