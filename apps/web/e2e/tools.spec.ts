import { test, expect } from "@playwright/test";

/**
 * Tools page E2E tests.
 * Unauthenticated: verifies redirects.
 * Authenticated: verifies each calculator tab (1RM, Set %, Plates, Timer).
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
    await page.getByRole("tab", { name: "Calculadora 1RM" }).click();
    await page.getByLabel("Peso (kg)").fill("100");
    await page.getByLabel("Repeticiones").fill("5");
    // Brzycki 1RM for 100kg × 5 reps ≈ 112.5kg
    await expect(page.getByText("1RM estimado")).toBeVisible();
    await expect(page.getByText(/112\.5/).first()).toBeVisible();
  });

  test("Plate calculator shows plates for 100kg [T6.10]", async ({ page }) => {
    await page.goto("/tools");
    await page.getByRole("tab", { name: "Calculadora de discos" }).click();
    await page.getByLabel("Peso objetivo (kg)").fill("100");
    // Default bar 20kg + default plate set → 100.0kg achievable exactly
    await expect(page.getByText("Total cargado")).toBeVisible();
    await expect(page.getByText("100.0")).toBeVisible();
  });

  test("Set calculator shows percentage table [T6.8]", async ({ page }) => {
    await page.goto("/tools");
    await page.getByRole("tab", { name: "Calculadora de series" }).click();
    await page.getByLabel("Peso base (kg)").fill("100");
    // 80% of 100kg = 80kg
    await expect(page.getByText("80%")).toBeVisible();
  });

  test("Timer tab shows countdown and duration presets [T6.11-T6.12]", async ({ page }) => {
    await page.goto("/tools");
    await page.getByRole("tab", { name: "Temporizador" }).click();
    await expect(page.locator("text=/\\d{2}:\\d{2}/")).toBeVisible();
    await expect(page.getByRole("button", { name: "30s" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Iniciar", exact: true })).toBeVisible();
  });
});
