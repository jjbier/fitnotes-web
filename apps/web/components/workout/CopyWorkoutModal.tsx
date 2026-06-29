"use client";

import { useEffect, useRef, useState } from "react";
import { formatWorkoutDate } from "@fitnotes/core";
import { createBrowserClient, createWorkoutRepository } from "@fitnotes/database";
import type { WorkoutExercise, Workout } from "@fitnotes/core";

interface Props {
  currentWorkout: { id: string; date: string };
  currentExercises: WorkoutExercise[];
  userId: string;
  onCopied: () => void;
  onClose: () => void;
}

export default function CopyWorkoutModal({
  currentWorkout, currentExercises, userId, onCopied, onClose,
}: Props) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const client = createBrowserClient();
  const repo = createWorkoutRepository(client);

  useEffect(() => {
    closeRef.current?.focus();
    async function load() {
      const { data } = await repo.getWorkouts(20);
      if (data) {
        setWorkouts(
          data
            .filter((w) => w.id !== currentWorkout.id)
            .map((w) => ({
              id: w.id, date: w.date,
              comment: w.comment ?? undefined,
              start_time: w.start_time ?? undefined,
              end_time: w.end_time ?? undefined,
              duration_minutes: w.duration_minutes ?? undefined,
            }))
        );
      }
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleCopy(sourceWorkoutId: string) {
    setCopying(true);
    const { data: sourceExercises } = await repo.getWorkoutExercises(sourceWorkoutId);
    const currentExerciseIds = new Set(currentExercises.map((we) => we.exercise_id));
    let orderIndex = currentExercises.length;

    for (const we of sourceExercises ?? []) {
      if (currentExerciseIds.has(we.exercise_id)) continue;
      await repo.addExercise({
        workout_id: currentWorkout.id,
        exercise_id: we.exercise_id,
        order_index: orderIndex++,
      }, userId);
    }

    setCopying(false);
    onCopied();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="copy-modal-title"
        className="w-full max-w-sm rounded-xl border bg-card shadow-lg flex flex-col max-h-[70vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b shrink-0">
          <h2 id="copy-modal-title" className="font-semibold">Copiar ejercicios de…</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Cerrar"
            className="text-muted-foreground hover:text-foreground text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {loading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-secondary/40 animate-pulse" />
              ))}
            </div>
          ) : workouts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sin entrenamientos anteriores.
            </p>
          ) : (
            workouts.map((w) => (
              <button
                key={w.id}
                onClick={() => handleCopy(w.id)}
                disabled={copying}
                className="w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-sm text-left hover:bg-secondary/50 disabled:opacity-50 transition-colors"
              >
                <span className="text-primary">📅</span>
                <span className="flex-1 font-medium">{formatWorkoutDate(w.date)}</span>
                {w.comment && (
                  <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                    {w.comment}
                  </span>
                )}
                <span className="text-muted-foreground text-xs">→</span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        {copying && (
          <div className="px-5 py-3 border-t shrink-0 text-sm text-muted-foreground text-center animate-pulse">
            Copiando ejercicios…
          </div>
        )}
      </div>
    </div>
  );
}
