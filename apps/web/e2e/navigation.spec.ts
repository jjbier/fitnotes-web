import { test, expect } from "@playwright/test";

const NAV_LINKS = [
  { name: "Hoy", url: /\/dashboard/, heading: /Entrenamiento/ },
  { name: "Calendario", url: /\/calendar/, heading: "Calendario" },
  { name: "Ejercicios", url: /\/exercise/, heading: "Ejercicios" },
  { name: "Progreso", url: /\/progress/, heading: "Progreso" },
  { name: "Rutinas", url: /\/routines/, heading: "Rutinas" },
  { name: "Medidas corporales", url: /\/body-tracker/, heading: "Medidas corporales" },
  { name: "Herramientas", url: /\/tools/, heading: /Herramientas/ },
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
});
