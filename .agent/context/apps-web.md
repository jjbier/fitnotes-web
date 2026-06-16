# apps/web — Next.js 15

## Config
- `next.config.ts` → `transpilePackages: ["@fitnotes/core", "@fitnotes/database", "@fitnotes/ui"]`
- Tailwind v4 via `@tailwindcss/postcss` (no `tailwind.config.js` — config en CSS)
- CSS vars en `app/globals.css` con tokens de shadcn/ui
- `lib/utils.ts` → `cn()` con clsx + tailwind-merge

## Estructura App Router

```
app/
├── layout.tsx              RootLayout — TODO: SessionContextProvider
├── page.tsx                redirect → /dashboard
├── (auth)/
│   ├── login/page.tsx      form email+password + magic link
│   └── register/page.tsx   form registro
└── (app)/
    ├── layout.tsx          AppLayout — Sidebar + MobileNav
    ├── dashboard/          today's workout
    ├── workout/[date]/     workout por fecha ISO
    ├── exercise/           catálogo
    ├── exercise/[id]/      detalle + stats
    ├── progress/           PRs + gráficas
    ├── calendar/           mes + lista
    ├── routines/           lista rutinas
    ├── routines/[id]/      editor rutina
    ├── body-tracker/       medidas corporales
    └── settings/           ajustes + danger zone
```

## Componentes

### `components/workout/`
| Componente | Estado |
|---|---|
| `TrainingScreen.tsx` | Stub funcional — muestra sets, botón Add Set y Finish |
| `SetList.tsx` | Stub funcional — renderiza sets con complete toggle y delete |
| `SetForm.tsx` | **Lógica real** — inputs dinámicos según `ExerciseType`, `"use client"` |
| `NavigationPanel.tsx` | Stub funcional — lista ejercicios del workout, active highlight |

### `components/progress/`
| Componente | Estado |
|---|---|
| `ProgressChart.tsx` | Stub — estructura Recharts comentada, necesita implementación |
| `PersonalRecords.tsx` | Funcional — tabla con `calculate1RM` real |

### `components/layout/`
| Componente | Estado |
|---|---|
| `Sidebar.tsx` | Funcional pero sin `usePathname` — active state no funciona |
| `MobileNav.tsx` | Funcional pero sin `usePathname` — active state no funciona |

## Pendiente crítico

1. Auth middleware server-side (`middleware.ts` en raíz del app)
2. Supabase queries en cada page (actualmente datos placeholder)
3. `shadcn/ui` no inicializado — no existe `components.json`; los componentes usan clases Tailwind directamente
4. `Sidebar` y `MobileNav` necesitan `"use client"` + `usePathname()`
5. `ProgressChart` necesita implementación Recharts
