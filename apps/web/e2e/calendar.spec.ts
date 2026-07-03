import { test, expect } from "@playwright/test";

test.describe("Calendario", () => {
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
    await page.goto("/calendar");
    await expect(page.locator("h1", { hasText: "Calendario" })).toBeVisible();
  });

  test("cambia entre vista mes y lista [T5.x]", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
    await page.getByRole("button", { name: "Lista" }).click();
    await expect(page.getByRole("button", { name: "Mes" })).toBeVisible();
    await page.getByRole("button", { name: "Mes" }).click();
    await expect(page.getByRole("button", { name: "Lista" })).toBeVisible();
  });

  test("alterna puntos de categoría y panel del día [T5.x]", async ({ page }) => {
    const dotsToggle = page.getByTitle(/puntos de categoría|indicador único/);
    await expect(dotsToggle).toBeVisible();
    const dotsPressedBefore = await dotsToggle.getAttribute("aria-pressed");
    await dotsToggle.click();
    await expect(dotsToggle).toHaveAttribute("aria-pressed", dotsPressedBefore === "true" ? "false" : "true");
    await dotsToggle.click(); // restaurar

    const panelToggle = page.getByTitle(/panel del día/);
    await expect(panelToggle).toBeVisible();
    const panelPressedBefore = await panelToggle.getAttribute("aria-pressed");
    await panelToggle.click();
    await expect(panelToggle).toHaveAttribute("aria-pressed", panelPressedBefore === "true" ? "false" : "true");
    await panelToggle.click(); // restaurar
  });

  test("abre el panel de un día con entrenamiento y navega a un ejercicio [T5.x]", async ({ page }) => {
    // El workout sembrado de "ayer" puede caer en el mes anterior si hoy es día 1 o 2.
    const today = new Date();
    let dayNum = today.getDate() - 1;
    if (dayNum <= 0) {
      await page.getByRole("button", { name: "Mes anterior" }).click();
      await expect(page.getByRole("heading", { level: 2 }).first()).toContainText("junio");
      dayNum = 30;
    }
    // Esperar a que termine de cargar el mes antes de clicar el día — si no,
    // se puede clicar con los datos del mes anterior aún en memoria.
    await expect(page.getByText("Cargando…")).not.toBeVisible({ timeout: 8_000 }).catch(() => {});
    await page.getByRole("button", { name: String(dayNum), exact: true }).click();

    const openLink = page.getByRole("link", { name: "Abrir entrenamiento →" });
    await expect(openLink).toBeVisible({ timeout: 5_000 });

    const dayPanel = page.locator('[data-testid="calendar-day-panel"]');
    const exerciseChip = dayPanel.getByRole("button").first();
    if (await exerciseChip.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await exerciseChip.click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
      await page.keyboard.press("Escape");
    }
  });

  test("abre filtros y activa un filtro de categoría [T5.x]", async ({ page }) => {
    await page.getByRole("button", { name: "Filtros" }).click();
    await expect(page.getByText("Categorías musculares")).toBeVisible({ timeout: 5_000 });
    const firstCategory = page.locator('[data-testid="calendar-category-filters"]')
      .getByRole("button")
      .first();
    await expect(firstCategory).toBeVisible();
    await firstCategory.click();
    await expect(page.getByRole("button", { name: "Limpiar" })).toBeVisible();
    await page.getByRole("button", { name: "Limpiar" }).click();
    await expect(page.getByRole("button", { name: "Limpiar" })).not.toBeVisible();
  });

  test("lista: expande un registro del historial [T5.x]", async ({ page }) => {
    await page.getByRole("button", { name: "Lista" }).click();
    const firstRow = page.locator("button").filter({ hasText: /\d{4}/ }).first();
    if (await firstRow.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstRow.click();
      await expect(page.getByRole("button", { name: "▲" }).first()).toBeVisible({ timeout: 5_000 });
    }
  });
});
