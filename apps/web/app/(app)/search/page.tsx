"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, X, Clock, ChevronRight } from "lucide-react";
import { useExerciseStore, ExerciseType, formatShortDate, formatDaysAgo } from "@fitnotes/core";
import { createBrowserClient, createExerciseRepository, createWorkoutRepository } from "@fitnotes/database";

type LastWorkout = { date: string; maxWeight: number; maxReps: number; setCount: number };

const TYPE_LABELS: Partial<Record<ExerciseType, string>> = {
  [ExerciseType.WEIGHT_REPS]: "Peso+Reps",
  [ExerciseType.REPS_ONLY]: "Reps",
  [ExerciseType.WEIGHT_ONLY]: "Peso",
  [ExerciseType.TIME_ONLY]: "Tiempo",
  [ExerciseType.DISTANCE_TIME]: "Distancia+Tiempo",
  [ExerciseType.WEIGHT_DISTANCE]: "Peso+Distancia",
  [ExerciseType.WEIGHT_TIME]: "Peso+Tiempo",
  [ExerciseType.REPS_DISTANCE]: "Reps+Distancia",
  [ExerciseType.REPS_TIME]: "Reps+Tiempo",
  [ExerciseType.DISTANCE_ONLY]: "Distancia",
};

/**
 * Búsqueda global de ejercicios (`/search`): filtra por nombre (case-insensitive) y
 * muestra, por ejercicio, su categoría, tipo (`TYPE_LABELS`) y el último entrenamiento
 * en que se usó (fecha relativa, series y mejor peso/reps vía `getLastWorkoutByExercises`).
 * Los ejercicios con historial reciente se listan primero; el resto, alfabéticamente.
 * Cada fila enlaza al historial del ejercicio (`/exercise/history/[id]`).
 */
export default function SearchPage() {
  const exercises = useExerciseStore((s) => s.exercises);
  const categories = useExerciseStore((s) => s.categories);
  const loadExercises = useExerciseStore((s) => s.loadExercises);

  const client = useMemo(() => createBrowserClient(), []);
  const exRepo = useMemo(() => createExerciseRepository(client), [client]);
  const workoutRepo = useMemo(() => createWorkoutRepository(client), [client]);

  const [query, setQuery] = useState("");
  const [lastWorkouts, setLastWorkouts] = useState<Record<string, LastWorkout>>({});
  const [loading, setLoading] = useState(true);

  const catMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  useEffect(() => {
    async function load() {
      let list = exercises;
      if (list.length === 0) {
        const [catRes, exRes] = await Promise.all([exRepo.getCategories(), exRepo.getExercises()]);
        if (catRes.data && exRes.data) {
          list = exRes.data.map((ex) => ({
            id: ex.id, name: ex.name, category_id: ex.category_id ?? "",
            type: ex.type as ExerciseType, weight_unit: ex.weight_unit as "kg" | "lb",
            notes: ex.notes ?? undefined, is_favorite: ex.is_favorite, created_at: ex.created_at,
          }));
          loadExercises(catRes.data, list);
        }
      }
      if (list.length > 0) {
        const data = await workoutRepo.getLastWorkoutByExercises(list.map((e) => e.id));
        setLastWorkouts(data);
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter((e) => e.name.toLowerCase().includes(q));
  }, [exercises, query]);

  // Ejercicios con historial reciente primero, luego alfabético.
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const da = lastWorkouts[a.id]?.date ?? "";
      const db = lastWorkouts[b.id]?.date ?? "";
      if (da && db) return db.localeCompare(da);
      if (da) return -1;
      if (db) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filtered, lastWorkouts]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/exercise"
          aria-label="Volver"
          className="rounded-xl border p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="global-search-input" className="sr-only">Buscar ejercicio</label>
          <input
            id="global-search-input"
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar ejercicio…"
            className="w-full rounded-xl border bg-background py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {query.length > 0 && (
            <button
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Search className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {query ? `Sin resultados para "${query}"` : "Sin ejercicios"}
          </p>
        </div>
      ) : (
        <div>
          <p className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {sorted.length} ejercicio{sorted.length !== 1 ? "s" : ""}
          </p>
          <div className="divide-y rounded-2xl border">
            {sorted.map((ex) => {
              const lw = lastWorkouts[ex.id];
              const cat = catMap[ex.category_id ?? ""];
              return (
                <Link
                  key={ex.id}
                  href={`/exercise/history/${ex.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-secondary/50"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-sm font-semibold">{ex.name}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {cat && <span>{cat}</span>}
                      {cat && <span>·</span>}
                      <span>{TYPE_LABELS[ex.type] ?? ex.type}</span>
                    </div>
                    {lw ? (
                      <div className="flex items-center gap-1.5 text-xs text-primary">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        <span>{formatDaysAgo(lw.date)} · {formatShortDate(lw.date)}</span>
                        {lw.setCount > 0 && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">{lw.setCount} serie{lw.setCount !== 1 ? "s" : ""}</span>
                            {lw.maxWeight > 0 && <span className="text-muted-foreground">· {lw.maxWeight}kg</span>}
                            {lw.maxWeight === 0 && lw.maxReps > 0 && <span className="text-muted-foreground">· {lw.maxReps} reps</span>}
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/60">Sin registros</p>
                    )}
                  </div>
                  <ChevronRight className="text-muted-foreground" size={16} aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
