import { test, expect } from "@playwright/test";

const CAT_NAME = `E2E-Cat-${Date.now()}`;
const EX_NAME = `E2E-Ejercicio-${Date.now()}`;

test.describe("Ejercicios CRUD", () => {
  test.beforeEach(async () => {
    if (!process.env["PLAYWRIGHT_USER_EMAIL"]) test.skip();
  });

  test("crea categoría, crea ejercicio, toggle favorito, edita, elimina [T3.1-T3.5]", async ({ page }) => {
    await page.goto("/exercise");
    await expect(page.locator("h1", { hasText: "Ejercicios" })).toBeVisible();

    // ── Crear categoría ──────────────────────────────────────────────────────
    await page.getByText("+ Nueva categoría").click();
    await page.locator("#cat-name").fill(CAT_NAME);
    // Submit CategoryForm (button text "Crear" when no initial.id)
    await page.locator('button[type="submit"]', { hasText: /Crear/ }).click();

    // Category should appear in the list
    await expect(page.getByText(CAT_NAME)).toBeVisible({ timeout: 8_000 });

    // ── Navegar a la categoría ───────────────────────────────────────────────
    await page.getByRole("link", { name: CAT_NAME }).click();
    await expect(page.locator("h1", { hasText: CAT_NAME })).toBeVisible();

    // ── Crear ejercicio ──────────────────────────────────────────────────────
    await page.getByText("+ Nuevo ejercicio").click();
    await page.locator("#ex-name").fill(EX_NAME);
    // Keep default type (Peso × Repeticiones) and unit (kg)
    await page.locator('button[type="submit"]', { hasText: /Crear/ }).click();

    // Exercise should appear in the virtualized list
    await expect(page.getByText(EX_NAME)).toBeVisible({ timeout: 8_000 });

    // ── Toggle favorito ──────────────────────────────────────────────────────
    await page.getByRole("button", { name: "Añadir a favoritos" }).first().click();
    // Star should now be filled (aria-label changes)
    await expect(page.getByRole("button", { name: "Quitar de favoritos" })).toBeVisible({ timeout: 5_000 });

    // Toggle back
    await page.getByRole("button", { name: "Quitar de favoritos" }).click();
    await expect(page.getByRole("button", { name: "Añadir a favoritos" })).toBeVisible({ timeout: 5_000 });

    // ── Editar ejercicio ─────────────────────────────────────────────────────
    await page.getByRole("button", { name: "Opciones" }).first().click();
    await page.getByRole("menuitem", { name: "Editar" }).click();

    const updatedName = `${EX_NAME}-ed`;
    await page.locator("#ex-name").clear();
    await page.locator("#ex-name").fill(updatedName);
    await page.locator('button[type="submit"]', { hasText: /Actualizar/ }).click();

    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 8_000 });

    // ── Eliminar ejercicio ───────────────────────────────────────────────────
    await page.getByRole("button", { name: "Opciones" }).first().click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("menuitem", { name: "Eliminar" }).click();

    await expect(page.getByText(updatedName)).not.toBeVisible({ timeout: 8_000 });

    // ── Eliminar categoría ───────────────────────────────────────────────────
    await page.goto("/exercise");
    const catRow = page.locator("p", { hasText: CAT_NAME }).locator("xpath=ancestor::div[contains(@class,'bg-card')][1]");
    await catRow.hover();
    page.once("dialog", (dialog) => dialog.accept());
    await catRow.getByRole("button", { name: "Eliminar" }).click();

    await expect(page.getByText(CAT_NAME)).not.toBeVisible({ timeout: 8_000 });
  });

  test("busca ejercicios globalmente [T3.6]", async ({ page }) => {
    await page.goto("/exercise");
    const search = page.locator("#exercise-search");
    await search.fill("press");
    // Results section should appear (even if empty)
    await expect(page.locator("text=/resultado/i")).toBeVisible({ timeout: 5_000 });
  });
});
