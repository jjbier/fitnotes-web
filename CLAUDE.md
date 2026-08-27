# FitNotes Web — CLAUDE.md

## Objetivo
App de fitness tracking (workout logging, PRs, rutinas, body tracker, calculadoras). Next.js 15 App Router, siempre requiere cuenta. Mayormente en **español** — desde 2026-07-16 hay infraestructura i18n (`react-i18next` + `i18next`) con diccionarios `es`/`en` compartidos en `packages/core/src/i18n/locales/`, pero **solo la pantalla de Settings está migrada** (piloto); el resto de la app sigue con strings hardcodeados en español, migración pendiente pantalla a pantalla. Paridad completa con la app de referencia FitNotes (Fases 0–5, `docs/implementation-plan-2026-07.md`), incluida paridad **visual** (2026-07-02).

## Arquitectura
```
apps/web            Next.js 15 App Router
packages/core       lógica pura — CERO imports react/next
packages/database   cliente Supabase + repositorios remotos + SyncEngine
packages/ui         vacío, sin spec
```
`packages/core` y `packages/database` viven en este mismo repo (duplicados desde el monorepo original que también contenía la app mobile, ahora separada en su propio repositorio) — aquí son la fuente de verdad local para esta app, sin dependencia de ningún otro repo.

Detalle en `.agent/context/`: `architecture.md`, `apps-web.md`, `packages-core.md`, `packages-database.md`, `repositories.md`, `stores.md`, `status.md`, `todo.md`.

## Stack y dependencias clave
- Turborepo 2 + pnpm workspaces; TS strict + `verbatimModuleSyntax`
- Supabase (ref `fbhjiwtriqrxibqwsyqj`); `@supabase/supabase-js@2.108.2` + `@supabase/ssr@0.12.0` **fijas** (mezclar versiones rompe genéricos)
- Zustand 5 + Immer (stores en core)
- Tailwind v4 (requiere `@theme inline` en `globals.css` — ver bug abajo), `lucide-react` para iconos, `ConfirmDialog` propio (no `confirm()` nativo), shadcn/ui NO inicializado
- Tests: Vitest (core 219 tests, database 87 tests), Playwright (E2E, 13 specs/66 tests)

## Decisiones arquitectónicas clave
- Repository pattern `createXxxRepository(client)` (remoto). Detalle en `packages-database.md`
- UUIDs reales generados en cliente (`generateUUID()` en core) — nunca IDs temporales
- `ExerciseType` cast obligatorio al mapear Supabase → core
- 1RM Brzycki; PR auto-actualizado vía trigger SQL; RLS `auth.uid()=user_id` en todas las tablas
- Supersets: `group_id`/`group_name` compartidos en `routine_day_exercises` y `workout_exercises`
- Home Screen Settings (categorías ocultas): client-side (localStorage), sin campo en DB
- **i18n (2026-07-16/17)**: `react-i18next` + `i18next`. Diccionarios `es`/`en` en `packages/core/src/i18n/locales/` (namespaces `common`/`settings`/`exercises`/`exerciseCatalog`/`progress`), con test de paridad de claves (`i18n.test.ts`) para que ambos idiomas no diverjan. El catálogo de ejercicios por defecto (`resolveDefaultExerciseCatalog`) también se traduce: los 96 ejercicios/8 categorías se crean en el idioma activo. **Migradas: Settings, Ejercicios y Progreso** (récords/gráfica/historial/estadísticas/objetivos); el resto de la app (workout, calendario, rutinas, body tracker, etc.) sigue con strings hardcodeados en español — migrar pantalla a pantalla añadiendo su namespace a `locales/es.ts`/`en.ts` en ambos idiomas a la vez (el test de paridad falla si no). El mapa `EXERCISE_TYPE_LABELS` de `packages/core/src/utils/calculations.ts` (usado en más pantallas aún no migradas, p.ej. workout) sigue sin traducir a propósito, igual que el locale `"es-ES"` hardcodeado en varios `toLocaleDateString` (formato de fecha, migración aparte).
- Lista completa de decisiones: `.agent/context/architecture.md`

## Estado actual — qué funciona
Fases 0–5 de paridad con la app de referencia completas, sin gaps funcionales.
- `packages/core` ✅ 219 tests Vitest
- `packages/database` ✅ 8 repositorios remotos + `SyncEngine` v2 — 87 tests Vitest
- `apps/web` ✅ todas las rutas, nav de 6 secciones, `/search` global, dashboard con franja semanal+racha+drag&drop+multi-select+resumen final, accesibilidad WCAG AA, CSP, CI/CD. Requiere cuenta siempre
- Fechas en español, colores/tema renderizando correctamente

## Bugs conocidos / no repetir
- **Tailwind v4 sin `@theme`**: `bg-primary`, `text-muted-foreground`, `bg-secondary`, etc. llevaban TODA la historia del proyecto sin generar ninguna regla CSS real — Tailwind v4 no reconoce colores custom sin `@theme`. Arreglado en `apps/web/app/globals.css`. Los tests de Playwright no lo detectaban (comprueban DOM/roles, no colores) → **verificar visualmente con screenshot tras cambios de estilo**, no confiar solo en tests de rol/texto.
- **`formatWorkoutDate` en inglés**: arrays de día/mes hardcodeados en inglés en `packages/core/src/utils/dateUtils.ts` pese a que toda la app es en español — traducido y reordenado a convención española ("día de mes de año").
- **`confirm()` nativo → `ConfirmDialog`**: specs que esperaban `page.once("dialog", ...)` deben clicar el botón real del `role="alertdialog"` ahora.

## Pendiente inmediato
- `packages/ui` vacío, sin spec
- Cuenta de test Supabase (`e2e-tests@fitnotes.local`) compartida y frágil — algunos specs asumen que existen/no existen workouts en fechas relativas ("ayer", "hace 3 días"); si un spec falla por datos, revisar el estado de la cuenta antes de asumir bug de código
- Sin gaps funcionales conocidos vs. la app de referencia (paridad Fases 0–5)

## Comandos
```bash
pnpm --filter @fitnotes/web dev
pnpm --filter @fitnotes/core test
pnpm --filter @fitnotes/database test
cd apps/web && PLAYWRIGHT_USER_EMAIL=x PLAYWRIGHT_USER_PASSWORD=y npx playwright test
```
