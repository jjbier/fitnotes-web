import { test, expect } from "@playwright/test";

/**
 * Redirect tests for routes added in Phases 5 and 6.
 * All pages require authentication — unauthenticated access must redirect to /login.
 */

test.describe("Phase 5 — Body Tracker routes", () => {
  test("unauthenticated /body-tracker redirects to login [T5.1]", async ({ page }) => {
    await page.goto("/body-tracker");
    await expect(page).toHaveURL(/login/);
  });

  test("unauthenticated /body-tracker/settings redirects to login [T5.2]", async ({ page }) => {
    await page.goto("/body-tracker/settings");
    await expect(page).toHaveURL(/login/);
  });
});

test.describe("Phase 6 — Tools timer tab (authenticated)", () => {
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

  test("tools page has timer tab [T6.11]", async ({ page }) => {
    await page.goto("/tools");
    await expect(page.locator("button", { hasText: /Temporizador/i })).toBeVisible();
  });

  test("timer tab shows countdown display [T6.12]", async ({ page }) => {
    await page.goto("/tools");
    await page.locator("button", { hasText: /Temporizador/i }).click();
    // Should show MM:SS format
    await expect(page.locator("text=/\\d{2}:\\d{2}/")).toBeVisible();
    // Should show preset buttons
    await expect(page.locator("button", { hasText: "1:30" }).or(page.locator("button", { hasText: "90s" }))).toBeVisible();
  });

  test("1RM calculator has exercise PR selector [T6.13]", async ({ page }) => {
    await page.goto("/tools");
    await page.locator("button", { hasText: /1RM/i }).first().click();
    await expect(page.locator("text=/ejercicio/i")).toBeVisible();
  });

  test("set calculator has exercise PR selector [T6.14]", async ({ page }) => {
    await page.goto("/tools");
    await page.locator("button", { hasText: /series/i }).first().click();
    await expect(page.locator("text=/ejercicio/i")).toBeVisible();
  });
});

test.describe("Phase 7 — Settings recalculate PRs (authenticated)", () => {
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
    await page.waitForURL(/dashboard|settings/);
  });

  test("settings page has recalculate PRs button [T7.1]", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("button", { hasText: /Recalcular PRs/i })).toBeVisible();
  });
});
