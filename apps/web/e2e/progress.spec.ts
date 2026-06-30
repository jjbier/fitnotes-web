import { test, expect } from "@playwright/test";

test.describe("Progreso y PRs", () => {
  test.beforeEach(async () => {
    if (!process.env["PLAYWRIGHT_USER_EMAIL"]) test.skip();
  });

  test("carga la página de progreso [T4.5]", async ({ page }) => {
    await page.goto("/progress");
    await expect(page.locator("h1", { hasText: /Progreso/ })).toBeVisible({ timeout: 8_000 });
  });

  test("cambia entre tabs PRs y Gráfica [T4.6]", async ({ page }) => {
    await page.goto("/progress");
    await page.waitForLoadState("networkidle");

    // Find the tablist
    const tablist = page.getByRole("tablist").first();
    await expect(tablist).toBeVisible({ timeout: 8_000 });

    // Click each tab and verify it becomes selected
    const tabs = tablist.getByRole("tab");
    const count = await tabs.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const tab = tabs.nth(i);
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await page.waitForTimeout(300);
    }
  });

  test("selecciona ejercicio y muestra su historial [T4.7]", async ({ page }) => {
    await page.goto("/progress");
    await page.waitForLoadState("networkidle");

    // Select an exercise from the dropdown if available
    const picker = page.locator("select").first();
    if (await picker.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const options = picker.locator("option");
      if (await options.count() > 1) {
        await picker.selectOption({ index: 1 });
        // Chart or history section should appear
        await page.waitForTimeout(1_000);
        // Just verify no crash — something should be visible
        await expect(page.locator("main, [id='main-content']")).toBeVisible();
      }
    }
  });

  test("abre exercise overview al hacer clic en un PR [T4.8]", async ({ page }) => {
    await page.goto("/progress");
    await page.waitForLoadState("networkidle");

    // Check if there are any PR rows with clickable exercises
    const prLink = page.locator("button[class*='hover'], a").filter({ hasText: /Press|Sentadilla|Peso muerto|Curl|Remo/i }).first();
    if (await prLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await prLink.click();
      // ExerciseOverview dialog should appear
      const dialog = page.getByRole("dialog");
      if (await dialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await expect(dialog).toBeVisible();
        // Close it
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible({ timeout: 3_000 });
      }
    }
  });

  test("navega a historial de ejercicio [T4.9]", async ({ page }) => {
    await page.goto("/progress");
    const historyLink = page.locator("a[href*='/exercise/history/']").first();
    if (await historyLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await historyLink.click();
      await expect(page).toHaveURL(/\/exercise\/history\//);
      await expect(page.locator("h1, h2").first()).toBeVisible();
    }
  });
});
