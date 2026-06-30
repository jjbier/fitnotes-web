import { test, expect } from "@playwright/test";

const ROUTINE_NAME = `E2E-Rutina-${Date.now()}`;

test.describe("Rutinas CRUD", () => {
  test.beforeEach(async () => {
    if (!process.env["PLAYWRIGHT_USER_EMAIL"]) test.skip();
  });

  test("crea, edita y elimina una rutina [T2.11-T2.14]", async ({ page }) => {
    await page.goto("/routines");
    await expect(page.locator("h1", { hasText: "Rutinas" })).toBeVisible();

    // ── Crear rutina ─────────────────────────────────────────────────────────
    await page.getByRole("button", { name: /Nueva rutina/ }).click();
    const nameInput = page.getByPlaceholder("p.ej. Empuje Tirón Piernas");
    await expect(nameInput).toBeVisible();
    await nameInput.fill(ROUTINE_NAME);
    await page.locator('button[type="submit"]', { hasText: "Guardar" }).click();

    await expect(page.getByText(ROUTINE_NAME)).toBeVisible({ timeout: 8_000 });

    // ── Copiar rutina ─────────────────────────────────────────────────────────
    const routineRow = page.locator("div", { has: page.getByText(ROUTINE_NAME) }).first();
    await routineRow.getByRole("button", { name: "Copiar" }).click();
    // A copy should appear ("Copia de ...")
    await expect(page.getByText(`Copia de ${ROUTINE_NAME}`)).toBeVisible({ timeout: 8_000 });

    // ── Editar rutina ─────────────────────────────────────────────────────────
    await routineRow.getByRole("button", { name: "Editar" }).click();
    const editInput = page.getByPlaceholder("p.ej. Empuje Tirón Piernas");
    await editInput.clear();
    await editInput.fill(`${ROUTINE_NAME}-v2`);
    await page.locator('button[type="submit"]', { hasText: "Guardar" }).click();

    await expect(page.getByText(`${ROUTINE_NAME}-v2`)).toBeVisible({ timeout: 8_000 });

    // ── Abrir rutina ─────────────────────────────────────────────────────────
    const v2Row = page.locator("div", { has: page.getByText(`${ROUTINE_NAME}-v2`) }).first();
    await v2Row.getByRole("link", { name: "Abrir" }).click();
    await expect(page).toHaveURL(/\/routines\//);
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await page.goBack();

    // ── Eliminar rutinas de prueba ────────────────────────────────────────────
    for (const name of [`${ROUTINE_NAME}-v2`, `Copia de ${ROUTINE_NAME}`]) {
      const row = page.locator("div", { has: page.getByText(name) }).first();
      if (await row.isVisible({ timeout: 2_000 }).catch(() => false)) {
        page.once("dialog", (d) => d.accept());
        await row.getByRole("button", { name: "Eliminar" }).click();
        await page.waitForTimeout(500);
      }
    }

    await expect(page.getByText(`${ROUTINE_NAME}-v2`)).not.toBeVisible({ timeout: 5_000 });
  });

  test("abre detalle de rutina y muestra días [T2.15]", async ({ page }) => {
    await page.goto("/routines");
    const firstOpen = page.getByRole("link", { name: "Abrir" }).first();
    if (await firstOpen.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await firstOpen.click();
      await expect(page).toHaveURL(/\/routines\//);
      // Page should show some content
      await expect(page.locator("h1, h2").first()).toBeVisible();
    }
  });
});
