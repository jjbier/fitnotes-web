# Referencia — `apps/web`

_Generado a partir de la documentación TSDoc/JSDoc añadida al código fuente (2026-07-16). Next.js 15 App Router, React 19 — siempre requiere cuenta Supabase._

## `app/` — rutas

### Raíz y grupo `(app)`
| Ruta | Responsabilidad |
|---|---|
| `app/layout.tsx` | Layout raíz: `<html>`/`<body>` en español, `ThemeProvider`, metadata (plantilla de título) |
| `app/not-found.tsx` | Página 404 global |
| `app/page.tsx` | Landing pública en `/`, CTAs a login/register, sin comprobar sesión |
| `app/(app)/layout.tsx` | Layout del grupo autenticado: `ConfirmProvider` + `Sidebar`/`MobileNav` + skip-link de accesibilidad |
| `middleware.ts` | Guard de sesión global: redirige a `/login` si no hay usuario autenticado (deja pasar rutas públicas/API/assets) |

### Dashboard / Workout / Exercise / Calendar
| Ruta | Responsabilidad | Funciones internas destacadas |
|---|---|---|
| `dashboard/page.tsx` | "Hoy": entrenamiento del día actual, navegable a otras fechas | `loadWorkoutForDate`, `resolveUserId`, `handleReorderExercises` (optimista), `handleDeleteSelected` (lote), `handleFinish`, `handleDateChange` |
| `workout/[date]/page.tsx` | Mismo patrón que dashboard para fecha arbitraria, con sidebar de navegación | mismos handlers que dashboard |
| `exercise/page.tsx` | Catálogo de categorías con buscador global virtualizado y reorder drag&drop | `resolveUserId`, `doCreateExercise`, `handleToggleFavorite`/`handleDeleteExercise` (optimistas), `handleCategoryDrop` |
| `exercise/[id]/page.tsx` | Ejercicios de una categoría (o favoritos), búsqueda debounced, lista virtualizada | `useDebounce`, `doCreate`, `handleDelete`/`handleToggleFavorite` (optimistas) |
| `exercise/history/[exerciseId]/page.tsx` | Historial de sesiones de un ejercicio, virtualizado (`useVirtualizer`) | — |
| `calendar/page.tsx` | Vista mensual con puntos por categoría, filtros combinables, vista de lista con historial expandible | `getDaysInMonth`, `getFirstDayOfWeek`, `applyExerciseFilter`, `toggleHistoryExpand` (carga bajo demanda) |

### Progress / Routines / Body-tracker / Search
| Ruta | Responsabilidad |
|---|---|
| `progress/page.tsx` | Selector de ejercicio + 5 pestañas (récords/gráfica/historial/estadísticas/objetivos); edición inline de series históricas, copiar series de un día pasado a hoy, CRUD de objetivos |
| `routines/page.tsx` | Listado de rutinas: crear/editar/copiar/eliminar, acceso al editor de días |
| `routines/[id]/page.tsx` | Editor de rutina: días/ejercicios drag&drop, supersets (crear/desagrupar/renombrar), series predefinidas vía modal, "Registrar todo" (crea el workout de hoy copiando predefinidos o de la última sesión) |
| `body-tracker/page.tsx` | Registrar/Historial/Gráfica de medidas corporales; siembra medidas por defecto si el usuario no tiene ninguna |
| `body-tracker/settings/page.tsx` | Activar/desactivar/reordenar/crear/editar/reiniciar/eliminar medidas |
| `search/page.tsx` | Búsqueda global de ejercicios por nombre, ordenados por uso reciente |

### Tools / Settings / Auth / API / raíz
| Ruta | Responsabilidad |
|---|---|
| `tools/page.tsx` | Calculadoras 1RM / porcentaje de set / discos / temporizador de descanso, por pestaña |
| `settings/page.tsx` | Perfil, preferencias, comportamiento de entrenamiento, pantalla de inicio, datos (backup/restore/Drive/CSV), zona de peligro |
| `(auth)/login/page.tsx` | Login vía `signInWithPassword`, redirige a `/dashboard` |
| `(auth)/register/page.tsx` | Registro vía `signUp`, valida contraseñas localmente, aviso de confirmación por email |
| `api/google/auth/route.ts` (`GET`) | Inicia OAuth: construye URL de consentimiento de Google con `state` anti-CSRF en cookie httpOnly |
| `api/google/callback/route.ts` (`GET`) | Valida `state`, intercambia `code` por `refresh_token`, lo guarda en `user_metadata` |
| `api/google/backup/route.ts` (`POST`) | Refresca token, exporta todas las tablas del usuario a JSON, sube a Drive, rota backups antiguos |
| `api/google/disconnect/route.ts` (`POST`) | Revoca el refresh token en Google (best-effort) y limpia campos de Drive en `user_metadata` |

_Cada ruta tiene además `error.tsx`/`loading.tsx`/`layout.tsx` — error boundary con botón de reintento, esqueleto de carga, y metadata de título de pestaña, respectivamente (sin lógica propia)._

## `components/`

### Workout
| Componente | Responsabilidad |
|---|---|
| `CopyWorkoutModal` | Copia ejercicios/series de un entrenamiento anterior (últimos 20), bloquea UI mientras copia para evitar duplicados |
| `MoveWorkoutModal` | Cambia la fecha de un entrenamiento con detección de conflicto en vivo (`getWorkoutByDate` en cada cambio) |
| `ShareWorkoutModal` | Exporta el entrenamiento como texto plano al portapapeles (`buildShareText`) |
| `FinishSummaryModal` | 4 tarjetas de estadísticas al finalizar (puramente presentacional) |
| `NavigationPanel` | Lista de ejercicios reordenable (HTML5 DnD) con progreso y modo selección múltiple |
| `TrainingScreen` | Registro de series con mutaciones optimistas + rollback; auto-completar serie anterior; avance automático; cálculo local de PRs |
| `SetForm` / `SetRow` / `SetList` | Alta de serie según tipo de ejercicio / fila editable / listado de solo lectura |
| `SetCommentModal` | Edición del comentario de texto libre de una serie |
| `WeekStrip` | Franja semanal con racha (`getWeekDates`, `getStreak`) |
| `WorkoutTimer` | Cronómetro con pausa/reanudar, acumula base+segmento en curso |

### Layout
`Sidebar` (desktop) / `MobileNav` (móvil) — 6 secciones de navegación, resaltado de tab activa, cierre de sesión desde `Sidebar`.

### Exercises / Progress / Routines
| Componente | Responsabilidad |
|---|---|
| `CategoryForm` / `ExerciseForm` | Formularios de categoría/ejercicio; `ExerciseForm` usa `useConfirm()` para advertir de pérdida de campos al cambiar tipo o conversión de unidades al cambiar peso |
| `ExerciseCard` | Fila con menú contextual flotante posicionado dinámicamente (foco, Escape, cierre en scroll) |
| `ExerciseOverview` | Drawer modal de detalle (récords/gráfica/historial/estadísticas/objetivo), focus trap + Escape |
| `PeriodStats` | Estadísticas agregadas por periodo (sesión/semana/mes/año/todo/personalizado) |
| `PersonalRecords` | Vista Real/Estimado de un ejercicio, o tabla resumen de todos |
| `ProgressChart` | Gráfica Recharts con métrica/modo seleccionable, tendencia (`linearRegression`) y exportación PNG |
| `DaySection` | Día de rutina colapsable con supersets y drag&drop |
| `PredefinedSetsModal` | Editor tabular de series predefinidas; fila vacía = "copiar del historial" |
| `RoutineForm` | Metadatos de rutina (nombre/notas) |

### Genéricos
| Componente | Responsabilidad |
|---|---|
| `ConfirmDialog` (`ConfirmProvider` + `useConfirm()`) | Sustituto accesible de `window.confirm()` basado en contexto + Promises |
| `EmptyState` | Icono + texto + acción primaria/secundaria, reutilizable |

## `lib/`
| Archivo | Export | Responsabilidad |
|---|---|---|
| `driveBackup.ts` | `autoBackupToDriveIfEnabled` | Sube backup vía `/api/google/backup` si el ajuste está activo; desactiva el ajuste si el token es inválido |
| `settings.ts` | `SETTING_KEYS`, `readBool`/`writeBool`, `readWeekStart`, `readDefaultWeightIncrement`, `readEstimatedRecordsRepLimit`, `readHiddenCategories`/`writeHiddenCategories` | Ajustes de usuario en `localStorage` (sin persistencia SQLite ni sync, a diferencia de mobile) |
| `useFocusTrap.ts` | `useFocusTrap` | Atrapa el foco de teclado dentro de un contenedor (modales/diálogos) |
| `utils.ts` | `cn` | `clsx` + `twMerge` para resolver conflictos entre utilidades Tailwind |
