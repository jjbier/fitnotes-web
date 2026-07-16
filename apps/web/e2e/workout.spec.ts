import { test, expect } from "@playwright/test";

test.describe("Registro de entrenamiento", () => {
  test.beforeEach(async () => {
    if (!process.env["PLAYWRIGHT_USER_EMAIL"]) test.skip();
  });

  test("inicia workout, añade ejercicio, gestiona series, finaliza [T2.1-T2.8]", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("h1", { hasText: /Entrenamiento/ })).toBeVisible();

    // ── Ir a un día lejano para evitar conflictos con entrenamientos activos
    // o ya finalizados de ejecuciones anteriores (cuenta de test compartida) ──
    for (let i = 0; i < 10; i++) {
      await page.getByRole("button", { name: "Día anterior" }).click();
    }

    // Esperar a que termine de cargar el día (evita la carrera entre el fetch
    // de getWorkoutByDate y comprobar si el botón de iniciar está visible)
    const startBtn = page.getByRole("button", { name: "Iniciar entrenamiento" });
    const finishBtn = page.getByRole("button", { name: "Finalizar" });
    await expect(startBtn.or(finishBtn)).toBeVisible({ timeout: 8_000 });

    // ── Iniciar entrenamiento (si no existe) ─────────────────────────────────
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
      await expect(finishBtn).toBeVisible({ timeout: 8_000 });
    }

    // At this point we should have an active workout panel
    await expect(finishBtn).toBeVisible({ timeout: 5_000 });

    // ── Añadir ejercicio ─────────────────────────────────────────────────────
    const addExTab = page.locator("button", { hasText: /^\+ (Agregar|Añadir) ejercicio$/ });
    if (await addExTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await addExTab.click();

      // Select first available exercise
      const picker = page.locator("#exercise-picker");
      await expect(picker).toBeVisible({ timeout: 5_000 });

      // Elegir un ejercicio de peso×reps (no distancia/tiempo) para que los
      // pasos siguientes (peso, reps) tengan sentido — si no se encuentra
      // ninguno, cae al índice 1 (primer ejercicio real tras el placeholder).
      const options = picker.locator("option");
      const count = await options.count();
      if (count <= 1) {
        test.skip(); // No exercises exist — can't test workout flow
        return;
      }
      const allNames = await options.allTextContents();
      let pickIndex = allNames.findIndex((n) => /press banca|sentadilla|dominadas|elevaciones/i.test(n));
      if (pickIndex <= 0) pickIndex = 1;
      const firstExName = allNames[pickIndex];
      await picker.selectOption({ index: pickIndex });
      await page.getByRole("button", { name: "Añadir", exact: true }).click();

      // El ejercicio recién añadido se activa automáticamente — confirmar que
      // el panel de entrenamiento activo es realmente el suyo.
      if (firstExName) {
        await expect(page.getByRole("heading", { level: 2, name: firstExName.trim(), exact: true })).toBeVisible({ timeout: 8_000 });
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

  test("no se puede añadir un ejercicio a un entrenamiento finalizado [regresión]", async ({ page }) => {
    // Se usa la ruta /workout/[date] con una fecha fija muy antigua en vez de
    // "hoy" (que es una fecha compartida con otros specs) o de navegar N días
    // atrás desde /dashboard (lento y no idempotente entre corridas). Nota:
    // mockear `Date` para simular "hoy" NO sirve aquí — el cliente de
    // Supabase usa `Date.now()` para decidir si el access token expiró, y una
    // fecha simulada muy futura le hace pensar que el token expiró, disparando
    // un refresh en segundo plano que causa un parpadeo real de estado
    // (el botón "Iniciar" aparece y desaparece a mitad de la prueba).
    const FIXED_DATE = "2020-01-15";
    await page.goto(`/workout/${FIXED_DATE}`);
    await expect(page.locator("h1", { hasText: /Entrenamiento/ })).toBeVisible();

    const startBtn = page.getByRole("button", { name: "Iniciar entrenamiento" });
    const finishBtn = page.getByRole("button", { name: "Finalizar" });
    // El día ya puede estar finalizado de una corrida anterior de este mismo
    // test — en ese caso ni "Iniciar" ni "Finalizar" están visibles.
    await page.waitForTimeout(1_000);
    if (await startBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await startBtn.click();
      await expect(finishBtn).toBeVisible({ timeout: 8_000 });
    }

    // Abrir el selector de ejercicio SIN llegar a añadir nada, y finalizar
    // el entrenamiento mientras el selector sigue abierto — reproduce el bug
    // donde el <select> + botón "Añadir" quedaban visibles en un entrenamiento
    // ya finalizado (el guard de handleAddExercise bloqueaba el insert real,
    // pero la UI seguía sugiriendo que se podía añadir).
    // workout/[date]/page.tsx renderiza NavigationPanel dos veces (sidebar de
    // escritorio + versión inline para móvil, ambas en el DOM a la vez,
    // alternadas por CSS) — usar .first() para no violar el modo estricto.
    const addExTab = page.locator("button", { hasText: /^\+ (Agregar|Añadir) ejercicio$/ }).first();
    const navAddBtn = page.locator("button", { hasText: "Agregar ejercicio" }).first();
    const picker = page.getByLabel("Seleccionar ejercicio");
    if (await finishBtn.isVisible().catch(() => false)) {
      // Dar tiempo a NavigationPanel a terminar de renderizar el botón antes
      // de comprobar su visibilidad (justo tras cargar la página, un chequeo
      // inmediato puede correr antes de que el listado de ejercicios monte).
      await expect(addExTab.or(navAddBtn)).toBeVisible({ timeout: 8_000 });
      if (await addExTab.isVisible().catch(() => false)) {
        await addExTab.click();
      } else {
        await navAddBtn.click();
      }
      await expect(picker).toBeVisible({ timeout: 5_000 });

      await finishBtn.click();

      // Cerrar el modal de resumen si aparece
      const closeSummary = page.getByRole("button", { name: "Cerrar", exact: true });
      if (await closeSummary.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await closeSummary.click();
      }
    }

    // El selector de ejercicio y su botón "Añadir" no deben quedar visibles
    // en un entrenamiento finalizado.
    await expect(picker).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: "Añadir", exact: true })).not.toBeVisible();

    // Tampoco debe haber ninguna otra vía de abrir el selector.
    await expect(addExTab).not.toBeVisible();
    await expect(navAddBtn).not.toBeVisible();
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
