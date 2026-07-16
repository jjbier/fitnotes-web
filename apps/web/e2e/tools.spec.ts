import { test, expect } from "@playwright/test";
import { mockFixedToday } from "./helpers/mockDate";

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

  test("no añade una serie al entrenamiento de hoy si ya está finalizado [regresión]", async ({ page }) => {
    // `addSetToTodayWorkout` opera siempre sobre la fecha real de "hoy", que
    // es una fecha compartida con otros specs (p.ej. dashboard.spec.ts asume
    // que "hoy" empieza sin entrenamiento). Para no dejar "hoy" finalizado
    // como efecto secundario y romper esos tests, se fija `Date` a un día muy
    // futuro que ningún otro spec toca — así "hoy" para esta prueba es un día
    // aislado del resto de la cuenta compartida.
    await mockFixedToday(page, "2031-03-15T10:00:00.000Z");

    await page.goto("/dashboard");
    await expect(page.locator("h1", { hasText: /Entrenamiento/ })).toBeVisible();
    const startBtn = page.getByRole("button", { name: "Iniciar entrenamiento" });
    const finishBtn = page.getByRole("button", { name: "Finalizar" });
    // El día ya puede estar finalizado de antes (cuenta de test compartida) —
    // en ese caso ni "Iniciar" ni "Finalizar" están visibles.
    await page.waitForTimeout(1_000);
    if (await startBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await startBtn.click();
      await expect(finishBtn).toBeVisible({ timeout: 8_000 });
    }
    if (await finishBtn.isVisible().catch(() => false)) {
      await finishBtn.click();
      const closeSummary = page.getByRole("button", { name: "Cerrar", exact: true });
      if (await closeSummary.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await closeSummary.click();
      }
      // Esperar a que el PATCH de `end_time` se refleje en la UI antes de
      // navegar — si no, la siguiente petición puede llegar antes de que el
      // workout quede realmente marcado como finalizado en la base de datos.
      await expect(page.getByText("finalizado")).toBeVisible({ timeout: 8_000 });
    }

    // Desde la calculadora de series, intentar añadir un set al entrenamiento
    // de hoy — `addSetToTodayWorkout` no comprobaba `end_time` y creaba la
    // serie igualmente en un entrenamiento ya finalizado.
    await page.goto("/tools");
    await page.getByRole("tab", { name: "Calculadora de series" }).click();
    await page.getByLabel("Peso base (kg)").fill("100");

    // El selector "Añadir a entrenamiento de hoy" (no el de "Cargar desde
    // ejercicio…", que es para precargar un PR histórico como peso base).
    const exercisePicker = page
      .locator("label", { hasText: "Añadir a entrenamiento de hoy" })
      .locator("xpath=following-sibling::select[1]");
    await expect(exercisePicker).toBeVisible({ timeout: 5_000 });
    // La lista de ejercicios se carga on-focus (lazy), no de entrada.
    await exercisePicker.focus();
    const options = exercisePicker.locator("option");
    await expect(async () => {
      expect(await options.count()).toBeGreaterThan(1);
    }).toPass({ timeout: 5_000 });
    await exercisePicker.selectOption({ index: 1 });

    const addBtn = page.getByRole("button", { name: "+ Añadir" }).first();
    await expect(addBtn).toBeVisible({ timeout: 5_000 });

    // No basta con comprobar que el botón nunca muestra "Añadido ✓": ese
    // texto desaparece solo a los 1.5s (setTimeout), así que si se comprueba
    // demasiado tarde el test pasa siempre aunque el guard esté roto. La
    // señal fiable es que, con el workout de hoy finalizado, `addSetToTodayWorkout`
    // debe cortar ANTES de llegar a insertar la serie — o sea, no debe salir
    // ningún POST a /rest/v1/sets.
    let setInsertFired = false;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/rest/v1/sets")) setInsertFired = true;
    });
    await addBtn.click();
    await page.waitForTimeout(2_000);
    expect(setInsertFired).toBe(false);
  });
});
