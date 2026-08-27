# FitNotes Web

[![CI](https://github.com/jjbier/fitnotes-web/actions/workflows/ci.yml/badge.svg)](https://github.com/jjbier/fitnotes-web/actions/workflows/ci.yml)

App de seguimiento de fitness con registro de entrenamientos, PRs, rutinas, body tracker y calculadoras. Next.js 15 App Router. Todo el producto está en español. Siempre requiere cuenta.

## Índice

- [Stack](#stack)
- [Estructura](#estructura)
- [Setup local](#setup-local)
- [Desarrollo](#desarrollo)
- [Testing](#testing)
- [Build / Compilación](#build--compilación)
- [Despliegue](#despliegue)
- [CI/CD — GitHub Actions](#cicd--github-actions)
- [Google Drive backup (opcional)](#google-drive-backup-opcional)
- [Funcionalidades](#funcionalidades)
- [Packages](#packages)
- [Problemas conocidos](#problemas-conocidos)
- [Contribuir](#contribuir)

## Stack

| Capa | Tecnología |
|------|------------|
| Monorepo (local) | Turborepo 2 + pnpm workspaces |
| Lenguaje | TypeScript strict (`verbatimModuleSyntax`) |
| Web | Next.js 15 App Router, React 19, Tailwind CSS v4, Recharts, Radix UI |
| Estado | Zustand 5 + Immer |
| Backend | Supabase (Auth + Postgres + RLS + funciones RPC) |
| Validación | Zod 3 |
| Testing | Vitest (core + database), Playwright (E2E) |
| CI/CD | GitHub Actions + Dependabot, Vercel |

## Estructura

```
fitnotes-web/
├── apps/
│   └── web/             # Next.js 15 App Router (puerto 3000) — siempre requiere cuenta
├── packages/
│   ├── core/             # Lógica de negocio pura — CERO imports de react/next
│   ├── database/         # Cliente Supabase + repositorios remotos + SyncEngine
│   ├── ui/                # Vacío, sin implementar (reservado)
│   └── tsconfig/         # Presets TypeScript base/nextjs
└── .agent/context/        # Notas de arquitectura profundas para agentes/IA (decisiones, gotchas)
```

`packages/core` y `packages/database` vivían originalmente en un monorepo compartido con la app mobile (ahora separada en su propio repositorio) — aquí son una copia independiente, fuente de verdad solo para esta app.

## Setup local

### Requisitos

- Node.js >= 20
- pnpm >= 9 (`npm i -g pnpm`)
- Proyecto en [Supabase](https://supabase.com)

### Instalación

```bash
git clone <repo-url>
cd fitnotes-web
pnpm install
```

### Variables de entorno

```bash
cp .env.example apps/web/.env.local
# Editar con las credenciales de tu proyecto Supabase
```

| Variable | Dónde se usa | Dónde obtenerla |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `apps/web/.env.local` | Supabase → Project Settings → API |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | `apps/web/.env.local` (opcional) | Google Cloud Console → Credenciales — ver [Google Drive backup](#google-drive-backup-opcional) |
| `NEXT_PUBLIC_APP_URL` | `apps/web/.env.local` | URL canónica de la app (sin barra final) |
| `PLAYWRIGHT_USER_EMAIL` / `PLAYWRIGHT_USER_PASSWORD` | `apps/web/.env.local` (opcional, solo E2E) | Cuenta Supabase dedicada a tests — ver [Testing](#testing) |

### Base de datos

Aplicar las migraciones en tu proyecto Supabase. Los archivos SQL están en `packages/database/src/supabase/migrations/`. Ejecutarlos **en orden** desde el SQL Editor de Supabase Studio, o vía la Management API si no tienes el CLI de Supabase instalado:

```bash
curl -X POST "https://api.supabase.com/v1/projects/<project-ref>/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" \
  -H "Content-Type: application/json" \
  -d '{"query": "<contenido del archivo .sql>"}'
```

Genera un Personal Access Token en [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens).

## Desarrollo

```bash
pnpm --filter @fitnotes/web dev

# Tests de un paquete concreto
pnpm --filter @fitnotes/core test
pnpm --filter @fitnotes/database test
```

### Type check

```bash
pnpm --filter @fitnotes/web build   # next build incluye type-check
pnpm run type-check                 # todos los paquetes (turbo)
```

## Testing

| Paquete/App | Framework | Comando | Cobertura actual |
|---|---|---|---|
| `packages/core` | Vitest | `pnpm --filter @fitnotes/core test` | 219 tests, 10 archivos |
| `packages/database` | Vitest | `pnpm --filter @fitnotes/database test` | 87 tests, 16 archivos |
| `apps/web` | Playwright | ver abajo | 13 specs en `apps/web/e2e/` |

### Playwright (E2E)

Requiere una cuenta Supabase dedicada a tests (no una cuenta real — los specs asumen datos limpios en fechas relativas):

```bash
cd apps/web
PLAYWRIGHT_USER_EMAIL=x PLAYWRIGHT_USER_PASSWORD=y npx playwright test --project=chromium-auth
```

Sin esas variables, los tests que requieren auth se saltan automáticamente. Hay 3 proyectos configurados: `setup` (login), `chromium` (specs legacy sin auth), `chromium-auth` (CRUD con `storageState` reutilizado).

## Build / Compilación

```bash
pnpm --filter @fitnotes/web build
```

## Despliegue

### Vercel

1. Conecta el repositorio en [vercel.com](https://vercel.com)
2. Configura el directorio raíz: **`apps/web`**
3. Vercel detecta Next.js automáticamente — `apps/web/vercel.json` ya tiene el `installCommand`/`buildCommand` correctos, además de los headers de seguridad (CSP, X-Frame-Options, etc.)
4. Añade en el dashboard de Vercel las mismas variables de entorno de la tabla de [Variables de entorno](#variables-de-entorno) (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL`)

## CI/CD — GitHub Actions

### `.github/workflows/ci.yml` — en cada push/PR a `main`

| Job | Qué hace | Cuándo |
|---|---|---|
| `ci` | Type check + tests | Siempre |
| `lint` | ESLint en todos los paquetes | Siempre |
| `rls-audit` | Verifica RLS habilitado + políticas correctas en las 13 tablas + 0 filas visibles sin auth | Push a `main`, o PRs con label `db` |

Todos usan **Turborepo remote caching** (`TURBO_TOKEN`/`TURBO_TEAM`) y cancelan runs anteriores del mismo PR (`cancel-in-progress: true`).

### Secrets necesarios (Settings → Secrets and variables → Actions)

| Secret | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Credenciales públicas de Supabase |
| `SUPABASE_PROJECT_REF` | Referencia del proyecto (ej. `fbhjiwtriqrxibqwsyqj`) |
| `SUPABASE_PAT` | Personal Access Token — [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) |
| `TURBO_TOKEN` | Token de Turborepo remote cache |

### Variables necesarias (Settings → Secrets and variables → Actions → Variables)

| Variable | Descripción |
|---|---|
| `TURBO_TEAM` | Nombre del equipo en Turborepo remote cache |

## Google Drive backup (opcional)

La funcionalidad de backup automático a Google Drive requiere una app OAuth2 en Google Cloud Console.

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → crear/seleccionar proyecto
2. Habilitar la **Google Drive API**
3. Credenciales → **OAuth 2.0 Client ID** → tipo Web application
4. Añadir URI de redirección autorizado: `https://<tu-dominio>/api/google/callback`
5. Copiar `Client ID`/`Client Secret` a `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
6. Establecer `NEXT_PUBLIC_APP_URL` con la URL canónica (sin barra final)

Una vez configurado, desde **Configuración → Datos** el usuario conecta su Drive y activa backup automático al finalizar cada entrenamiento (`apps/web/lib/driveBackup.ts`); se conservan las 5 copias más recientes (rotación automática en `api/google/backup/route.ts`).

## Funcionalidades

`/dashboard`, `/exercise`, `/progress`, `/calendar`, `/routines`, `/body-tracker`, `/tools`, `/settings`

- Registro de entrenamientos por fecha con navegación día a día, franja semanal + racha
- Gestión completa de ejercicios y categorías, 10 tipos de ejercicio
- Historial por ejercicio con gráficas de progreso (Recharts) exportables como PNG, trend line de regresión lineal
- PRs (real + estimado 1RM), tabla de estimaciones 1–15 reps
- Rutinas con días, ejercicios, supersets y series predefinidas
- Calendario con dots de color por categoría y filtros avanzados (por categoría Match Any/All, por ejercicio con condiciones de peso/reps)
- Body tracker configurable (medidas + objetivos)
- Herramientas: calculadora 1RM, Set%, discos de barra, temporizador de descanso
- Backup/restore completo (`.fitnotes`, JSON de 13 tablas), backup automático a Google Drive, CSV import/export
- Eliminación de cuenta e historial (con filtros), dark mode, accesibilidad WCAG AA, CSP

## Packages

### `@fitnotes/core`
Lógica de negocio sin dependencias de plataforma (cero imports de `react`/`next`). Tipos de dominio, stores Zustand (workout/exercise/progress/routine/bodyTracker/preferences), utilidades (`calculate1RM` Brzycki, `calculateVolume`, `calculatePace`, `calculatePlates`, `computePersonalRecordUpdate`, `generateUUID`…). **219 tests Vitest**.

### `@fitnotes/database`
Cliente Supabase + 8 repositorios remotos (`repositories/`+`supabase/`), usados por web. También incluye `local/`+`sync/` (repos locales SQLite + `SyncEngine`), heredados de cuando este código se compartía con la app mobile — no usados por web, se pueden podar en el futuro. **87 tests Vitest**.

### `@fitnotes/ui`
Vacío — reservado, sin design tokens ni componentes todavía.

### `@fitnotes/tsconfig`
Presets TypeScript compartidos: `base.json`, `nextjs.json`.

## Problemas conocidos

### Corregidos
- ~~**1 test fallando en `packages/database`**~~ — **arreglado** (2026-07-16). `syncEngine.test.ts` › "clears _dirty on the local row after a successful push" comparaba el `updated_at` de una fila remota simulada contra un literal fijo (`2026-07-04`) que ya había quedado en el pasado respecto al reloj real usado por `createWorkout` — el test siempre "perdía" el last-write-wins y fallaba desde esa fecha en adelante. Ahora el timestamp remoto se calcula relativo a `Date.now()`. 87/87 tests en verde.

### Limitaciones de diseño aceptadas
- **Duplicado de PRs tras claim+sync / multi-dispositivo en modo invitado**: son tradeoffs de diseño de la parte offline de `packages/database` (usada por la app mobile) — no afectan a web, que siempre lee/escribe Supabase directamente.

## Contribuir

1. Crea una rama desde `main`: `git checkout -b feat/nombre`
2. Instala dependencias: `pnpm install`
3. Antes de abrir PR:
   ```bash
   pnpm --filter @fitnotes/web build
   pnpm --filter @fitnotes/core test
   pnpm --filter @fitnotes/database test
   ```
4. Regla crítica: `packages/core` no puede importar `react` ni `next`
5. Si tocas el esquema de Supabase, añade la migración SQL en `packages/database/src/supabase/migrations/` con el siguiente número correlativo
6. El CI verifica tipos, tests, build, lint y RLS automáticamente en cada PR (ver plantilla en `.github/PULL_REQUEST_TEMPLATE.md`)
