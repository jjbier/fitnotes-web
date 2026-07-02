import { test, expect, type Page } from "@playwright/test";

// Cuenta de test compartida entre ejecuciones: no asumir que un día concreto
// ya tiene un workout persistido ("sembrado") — crearlo si falta para que el
// test sea idempotente sin importar cuántas veces se haya corrido antes.
async function ensureWorkout(page: Page) {
  const startBtn = page.getByRole("button", { name: "Iniciar entrenamiento" });
  if (await startBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await startBtn.click();
  }
}

// Cada click dispara un fetch async (setLoading bloquea el botón mientras
// tanto) — esperar a que vuelva a habilitarse evita que varios clicks
// seguidos disparen fetches solapados y dejen currentDate/activeWorkout
// desincronizados momentáneamente.
async function navigateDays(page: Page, buttonName: "Día anterior" | "Día siguiente", times: number) {
  const button = page.getByRole("button", { name: buttonName });
  // "Día anterior" nunca queda deshabilitado por rango de fechas (solo por
  // isLoading) — sirve de proxy fiable de "terminó de cargar" aunque
  // estemos pulsando "Día siguiente" (que sí puede quedar deshabilitado al
  // llegar a hoy, lo cual es un estado válido, no una carga en curso).
  const prevButton = page.getByRole("button", { name: "Día anterior" });
  for (let i = 0; i < times; i++) {
    await button.click();
    await expect(prevButton).toBeEnabled({ timeout: 8_000 });
  }
}

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

    // Esperar a que termine de cargar "hoy" antes de interactuar — si no, el
    // fetch inicial (async) puede resolver tarde y pisar el estado de un día
    // al que ya hemos navegado, dejando activeWorkout desincronizado.
    await expect(
      page.getByRole("button", { name: "Iniciar entrenamiento" }).or(page.getByRole("button", { name: "Finalizar" }))
    ).toBeVisible({ timeout: 10_000 });
  });

  test("carga hoy sin entrenamiento y el día siguiente está deshabilitado [T2.0]", async ({ page }) => {
    await expect(page.locator("h1", { hasText: "Entrenamiento de hoy" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Día siguiente" })).toBeDisabled();
  });

  test("navegar a un día sin entrenamiento no deja datos del día anterior [regression]", async ({ page }) => {
    // Día -1 (ayer) tiene (o crea) workout; día -2 se deja sin tocar.
    await page.getByRole("button", { name: "Día anterior" }).click();
    await ensureWorkout(page);
    await expect(page.getByRole("button", { name: "Finalizar" })).toBeVisible({ timeout: 8_000 });

    await page.getByRole("button", { name: "Día anterior" }).click();
    await expect(page.getByText("Sin entrenamiento aún")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole("button", { name: "Finalizar" })).not.toBeVisible();
  });

  test("edita y restaura la nota del entrenamiento [T2.x]", async ({ page }) => {
    // Usar el workout de hace 3 días (no lo toca ningún otro spec ni queda
    // finalizado, a diferencia del de "ayer" que workout.spec.ts finaliza).
    await navigateDays(page, "Día anterior", 3);
    await ensureWorkout(page);

    const comment = page.getByPlaceholder("Añadir nota al entrenamiento…");
    await expect(comment).toBeVisible({ timeout: 8_000 });
    const original = await comment.inputValue();

    await comment.fill("Nota temporal E2E");
    await comment.blur();
    await page.waitForTimeout(500);

    // El dashboard no persiste la fecha en la URL — en vez de recargar,
    // navegar fuera y volver fuerza un fetch fresco desde la DB y confirma
    // que el guardado fue real (no solo estado local optimista).
    await navigateDays(page, "Día siguiente", 3);
    await navigateDays(page, "Día anterior", 3);
    await expect(page.getByPlaceholder("Añadir nota al entrenamiento…")).toHaveValue("Nota temporal E2E", { timeout: 8_000 });

    // Dejar el dato como estaba
    const commentAgain = page.getByPlaceholder("Añadir nota al entrenamiento…");
    await commentAgain.fill(original);
    await commentAgain.blur();
    await page.waitForTimeout(500);
  });

  test("abre y cierra el modal Compartir sin efectos secundarios [T2.x]", async ({ page }) => {
    await page.getByRole("button", { name: "Día anterior" }).click();
    await ensureWorkout(page);
    await expect(page.getByRole("button", { name: "Compartir" })).toBeVisible({ timeout: 8_000 });
    await page.getByRole("button", { name: "Compartir" }).click();
    const dialog = page.getByRole("dialog", { name: "Compartir entrenamiento" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cerrar" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("abre y cierra el modal Copiar de… sin copiar nada [T2.x]", async ({ page }) => {
    await page.getByRole("button", { name: "Día anterior" }).click();
    await ensureWorkout(page);
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
