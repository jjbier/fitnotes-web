/**
 * Modal para elegir a cuál de varios entrenamientos de un mismo día aplicar
 * una acción (ver o añadir algo), cuando hay más de uno — ver
 * docs/implementation-plan-multi-workout-per-day.md, Fase 4. Con 0 o 1
 * entrenamiento ese día, quien use `useWorkoutForDate` nunca llega a
 * mostrar este modal (resuelve directo).
 */

"use client";

import { useEffect, useRef } from "react";

export interface PickableWorkout {
  id: string;
  start_time?: string | null;
  comment?: string | null;
}

interface Props {
  workouts: PickableWorkout[];
  creating: boolean;
  onChoose: (workoutId: string) => void;
  onCreateNew: () => void;
  onClose: () => void;
}

/** "18:32" a partir de un ISO datetime, o "Sin hora" si no hay `start_time` o no es parseable. */
function formatTime(startTime?: string | null): string {
  if (!startTime) return "Sin hora";
  const d = new Date(startTime);
  if (Number.isNaN(d.getTime())) return "Sin hora";
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export default function WorkoutPickerModal({ workouts, creating, onChoose, onCreateNew, onClose }: Props) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="workout-picker-title"
        className="w-full max-w-sm rounded-xl border bg-card shadow-lg"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b">
          <h2 id="workout-picker-title" className="font-semibold">Varios entrenamientos hoy</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Cerrar"
            className="text-muted-foreground hover:text-foreground text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-2">
          <p className="text-xs text-muted-foreground">¿A cuál quieres añadirlo?</p>
          {workouts.map((w) => (
            <button
              key={w.id}
              onClick={() => onChoose(w.id)}
              className="w-full flex items-center justify-between rounded-xl border px-3 py-2 text-sm hover:bg-secondary text-left"
            >
              <span className="font-medium">{formatTime(w.start_time)}</span>
              {w.comment && <span className="text-xs text-muted-foreground truncate max-w-[60%]">{w.comment}</span>}
            </button>
          ))}
        </div>

        <div className="flex gap-2 justify-end px-5 pb-5">
          <button
            onClick={onClose}
            className="rounded-xl border px-4 py-2 text-sm hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={onCreateNew}
            disabled={creating}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {creating ? "Creando…" : "+ Nuevo entrenamiento"}
          </button>
        </div>
      </div>
    </div>
  );
}
