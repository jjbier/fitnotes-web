import { defineConfig, devices } from "@playwright/test";

const STORAGE_STATE = "e2e/.auth/user.json";

export default defineConfig({
  testDir: "./e2e",
  // Todos los tests autenticados comparten UNA sola cuenta Supabase persistente
  // (sin aislamiento de datos por test) — correr en paralelo hace que tests
  // que tocan el mismo registro (p.ej. el workout de "ayer") se pisen entre sí.
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  // 1 reintento local: `next dev` recompila rutas on-demand tras inactividad,
  // lo que ocasionalmente hace que el primer login tarde más de lo esperado.
  retries: process.env["CI"] ? 2 : 1,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    // Step 1: log in once, save session to disk
    { name: "setup", testMatch: /auth\.setup\.ts/ },

    // Step 2a: unauthenticated + mixed legacy tests (no stored auth)
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [/auth\.setup\.ts/, /(exercises|workout|routines|progress|body-tracker)\.spec\.ts/],
    },

    // Step 2b: CRUD tests that reuse stored auth state
    {
      name: "chromium-auth",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
      testMatch: /(exercises|workout|routines|progress|body-tracker)\.spec\.ts/,
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});
