# apps/web — Next.js 15

_Last updated: 2026-06-22_

## Config
- `next.config.ts` → `transpilePackages: ["@fitnotes/core", "@fitnotes/database", "@fitnotes/ui"]`
- Tailwind v4 via `@tailwindcss/postcss` (no `tailwind.config.js`)
- `middleware.ts` → guard server-side, redirige a `/login` si no hay sesión
- ESLint v9 flat config en `eslint.config.mjs`

## Estructura App Router

```
app/
├── page.tsx                → redirect /dashboard
├── (auth)/login/           email + password
├── (auth)/register/
└── (app)/
    ├── layout.tsx          AppLayout — Sidebar + MobileNav
    ├── dashboard/          workout del día, picker ejercicios, sets CRUD
    ├── exercise/           catálogo — "+ Nuevo ejercicio" directo, categoría inline con color
    ├── exercise/[id]/      detalle + historial sets
    ├── progress/           PRs + Recharts LineChart
    ├── calendar/           mes + lista + popup día
    ├── routines/           lista rutinas
    ├── routines/[id]/      editor: días, ejercicios, sets predefinidos
    ├── body-tracker/       medidas, log inline, historial
    ├── tools/              1RM / Set% / Plate calculators
    └── settings/           perfil, unidad, export CSV, sign-out, delete account
```

## Notas
- Sidebar logo → `<Link href="/dashboard">`, active state via `usePathname`
- `shadcn/ui` NO inicializado — incompatible con ESLint v9 flat config
- Todo en español
