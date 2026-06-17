import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("login page loads [T1.14]", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("unauthenticated access to /dashboard redirects to /login [T1.14]", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/login/);
  });

  test("unauthenticated access to /exercise redirects to /login", async ({ page }) => {
    await page.goto("/exercise");
    await expect(page).toHaveURL(/login/);
  });

  test("unauthenticated access to /routines redirects to /login", async ({ page }) => {
    await page.goto("/routines");
    await expect(page).toHaveURL(/login/);
  });

  test("register page loads", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test("login page has link to register", async ({ page }) => {
    await page.goto("/login");
    const registerLink = page.locator("a[href*='register']");
    await expect(registerLink).toBeVisible();
  });

  test("empty login form shows validation error", async ({ page }) => {
    await page.goto("/login");
    await page.locator('button[type="submit"]').click();
    // Should not navigate away — form validation keeps us on /login
    await expect(page).toHaveURL(/login/);
  });
});
