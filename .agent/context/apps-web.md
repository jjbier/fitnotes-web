# apps/web — Next.js 15

_Last updated: 2026-06-30_

## Config
- `next.config.ts` → `transpilePackages`, **security headers** (CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy), `async headers()`
- Tailwind v4 via `@tailwindcss/postcss` (no `tailwind.config.js`)
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
    ├── dashboard/          workout del día, optimistic sets CRUD, WorkoutTimer, WakeLock
    ├── exercise/           virtualización useWindowVirtualizer, CRUD, drag-to-reorder categorías
    ├── exercise/[id]/      virtualización, ExerciseCard dropdown fijo via getBoundingClientRect
    ├── exercise/history/[exerciseId]/  historial virtualizado, "Ver workout →" link, copy sets
    ├── workout/[date]/     NavigationPanel sidebar, drag-to-reorder, TrainingScreen optimistic
    ├── progress/           PRs, Recharts LineChart, ExerciseOverview (focus trap + Escape), goals
    ├── calendar/           grid + lista, dots por categoría, filtros avanzados
    ├── routines/           lista CRUD
    ├── routines/[id]/      editor drag&drop, predefined sets (focus trap), supersets
    ├── body-tracker/       log inline, historial, gráfica
    ├── tools/              calculators + PRSelector + RestTimer SVG
    └── settings/           perfil, toggles, recalcular PRs, backup, CSV, Drive, delete
```

**Per-route layout.tsx** en todas las rutas de `(app)/` — exportan `metadata: Metadata` estático para que las páginas `"use client"` tengan title en el browser.

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

## Notas
- `shadcn/ui` NO inicializado — incompatible con ESLint v9 flat config
- Todo en español
- Sidebar: active state via `usePathname`, `aria-current="page"`
