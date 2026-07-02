"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import { History } from "lucide-react";
import { useExerciseStore, ExerciseType, getExerciseFields } from "@fitnotes/core";
import { createBrowserClient, createExerciseRepository } from "@fitnotes/database";

type SetRow = {
  id: string;
  weight?: number;
  reps?: number;
  distance?: number;
  time_seconds?: number;
  is_complete: boolean;
  comment?: string;
  order_index: number;
};

type Session = {
  workout_id: string;
  date: string;
  comment?: string;
  sets: SetRow[];
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m}min` : `${m}:${String(s).padStart(2, "0")}`;
}

function formatSet(set: SetRow, type: ExerciseType, unit: string): string {
  const f = getExerciseFields(type);
  const parts: string[] = [];
  if (f.weight && set.weight != null) parts.push(`${set.weight} ${unit}`);
  if (f.reps && set.reps != null) parts.push(`${set.reps} reps`);
  if (f.distance && set.distance != null) parts.push(`${set.distance} km`);
  if (f.time && set.time_seconds != null) parts.push(formatDuration(set.time_seconds));
  return parts.join(" × ") || "—";
}

export default function ExerciseHistoryPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const exercises = useExerciseStore((s) => s.exercises);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const exercise = exercises.find((e) => e.id === exerciseId);

  const client = createBrowserClient();
  const repo = createExerciseRepository(client);

  useEffect(() => {
    async function load() {
      // Load exercises into store if not already loaded
      if (exercises.length === 0) {
        const { data } = await repo.getExercises();
        if (data) {
          // populate store minimally — just need the exercise for display
        }
      }
      const { data, error: err } = await repo.getExerciseHistory(exerciseId);
      if (err) { setError(err.message); setLoading(false); return; }
      setSessions(data ?? []);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId]);

  const exerciseType = (exercise?.type ?? ExerciseType.WEIGHT_REPS) as ExerciseType;
  const unit = exercise?.weight_unit ?? "kg";
  const categoryId = exercise?.category_id;

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: sessions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 160,
    overscan: 5,
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Link href="/exercise" className="hover:text-foreground">Ejercicios</Link>
        {categoryId && (
          <>
            <span>/</span>
            <Link href={`/exercise/${categoryId}`} className="hover:text-foreground">Categoría</Link>
          </>
        )}
        <span>/</span>
        <span className="text-foreground font-medium">{exercise?.name ?? "Historial"}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{exercise?.name ?? "Historial del ejercicio"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Cargando…" : `${sessions.length} ${sessions.length === 1 ? "sesión" : "sesiones"} registradas`}
          </p>
        </div>
        {categoryId && (
          <Link
            href={`/exercise/${categoryId}`}
            className="text-sm text-muted-foreground hover:text-foreground shrink-0"
          >
            ← Volver
          </Link>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl border bg-secondary/30 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
          {error}
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-16 text-center">
          <History className="text-muted-foreground" size={40} aria-hidden="true" />
          <p className="font-medium text-muted-foreground">Sin historial todavía</p>
          <p className="text-sm text-muted-foreground">Este ejercicio no tiene series registradas.</p>
        </div>
      ) : (
        <div ref={parentRef} className="overflow-auto" style={{ maxHeight: "70vh" }}>
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const session = sessions[virtualRow.index]!;
              return (
                <div
                  key={session.workout_id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualRow.start}px)` }}
                  className="pb-4"
                >
                  <div className="rounded-2xl border bg-card overflow-hidden">
                    <div className="bg-secondary/30 px-5 py-3 border-b flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm capitalize">{formatDate(session.date)}</p>
                        {session.comment && (
                          <p className="text-xs text-muted-foreground mt-0.5">{session.comment}</p>
                        )}
                      </div>
                      <Link
                        href={`/workout/${session.date}`}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Ver workout →
                      </Link>
                    </div>
                    {session.sets.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-muted-foreground">Sin series</p>
                    ) : (
                      <div className="divide-y">
                        {session.sets.map((set, idx) => (
                          <div key={set.id} className="flex items-center gap-4 px-5 py-2.5">
                            <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-semibold shrink-0 ${
                              set.is_complete ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                            }`}>
                              {idx + 1}
                            </span>
                            <span className="text-sm flex-1">{formatSet(set, exerciseType, unit)}</span>
                            {set.comment && (
                              <span className="text-xs text-muted-foreground truncate max-w-[160px]">{set.comment}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
