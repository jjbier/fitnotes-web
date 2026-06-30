"use client";

import { useState } from "react";
import type { WorkoutExercise, Exercise, Set } from "@fitnotes/core";

interface NavigationPanelProps {
  workoutExercises: WorkoutExercise[];
  exercises: Exercise[];
  sets: Record<string, Set[]>;
  activeExerciseId: string | null;
  onSelectExercise: (workoutExerciseId: string) => void;
  onAddExercise: () => void;
  onReorderExercises?: (orderedIds: string[]) => void;
}

export default function NavigationPanel({
  workoutExercises,
  exercises,
  sets,
  activeExerciseId,
  onSelectExercise,
  onAddExercise,
  onReorderExercises,
}: NavigationPanelProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const sorted = [...workoutExercises].sort((a, b) => a.order_index - b.order_index);

  function handleDragEnd() {
    if (dragIdx === null || dragOverIdx === null || dragIdx === dragOverIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const newOrder = [...sorted];
    const [moved] = newOrder.splice(dragIdx, 1);
    newOrder.splice(dragOverIdx, 0, moved!);
    setDragIdx(null);
    setDragOverIdx(null);
    onReorderExercises?.(newOrder.map((we) => we.id));
  }

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1 mb-2">
        Ejercicios
      </h3>

      {sorted.map((we, i) => {
        const exercise = exercises.find((e) => e.id === we.exercise_id);
        const exerciseSets = sets[we.id] ?? [];
        const completedSets = exerciseSets.filter((s) => s.is_complete).length;
        const isActive = activeExerciseId === we.id;
        const isBeingDragged = dragIdx === i;
        const isDragTarget = dragOverIdx === i && dragIdx !== i;

        return (
          <div
            key={we.id}
            draggable={!!onReorderExercises}
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i); }}
            onDragEnd={handleDragEnd}
            className={[
              "group rounded-md transition-opacity",
              isBeingDragged ? "opacity-40" : "",
              isDragTarget ? "ring-2 ring-primary" : "",
              onReorderExercises ? "cursor-grab active:cursor-grabbing" : "",
            ].join(" ")}
          >
            <button
              onClick={() => onSelectExercise(we.id)}
              className={`flex items-center justify-between w-full rounded-md px-3 py-2 text-sm text-left transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-secondary"
              }`}
            >
              {onReorderExercises && (
                <span
                  className={`mr-1.5 text-xs select-none shrink-0 ${
                    isActive ? "text-primary-foreground/40" : "text-muted-foreground/40 group-hover:text-muted-foreground/70"
                  }`}
                  aria-hidden="true"
                >
                  ⠿
                </span>
              )}
              <span className="truncate flex-1">{exercise?.name ?? "Desconocido"}</span>
              <span
                className={`ml-2 text-xs shrink-0 ${
                  isActive ? "text-primary-foreground/70" : "text-muted-foreground"
                }`}
              >
                {completedSets}/{exerciseSets.length}
              </span>
            </button>
          </div>
        );
      })}

      <button
        onClick={onAddExercise}
        className="mt-2 flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
      >
        <span>+</span>
        Agregar ejercicio
      </button>
    </div>
  );
}
