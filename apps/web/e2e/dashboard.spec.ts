import { test, expect } from "@playwright/test";

test.describe("Dashboard (Hoy)", () => {
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

  test("carga hoy sin entrenamiento y el día siguiente está deshabilitado [T2.0]", async ({ page }) => {
    await expect(page.locator("h1", { hasText: "Entrenamiento de hoy" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Día siguiente" })).toBeDisabled();
  });

  test("navegar a un día sin entrenamiento no deja datos del día anterior [regression]", async ({ page }) => {
    // Día -1 (ayer) tiene workout sembrado; día -2 no tiene ninguno.
    await page.getByRole("button", { name: "Día anterior" }).click();
    await expect(page.getByRole("button", { name: "Finalizar" })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole("tablist", { name: "Ejercicios del entrenamiento" })).toBeVisible();

    await page.getByRole("button", { name: "Día anterior" }).click();
    await expect(page.getByText("Sin entrenamiento para este día.")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole("tablist", { name: "Ejercicios del entrenamiento" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Finalizar" })).not.toBeVisible();
  });

  test("edita y restaura la nota del entrenamiento [T2.x]", async ({ page }) => {
    // Usar el workout de hace 3 días (no lo toca ningún otro spec ni queda
    // finalizado, a diferencia del de "ayer" que workout.spec.ts finaliza).
    await page.getByRole("button", { name: "Día anterior" }).click();
    await page.getByRole("button", { name: "Día anterior" }).click();
    await page.getByRole("button", { name: "Día anterior" }).click();
    const comment = page.getByPlaceholder("Añadir nota al entrenamiento…");
    await expect(comment).toBeVisible({ timeout: 8_000 });
    const original = await comment.inputValue();

    await comment.fill("Nota temporal E2E");
    await comment.blur();
    await page.waitForTimeout(500);

    // El dashboard no persiste la fecha en la URL — en vez de recargar,
    // navegar fuera y volver fuerza un fetch fresco desde la DB y confirma
    // que el guardado fue real (no solo estado local optimista).
    await page.getByRole("button", { name: "Día siguiente" }).click();
    await page.getByRole("button", { name: "Día siguiente" }).click();
    await page.getByRole("button", { name: "Día siguiente" }).click();
    await page.getByRole("button", { name: "Día anterior" }).click();
    await page.getByRole("button", { name: "Día anterior" }).click();
    await page.getByRole("button", { name: "Día anterior" }).click();
    await expect(page.getByPlaceholder("Añadir nota al entrenamiento…")).toHaveValue("Nota temporal E2E", { timeout: 8_000 });

    // Dejar el dato como estaba
    const commentAgain = page.getByPlaceholder("Añadir nota al entrenamiento…");
    await commentAgain.fill(original);
    await commentAgain.blur();
    await page.waitForTimeout(500);
  });

  test("abre y cierra el modal Compartir sin efectos secundarios [T2.x]", async ({ page }) => {
    await page.getByRole("button", { name: "Día anterior" }).click();
    await expect(page.getByRole("button", { name: "Compartir" })).toBeVisible({ timeout: 8_000 });
    await page.getByRole("button", { name: "Compartir" }).click();
    const dialog = page.getByRole("dialog", { name: "Compartir entrenamiento" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cerrar" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("abre y cierra el modal Copiar de… sin copiar nada [T2.x]", async ({ page }) => {
    await page.getByRole("button", { name: "Día anterior" }).click();
    await expect(page.getByRole("button", { name: "Copiar de…" })).toBeVisible({ timeout: 8_000 });
    await page.getByRole("button", { name: "Copiar de…" }).click();
    const dialog = page.getByRole("dialog", { name: "Copiar ejercicios de…" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cerrar" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("navega a un entrenamiento reciente desde la lista [T2.x]", async ({ page }) => {
    const recent = page.locator("a[href^='/workout/']").first();
    if (await recent.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await recent.click();
      await expect(page).toHaveURL(/\/workout\//);
      await expect(page.locator("h1, h2").first()).toBeVisible();
    }
  });
});
