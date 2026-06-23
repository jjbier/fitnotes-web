"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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
            <div key={i} className="h-32 rounded-lg border bg-secondary/30 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
          {error}
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-16 text-center">
          <p className="text-2xl mb-3">🕒</p>
          <p className="font-medium text-muted-foreground">Sin historial todavía</p>
          <p className="text-sm text-muted-foreground mt-1">Este ejercicio no tiene series registradas.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div key={session.workout_id} className="rounded-lg border bg-card overflow-hidden">
              {/* Session header */}
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

              {/* Sets table */}
              {session.sets.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted-foreground">Sin series</p>
              ) : (
                <div className="divide-y">
                  {session.sets.map((set, idx) => (
                    <div key={set.id} className="flex items-center gap-4 px-5 py-2.5">
                      <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-semibold shrink-0 ${
                        set.is_complete
                          ? "bg-primary/10 text-primary"
                          : "bg-secondary text-muted-foreground"
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
          ))}
        </div>
      )}
    </div>
  );
}
