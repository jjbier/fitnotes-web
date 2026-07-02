# apps/web — Next.js 15

_Last updated: 2026-07-02_

## Config
- `next.config.ts` → `transpilePackages`, **security headers** (CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy), `async headers()`
- Tailwind v4 via `@tailwindcss/postcss` (no `tailwind.config.js`) — **requiere `@theme inline` en `globals.css`** mapeando `--color-primary: hsl(var(--primary))` etc. Sin esto Tailwind v4 no genera NINGUNA regla para `bg-primary`/`text-muted-foreground`/`bg-secondary`/`border-destructive`/etc. (bug presente desde el scaffold inicial hasta 2026-07-02, ver CLAUDE.md)
- `middleware.ts` → guard server-side, redirige a `/login` si no hay sesión
- ESLint v9 flat config en `eslint.config.mjs`
- `vercel.json` → duplica CSP headers para Vercel edge
- `public/robots.txt` → bloquea todas las rutas autenticadas
- `.github/dependabot.yml` → weekly npm + GitHub Actions (grupos: typescript-eslint, expo, supabase, tanstack, react)

## Estructura App Router

```
app/
├── page.tsx                → redirect /dashboard
├── layout.tsx              html lang="es", metadata template "%s | FitNotes"
├── (auth)/login/
├── (auth)/register/
└── (app)/
    ├── layout.tsx          AppLayout — skip link + <main id="main-content"> + Sidebar + MobileNav
    ├── dashboard/          "Hoy" — franja semanal+racha (WeekStrip), lista de ejercicios con progress bar+drag&drop (NavigationPanel), multi-select+borrado masivo, WorkoutTimer (pausa/reanudar), resumen al finalizar (FinishSummaryModal: duración/ejercicios/series/volumen), WakeLock
    ├── exercise/           virtualización useWindowVirtualizer, CRUD, drag-to-reorder categorías, icon-circle avatars, EmptyState
    ├── exercise/[id]/      virtualización, ExerciseCard dropdown fijo via getBoundingClientRect
    ├── exercise/history/[exerciseId]/  historial virtualizado, "Ver workout →" link, copy sets
    ├── search/             búsqueda global de ejercicios (paridad con mobile `search/index.tsx`) — accesible desde icono historial en /exercise
    ├── workout/[date]/     mismo patrón que dashboard (NavigationPanel sidebar desktop + lista mobile, drag-to-reorder, multi-select, finish summary), TrainingScreen optimistic
    ├── progress/           PRs, Recharts LineChart (métricas ampliadas), tab Estadísticas (PeriodStats), ExerciseOverview (focus trap + Escape), goals
    ├── calendar/           grid + lista, dots por categoría (toggle vs. círculo), toggle panel día, filtros avanzados, list view con detalle expandible
    ├── routines/           lista CRUD
    ├── routines/[id]/      editor drag&drop, predefined sets (focus trap), supersets
    ├── body-tracker/       log inline, historial agrupado, gráfica (click en punto → medidas relacionadas), drag&drop orden
    ├── body-tracker/settings/  edición medidas, goal_value, drag&drop, reset
    ├── tools/              1RM + Set% (Add-to-Workout + PRSelector) + Plate configurable + RestTimer SVG
    └── settings/           perfil, toggles, recalcular PRs, backup/restore, CSV, Drive (rotación 5), eliminar historial (filtros), Home Screen Settings, delete
```

**Per-route layout.tsx** en todas las rutas de `(app)/` — exportan `metadata: Metadata` estático para que las páginas `"use client"` tengan title en el browser.

## Navegación (paridad con mobile, 2026-07)
- `Sidebar.tsx` (desktop) / `MobileNav.tsx` (móvil web): **6 secciones**, idénticas a las tabs de mobile — Hoy/Calendario/Ejercicios/Progreso/Rutinas/Configuración
- `/body-tracker` y `/tools` NO son ítems de nav de primer nivel — se acceden desde secciones "Salud"/"Herramientas" dentro de `/settings`

## Componentes de diseño compartido (2026-07-02, paridad visual con mobile)
- `components/EmptyState.tsx` — icono (lucide) + título + descripción + CTA + acción secundaria opcional; usado en dashboard/routines/exercises/history sin datos
- `components/ConfirmDialog.tsx` — `ConfirmProvider` + hook `useConfirm()`, sustituye `window.confirm()` nativo por un modal `role="alertdialog"` propio (botones Cancelar/confirmar personalizables). Montado en `app/(app)/layout.tsx`. **Tests E2E que antes usaban `page.once("dialog", ...)` deben clicar el botón real del alertdialog ahora**
- `components/workout/WeekStrip.tsx` — franja L-D con puntos de entrenamiento + racha (flame badge), usado solo en dashboard (paridad con "Hoy" de mobile)
- `components/workout/FinishSummaryModal.tsx` — modal de 4 stat tiles (duración/ejercicios/series/volumen) al finalizar un entrenamiento
- `components/workout/NavigationPanel.tsx` — lista de ejercicios del workout con progress bar, drag&drop (HTML5 draggable), botón eliminar (hover), modo multi-select con checkboxes; usado en dashboard (full-width) y workout/[date] (sidebar desktop + lista mobile)
- Iconos: migrados de glifos unicode sueltos (★, ›, ⠿, ←, →, ✓, ✕, ⋯) a `lucide-react` en toda la app — no reintroducir literales unicode como iconos
- Radios de borde aumentados (`rounded-md→rounded-xl`, `rounded-lg→rounded-2xl`) para matchear el estilo más redondeado de mobile

## Rendimiento
- `useWindowVirtualizer` (scroll en window, NO overflow container):
  ```ts
  scrollMargin: listRef.current?.offsetTop ?? 0
  transform: translateY(${virtualItem.start - offsetTop}px)
  ```
- Dropdown en virtualized rows → `position: fixed` via `getBoundingClientRect()` + scroll listener para cerrar

## Accesibilidad (WCAG AA)
- `lib/useFocusTrap.ts` → intercept Tab, move focus al primer elemento al abrir, restaurar al cerrar
- Skip link: `<a href="#main-content" className="sr-only focus:not-sr-only ...">Saltar al contenido</a>`
- Modales: `role="dialog"` `aria-modal="true"` `aria-labelledby` + useFocusTrap + Escape
- Tabs: `role="tablist"` `role="tab"` `aria-selected`
- Nav: `aria-current="page"` en link activo, `aria-label="Navegación principal"` en `<nav>`

## E2E Playwright (`e2e/`)
- `playwright.config.ts` → 3 proyectos: `setup` (auth.setup.ts), `chromium` (legacy sin auth), `chromium-auth` (nuevos CRUD con storageState)
- `auth.setup.ts` → login + guarda `e2e/.auth/user.json`; sin credenciales crea estado vacío
- Tests se saltan si no hay `PLAYWRIGHT_USER_EMAIL` + `PLAYWRIGHT_USER_PASSWORD`
- `exercises.spec.ts`, `workout.spec.ts`, `routines.spec.ts`, `progress.spec.ts`, `body-tracker.spec.ts`

```bash
PLAYWRIGHT_USER_EMAIL=x PLAYWRIGHT_USER_PASSWORD=y npx playwright test --project=chromium-auth
```

## lib/settings.ts — SETTING_KEYS (localStorage)
```
TRACK_PRS, AUTO_COMPLETE, AUTO_NEXT_SET, KEEP_SCREEN_ON, WEEK_START, WEIGHT_UNIT,
AUTO_BACKUP_DRIVE, DEFAULT_WEIGHT_INCREMENT, ESTIMATED_RECORDS_REP_LIMIT,
CALENDAR_SHOW_DAY_PANEL, CALENDAR_SHOW_CATEGORY_DOTS, SHOW_SET_COUNT_HOME,
HIDDEN_CATEGORIES (JSON array de category IDs)
```
Helpers: `readBool`/`writeBool`, `readWeekStart`, `readDefaultWeightIncrement`, `readEstimatedRecordsRepLimit`, `readHiddenCategories`/`writeHiddenCategories`.

## WorkoutTimer.tsx — pausa/reanudar
- Auto-arranca al montar (`running: true` por defecto, igual que antes) pero ahora expone botón play/pause (`lucide-react`)
- Acumula segundos en `elapsedBaseRef` al pausar; re-inicializa desde `startTime` si cambia el workout activo

## Google Drive backup — rotación
- `api/google/backup/route.ts`: tras subir, `rotateOldBackups(accessToken)` lista archivos `fitnotes-backup-*` (Drive API `files.list`, orderBy `createdTime desc`) y borra todos menos los 5 más recientes

## Notas
- `shadcn/ui` NO inicializado — incompatible con ESLint v9 flat config
- Todo en español
- Sidebar: active state via `usePathname`, `aria-current="page"`
