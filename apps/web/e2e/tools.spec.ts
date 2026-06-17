import { test, expect } from "@playwright/test";

/**
 * Tools page E2E tests.
 * Unauthenticated: verifies redirects.
 * With auth fixture (future): verifies calculator UI.
 */

test.describe("Tools redirect [T6.7]", () => {
  test("unauthenticated /tools redirects to login", async ({ page }) => {
    await page.goto("/tools");
    await expect(page).toHaveURL(/login/);
  });
});

/**
 * Authenticated tests require a test user.
 * Set PLAYWRIGHT_USER_EMAIL and PLAYWRIGHT_USER_PASSWORD env vars to enable.
 * These tests are skipped if credentials are not provided.
 */
test.describe("Tools calculators (authenticated)", () => {
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
    await page.waitForURL(/dashboard|tools/);
  });

  test("1RM calculator shows result table [T6.7]", async ({ page }) => {
    await page.goto("/tools");
    await page.locator("button", { hasText: "1RM" }).click();
    // Fill weight and reps
    const weightInput = page.locator('input[placeholder*="100"], input[placeholder*="peso"], input[type="number"]').first();
    await weightInput.fill("100");
    const repsInput = page.locator('input[placeholder*="5"], input[placeholder*="reps"]').first();
    await repsInput.fill("5");
    // Result table should appear
    await expect(page.locator("text=1RM")).toBeVisible();
    // 1RM should be approximately 116
    await expect(page.locator("text=/116\\.\\d/")).toBeVisible();
  });

  test("Plate calculator shows plates for 100kg [T6.10]", async ({ page }) => {
    await page.goto("/tools");
    await page.locator("button", { hasText: /Plate/i }).click();
    const targetInput = page.locator('input[placeholder*="140"], input[placeholder*="100"]').first();
    await targetInput.fill("100");
    // Should show 20kg plates
    await expect(page.locator("text=/20/")).toBeVisible();
  });

  test("Set calculator shows percentage table [T6.8]", async ({ page }) => {
    await page.goto("/tools");
    await page.locator("button", { hasText: /Set/i }).click();
    const baseInput = page.locator('input[placeholder*="100"]').first();
    await baseInput.fill("100");
    // 80% of 100 = 80kg
    await expect(page.locator("text=80%")).toBeVisible();
  });
});
