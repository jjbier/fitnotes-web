"use client";

import { useEffect, useRef, useState } from "react";
import type { WorkoutExercise, Exercise, Set as FitSet } from "@fitnotes/core";

interface Props {
  date: string;
  workoutExercises: WorkoutExercise[];
  exercises: Exercise[];
  sets: Record<string, FitSet[]>;
  onClose: () => void;
}

function buildShareText(
  date: string,
  workoutExercises: WorkoutExercise[],
  exercises: Exercise[],
  sets: Record<string, FitSet[]>,
  selected: globalThis.Set<string>
): string {
  const lines: string[] = [`Entrenamiento — ${date}`];
  for (const we of workoutExercises) {
    if (!selected.has(we.id)) continue;
    const ex = exercises.find((e) => e.id === we.exercise_id);
    lines.push(ex?.name ?? we.exercise_id);
    const weSets = (sets[we.id] ?? []).filter((s) => s.is_complete);
    weSets.forEach((s, i) => {
      const parts: string[] = [];
      if (s.weight != null && s.reps != null) parts.push(`${s.weight} kg × ${s.reps}`);
      else if (s.reps != null) parts.push(`${s.reps} reps`);
      else if (s.distance != null && s.time_seconds != null) parts.push(`${s.distance} m en ${s.time_seconds} s`);
      else if (s.distance != null) parts.push(`${s.distance} m`);
      else if (s.time_seconds != null) parts.push(`${s.time_seconds} s`);
      lines.push(`  Serie ${i + 1}: ${parts.join(", ") || "—"}`);
    });
  }
  return lines.join("\n");
}

export default function ShareWorkoutModal({
  date, workoutExercises, exercises, sets, onClose,
}: Props) {
  const [selected, setSelected] = useState<globalThis.Set<string>>(
    () => new globalThis.Set(workoutExercises.map((we) => we.id))
  );
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggleExercise(weId: string) {
    setSelected((prev: globalThis.Set<string>) => {
      const next = new globalThis.Set(prev);
      if (next.has(weId)) next.delete(weId);
      else next.add(weId);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === workoutExercises.length) {
      setSelected(new globalThis.Set());
    } else {
      setSelected(new globalThis.Set(workoutExercises.map((we) => we.id)));
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const text = buildShareText(date, workoutExercises, exercises, sets, selected);
  const allSelected = selected.size === workoutExercises.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        className="w-full max-w-md rounded-xl border bg-card shadow-lg flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b shrink-0">
          <h2 id="share-modal-title" className="font-semibold">Compartir entrenamiento</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Cerrar"
            className="text-muted-foreground hover:text-foreground text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Exercise selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ejercicios</p>
              <button
                onClick={toggleAll}
                className="text-xs text-primary hover:underline"
              >
                {allSelected ? "Deseleccionar todo" : "Seleccionar todo"}
              </button>
            </div>
            {workoutExercises.map((we) => {
              const ex = exercises.find((e) => e.id === we.exercise_id);
              const completedSets = (sets[we.id] ?? []).filter((s) => s.is_complete).length;
              const totalSets = (sets[we.id] ?? []).length;
              return (
                <label
                  key={we.id}
                  className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-secondary/50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(we.id)}
                    onChange={() => toggleExercise(we.id)}
                    className="accent-primary"
                  />
                  <span className="flex-1 text-sm">{ex?.name ?? we.exercise_id}</span>
                  <span className="text-xs text-muted-foreground">
                    {completedSets}/{totalSets} series
                  </span>
                </label>
              );
            })}
          </div>

          {/* Text preview */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vista previa</p>
            <pre className="rounded-md bg-secondary/50 px-3 py-2.5 text-xs font-mono whitespace-pre-wrap break-words leading-relaxed">
              {selected.size === 0 ? "Selecciona al menos un ejercicio." : text}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-5 py-4 border-t shrink-0">
          <button
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={handleCopy}
            disabled={selected.size === 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 min-w-[120px]"
          >
            {copied ? "¡Copiado! ✓" : "Copiar texto"}
          </button>
        </div>
      </div>
    </div>
  );
}
