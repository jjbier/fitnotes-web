"use client";

import type { Set, ExerciseType } from "@fitnotes/core";

interface Props {
  set: Set;
  exerciseType: ExerciseType;
  onUpdate: (setId: string, patch: Partial<Set>) => void;
  onDelete: (setId: string) => void;
  onToggleComplete: (setId: string, current: boolean) => void;
  isPR?: boolean;
}

export default function SetRow({ set, exerciseType, onUpdate, onDelete, onToggleComplete, isPR }: Props) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${set.is_complete ? "bg-primary/5 border-primary/20" : ""}`}>
      <button
        onClick={() => onToggleComplete(set.id, set.is_complete)}
        className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center ${set.is_complete ? "bg-primary border-primary text-white" : "border-muted-foreground/40"}`}
      >
        {set.is_complete && <span className="text-xs">✓</span>}
      </button>

      <div className="flex-1 flex items-center gap-2 flex-wrap">
        {(exerciseType === "WEIGHT_REPS" || exerciseType === "WEIGHT_ONLY") && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={set.weight ?? ""}
              onChange={(e) => onUpdate(set.id, { weight: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="kg"
              min="0"
              step="0.5"
              className="w-16 rounded border px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground">kg</span>
          </div>
        )}
        {(exerciseType === "WEIGHT_REPS" || exerciseType === "REPS_ONLY") && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={set.reps ?? ""}
              onChange={(e) => onUpdate(set.id, { reps: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="reps"
              min="0"
              className="w-14 rounded border px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground">reps</span>
          </div>
        )}
        {(exerciseType === "DISTANCE_TIME") && (
          <>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={set.distance ?? ""}
                onChange={(e) => onUpdate(set.id, { distance: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="km"
                min="0"
                step="0.1"
                className="w-16 rounded border px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="text-xs text-muted-foreground">km</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={set.time_seconds ?? ""}
                onChange={(e) => onUpdate(set.id, { time_seconds: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="sec"
                min="0"
                className="w-16 rounded border px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="text-xs text-muted-foreground">s</span>
            </div>
          </>
        )}
        {exerciseType === "TIME_ONLY" && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={set.time_seconds ?? ""}
              onChange={(e) => onUpdate(set.id, { time_seconds: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="sec"
              min="0"
              className="w-16 rounded border px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground">s</span>
          </div>
        )}
      </div>

      {isPR && <span title="Personal Record" className="text-amber-500 shrink-0">🏆</span>}
      {set.comment && <span title={set.comment} className="text-blue-500 text-xs shrink-0">💬</span>}

      <button onClick={() => onDelete(set.id)} className="text-muted-foreground hover:text-destructive text-xs shrink-0">✕</button>
    </div>
  );
}
