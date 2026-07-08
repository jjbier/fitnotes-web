"use client";

import { Check, MessageCircle, Trash2, Trophy } from "lucide-react";
import { getExerciseFields } from "@fitnotes/core";
import type { Set, ExerciseType } from "@fitnotes/core";

interface Props {
  set: Set;
  exerciseType: ExerciseType;
  onUpdate: (setId: string, patch: Partial<Set>) => void;
  onDelete: (setId: string) => void;
  onToggleComplete: (setId: string, current: boolean) => void;
  onComment: (setId: string) => void;
  isPR?: boolean;
  weightStep?: number;
}

export default function SetRow({ set, exerciseType, onUpdate, onDelete, onToggleComplete, onComment, isPR, weightStep = 0.5 }: Props) {
  const fields = getExerciseFields(exerciseType);
  return (
    <div className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm ${set.is_complete ? "bg-primary/5 border-primary/20" : ""}`}>
      <button
        onClick={() => onToggleComplete(set.id, set.is_complete)}
        className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center ${set.is_complete ? "bg-primary border-primary text-white" : "border-muted-foreground/40"}`}
        aria-label={set.is_complete ? "Marcar serie como pendiente" : "Marcar serie como completada"}
        aria-pressed={set.is_complete}
      >
        {set.is_complete && <Check size={12} aria-hidden="true" />}
      </button>

      <div className="flex-1 flex items-center gap-2 flex-wrap">
        {fields.weight && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={set.weight ?? ""}
              onChange={(e) => onUpdate(set.id, { weight: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="kg"
              min="0"
              step={weightStep}
              aria-label="Peso en kg"
              className="w-16 rounded border px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground" aria-hidden="true">kg</span>
          </div>
        )}
        {fields.reps && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={set.reps ?? ""}
              onChange={(e) => onUpdate(set.id, { reps: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="reps"
              min="0"
              aria-label="Repeticiones"
              className="w-14 rounded border px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground" aria-hidden="true">reps</span>
          </div>
        )}
        {fields.distance && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={set.distance ?? ""}
              onChange={(e) => onUpdate(set.id, { distance: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="km"
              min="0"
              step="0.1"
              aria-label="Distancia en km"
              className="w-16 rounded border px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground" aria-hidden="true">km</span>
          </div>
        )}
        {fields.time && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={set.time_seconds ?? ""}
              onChange={(e) => onUpdate(set.id, { time_seconds: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="seg"
              min="0"
              aria-label="Tiempo en segundos"
              className="w-16 rounded border px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground" aria-hidden="true">s</span>
          </div>
        )}
      </div>

      {isPR && (
        <span title="Récord personal" className="shrink-0 text-amber-500" aria-label="Récord personal">
          <Trophy size={14} fill="currentColor" aria-hidden="true" />
        </span>
      )}

      <button
        onClick={() => onComment(set.id)}
        aria-label={set.comment ? `Comentario: ${set.comment}` : "Añadir comentario"}
        title={set.comment || "Añadir comentario"}
        className={`shrink-0 ${set.comment ? "text-blue-500" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
      >
        <MessageCircle size={15} aria-hidden="true" />
      </button>

      <button
        onClick={() => onDelete(set.id)}
        className="shrink-0 text-muted-foreground hover:text-destructive"
        aria-label="Eliminar serie"
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
