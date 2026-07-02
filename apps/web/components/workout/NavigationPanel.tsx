"use client";

import { useState } from "react";
import { GripVertical, CheckCircle2, Trash2, Square, CheckSquare } from "lucide-react";
import type { WorkoutExercise, Exercise, Set as FitSet } from "@fitnotes/core";

interface NavigationPanelProps {
  workoutExercises: WorkoutExercise[];
  exercises: Exercise[];
  sets: Record<string, FitSet[]>;
  activeExerciseId: string | null;
  onSelectExercise: (workoutExerciseId: string) => void;
  onAddExercise: () => void;
  onReorderExercises?: (orderedIds: string[]) => void;
  onDeleteExercise?: (workoutExerciseId: string, exerciseName: string) => void;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (workoutExerciseId: string) => void;
}

export default function NavigationPanel({
  workoutExercises,
  exercises,
  sets,
  activeExerciseId,
  onSelectExercise,
  onAddExercise,
  onReorderExercises,
  onDeleteExercise,
  selectMode = false,
  selectedIds,
  onToggleSelect,
}: NavigationPanelProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const sorted = [...workoutExercises].sort((a, b) => a.order_index - b.order_index);
  const canReorder = !!onReorderExercises && !selectMode;

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
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1 mb-1">
        Ejercicios
      </h3>

      {sorted.map((we, i) => {
        const exercise = exercises.find((e) => e.id === we.exercise_id);
        const exerciseSets = sets[we.id] ?? [];
        const completedSets = exerciseSets.filter((s) => s.is_complete).length;
        const totalSets = exerciseSets.length;
        const allDone = totalSets > 0 && completedSets === totalSets;
        const progress = totalSets > 0 ? completedSets / totalSets : 0;
        const isActive = activeExerciseId === we.id;
        const isSelected = !!selectedIds?.has(we.id);
        const isBeingDragged = dragIdx === i;
        const isDragTarget = dragOverIdx === i && dragIdx !== i;
        const exName = exercise?.name ?? "Desconocido";

        return (
          <div
            key={we.id}
            draggable={canReorder}
            onDragStart={() => canReorder && setDragIdx(i)}
            onDragOver={(e) => { if (canReorder) { e.preventDefault(); setDragOverIdx(i); } }}
            onDragEnd={canReorder ? handleDragEnd : undefined}
            className={[
              "group overflow-hidden rounded-xl border transition-colors",
              isBeingDragged ? "opacity-40" : "",
              isDragTarget ? "ring-2 ring-primary" : "",
              isSelected
                ? "border-primary bg-primary/10"
                : isActive
                ? "border-primary bg-primary/5"
                : allDone
                ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
                : "border-transparent",
              canReorder ? "cursor-grab active:cursor-grabbing" : "",
            ].join(" ")}
          >
            <div className="flex items-center gap-1 pr-1">
              {selectMode && (
                <button
                  onClick={() => onToggleSelect?.(we.id)}
                  className="shrink-0 pl-2 text-muted-foreground"
                  aria-label={isSelected ? `Deseleccionar ${exName}` : `Seleccionar ${exName}`}
                >
                  {isSelected ? <CheckSquare className="text-primary" size={18} aria-hidden="true" /> : <Square size={18} aria-hidden="true" />}
                </button>
              )}
              {canReorder && (
                <span className="shrink-0 pl-1 text-muted-foreground/40 group-hover:text-muted-foreground/70" aria-hidden="true">
                  <GripVertical size={16} />
                </span>
              )}
              <button
                onClick={() => (selectMode ? onToggleSelect?.(we.id) : onSelectExercise(we.id))}
                className="flex flex-1 items-center justify-between gap-2 rounded-xl px-2 py-2.5 text-left text-sm min-w-0"
              >
                <span className="truncate flex-1 font-medium">{exName}</span>
                {totalSets > 0 && (
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                    {completedSets}/{totalSets}
                  </span>
                )}
                {allDone && <CheckCircle2 className="text-green-600 shrink-0" size={16} aria-hidden="true" />}
              </button>
              {!selectMode && onDeleteExercise && (
                <button
                  onClick={() => onDeleteExercise(we.id, exName)}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-0 hover:bg-secondary hover:text-destructive group-hover:opacity-100"
                  aria-label={`Eliminar ${exName}`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              )}
            </div>
            {totalSets > 0 && !allDone && (
              <div className="h-[3px] bg-secondary">
                <div className="h-[3px] bg-primary transition-all" style={{ width: `${progress * 100}%` }} />
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={onAddExercise}
        className="mt-1 flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
      >
        <span>+</span>
        Agregar ejercicio
      </button>
    </div>
  );
}
