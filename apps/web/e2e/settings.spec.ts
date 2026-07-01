import { test, expect } from "@playwright/test";

// IMPORTANTE: esta página tiene acciones destructivas (eliminar historial,
// eliminar cuenta, restaurar backup que sobrescribe todo). Estos tests NUNCA
// confirman ninguna de ellas — solo verifican que los paneles se abren y se
// pueden cancelar. Tampoco se toca Google Drive (requiere OAuth real).

function switchFor(page: import("@playwright/test").Page, label: string) {
  return page.getByText(label, { exact: true })
    .locator("xpath=../following-sibling::button[@role='switch']");
}

test.describe("Configuración", () => {
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
    await page.goto("/settings");
    await expect(page.locator("h1", { hasText: "Configuración" })).toBeVisible();
  });

  test("secciones principales visibles [T7.x]", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Perfil" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Preferencias" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Comportamiento del entrenamiento" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pantalla de inicio" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Datos" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Zona de peligro" })).toBeVisible();
  });

  test("activa y restaura el toggle de récords personales [T7.x]", async ({ page }) => {
    const toggle = switchFor(page, "Registrar récords personales");
    await expect(toggle).toBeVisible();
    const before = await toggle.getAttribute("aria-checked");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", before === "true" ? "false" : "true");
    await toggle.click(); // restaurar
    await expect(toggle).toHaveAttribute("aria-checked", before ?? "true");
  });

  test("recalcula PRs [T7.1]", async ({ page }) => {
    const btn = page.getByRole("button", { name: /Recalcular PRs/ });
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.getByRole("button", { name: /Calculando…|¡Listo!/ })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole("button", { name: "¡Listo!" })).toBeVisible({ timeout: 15_000 });
  });

  test("home screen: alterna contador de series y una categoría [T7.x]", async ({ page }) => {
    const setCountToggle = switchFor(page, "Mostrar contador de series");
    await expect(setCountToggle).toBeVisible();
    const before = await setCountToggle.getAttribute("aria-checked");
    await setCountToggle.click();
    await expect(setCountToggle).toHaveAttribute("aria-checked", before === "true" ? "false" : "true");
    await setCountToggle.click(); // restaurar
    await expect(setCountToggle).toHaveAttribute("aria-checked", before ?? "true");

    const chip = page.getByText("Categorías visibles", { exact: true })
      .locator("xpath=../div[contains(@class,'flex-wrap')]//button[@aria-pressed]")
      .first();
    if (await chip.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const pressedBefore = await chip.getAttribute("aria-pressed");
      await chip.click();
      await expect(chip).toHaveAttribute("aria-pressed", pressedBefore === "true" ? "false" : "true");
      await chip.click(); // restaurar
      await expect(chip).toHaveAttribute("aria-pressed", pressedBefore ?? "true");
    }
  });

  test("abre exportar .fitnotes sin errores [T7.x]", async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 10_000 }).catch(() => null),
      page.getByRole("button", { name: "Exportar .fitnotes" }).click(),
    ]);
    expect(download).not.toBeNull();
  });

  test("eliminar historial: abre y cancela el panel sin confirmar nada [T7.x, destructivo evitado]", async ({ page }) => {
    await page.getByRole("button", { name: "Eliminar historial", exact: true }).click();
    await expect(page.locator("#del-hist-from")).toBeVisible();
    await expect(page.locator("#del-hist-to")).toBeVisible();
    await expect(page.locator("#del-hist-ex")).toBeVisible();
    // Cancelar explícitamente — NUNCA clicar "Confirmar".
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.locator("#del-hist-from")).not.toBeVisible();
  });
});
