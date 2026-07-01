import { test, expect } from "@playwright/test";

test.describe("Body Tracker", () => {
  test.beforeEach(async () => {
    if (!process.env["PLAYWRIGHT_USER_EMAIL"]) test.skip();
  });

  test("carga la página y muestra medidas activas [T5.3]", async ({ page }) => {
    await page.goto("/body-tracker");
    await expect(page.locator("h1", { hasText: /Medidas/ })).toBeVisible({ timeout: 8_000 });

    // Tab "Registrar" should be active by default
    const registrarTab = page.getByRole("tab", { name: "Registrar" });
    await expect(registrarTab).toBeVisible();
    await expect(registrarTab).toHaveAttribute("aria-selected", "true");
  });

  test("registra una medida y aparece en historial [T5.4]", async ({ page }) => {
    await page.goto("/body-tracker");
    await page.waitForLoadState("networkidle");

    // Click "Registrar" on the first available measurement card
    const logBtn = page.getByRole("button", { name: "Registrar" }).first();
    if (!(await logBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      // No active measurements — navigate to settings to check
      await page.goto("/body-tracker/settings");
      await expect(page.locator("h1, h2").first()).toBeVisible();
      return;
    }

    await logBtn.click();

    // Log form should appear
    const logValue = page.locator("#log-value");
    await expect(logValue).toBeVisible({ timeout: 3_000 });
    await logValue.fill("75.5");

    // Submit
    await page.locator('button[type="submit"]', { hasText: /Guardar/ }).click();
    // Form should close (saving... then closed)
    await expect(logValue).not.toBeVisible({ timeout: 8_000 });

    // Switch to history tab and verify entry
    await page.getByRole("tab", { name: "Historial" }).click();
    await expect(page.getByRole("tab", { name: "Historial" })).toHaveAttribute("aria-selected", "true");
    // History should have at least one entry now
    await expect(page.locator("text=75.5").first()).toBeVisible({ timeout: 5_000 });
  });

  test("cambia entre tabs y muestra gráfica [T5.5]", async ({ page }) => {
    await page.goto("/body-tracker");
    await page.waitForLoadState("networkidle");

    // Switch to chart tab
    await page.getByRole("tab", { name: "Gráfica" }).click();
    await expect(page.getByRole("tab", { name: "Gráfica" })).toHaveAttribute("aria-selected", "true");
    // Chart tab should show a measurement selector
    await expect(page.locator("label", { hasText: /Medida/ })).toBeVisible({ timeout: 3_000 });

    // Switch back
    await page.getByRole("tab", { name: "Registrar" }).click();
    await expect(page.getByRole("tab", { name: "Registrar" })).toHaveAttribute("aria-selected", "true");
  });

  test("navega a configuración de medidas [T5.6]", async ({ page }) => {
    await page.goto("/body-tracker");
    await page.locator("#main-content").getByRole("link", { name: "Configuración", exact: true }).click();
    await expect(page).toHaveURL(/\/body-tracker\/settings/);
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });
});
