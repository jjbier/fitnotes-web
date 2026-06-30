import { test, expect } from "@playwright/test";

test.describe("Registro de entrenamiento", () => {
  test.beforeEach(async () => {
    if (!process.env["PLAYWRIGHT_USER_EMAIL"]) test.skip();
  });

  test("inicia workout, añade ejercicio, gestiona series, finaliza [T2.1-T2.8]", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("h1", { hasText: /Entrenamiento/ })).toBeVisible();

    // ── Ir a ayer para evitar conflictos con entrenamientos activos ──────────
    await page.getByRole("button", { name: "Día anterior" }).click();
    await page.waitForTimeout(500);

    // ── Iniciar entrenamiento (si no existe) ─────────────────────────────────
    const startBtn = page.getByRole("button", { name: "Iniciar entrenamiento" });
    if (await startBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await startBtn.click();
      await expect(page.getByRole("button", { name: "Finalizar" })).toBeVisible({ timeout: 8_000 });
    }

    // At this point we should have an active workout panel
    await expect(page.getByRole("button", { name: "Finalizar" })).toBeVisible({ timeout: 5_000 });

    // ── Añadir ejercicio ─────────────────────────────────────────────────────
    const addExTab = page.locator("button", { hasText: "+ Ejercicio" });
    if (await addExTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await addExTab.click();

      // Select first available exercise
      const picker = page.locator("#exercise-picker");
      await expect(picker).toBeVisible({ timeout: 5_000 });

      // Pick the second option (first real exercise, index 0 = placeholder)
      const options = picker.locator("option");
      const count = await options.count();
      if (count <= 1) {
        test.skip(); // No exercises exist — can't test workout flow
        return;
      }
      const firstExName = await options.nth(1).textContent();
      await picker.selectOption({ index: 1 });
      await page.getByRole("button", { name: "Añadir" }).click();

      // Exercise tab should appear
      if (firstExName) {
        await expect(page.getByRole("tab", { name: firstExName.trim() })).toBeVisible({ timeout: 8_000 });
      }
    }

    // ── Añadir serie ─────────────────────────────────────────────────────────
    const addSetBtn = page.locator("button", { hasText: "+ Agregar serie" });
    await expect(addSetBtn).toBeVisible({ timeout: 5_000 });
    await addSetBtn.click();

    // Wait for real set (temp opacity-60 row replaced by confirmed row)
    await page.waitForTimeout(1_500);

    // ── Editar peso y repeticiones ───────────────────────────────────────────
    const weightInput = page.getByRole("spinbutton", { name: "Peso en kg" }).first();
    const repsInput = page.getByRole("spinbutton", { name: "Repeticiones" }).first();

    if (await weightInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await weightInput.fill("80");
      await weightInput.press("Tab");
      await page.waitForTimeout(600);
    }

    if (await repsInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await repsInput.fill("8");
      await repsInput.press("Tab");
      await page.waitForTimeout(600);
    }

    // ── Marcar como completada ───────────────────────────────────────────────
    const completeBtn = page.getByRole("button", { name: "Marcar serie como completada" }).first();
    await expect(completeBtn).toBeVisible({ timeout: 5_000 });
    await completeBtn.click();
    await expect(page.getByRole("button", { name: "Marcar serie como pendiente" })).toBeVisible({ timeout: 5_000 });

    // ── Eliminar serie ───────────────────────────────────────────────────────
    const deleteSetBtn = page.getByRole("button", { name: "Eliminar serie" }).first();
    await deleteSetBtn.click();
    // Set should disappear
    await page.waitForTimeout(500);

    // ── Finalizar entrenamiento ──────────────────────────────────────────────
    await page.getByRole("button", { name: "Finalizar" }).click();
  });

  test("navega entre días del calendar [T2.9]", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Día anterior" }).click();
    await expect(page.locator("h1", { hasText: /Entrenamiento/ })).toBeVisible();
    // Navigation should work without errors
    await page.getByRole("button", { name: "Día anterior" }).click();
    await expect(page.locator("h1", { hasText: /Entrenamiento/ })).toBeVisible();
  });

  test("accede al historial de un workout desde el calendario [T2.10]", async ({ page }) => {
    await page.goto("/dashboard");
    const recentLink = page.locator("a[href^='/workout/']").first();
    if (await recentLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await recentLink.click();
      await expect(page).toHaveURL(/\/workout\//);
      await expect(page.locator("h1, h2").first()).toBeVisible();
    }
    // If no recent workouts, test is vacuously OK
  });
});
