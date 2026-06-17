"use client";

import { ExerciseType } from "@fitnotes/core";
import type { Exercise } from "@fitnotes/core";
import { useState } from "react";

const TYPE_BADGE: Record<ExerciseType, string> = {
  [ExerciseType.WEIGHT_REPS]: "Wt × Reps",
  [ExerciseType.DISTANCE_TIME]: "Dist / Time",
  [ExerciseType.REPS_ONLY]: "Reps",
  [ExerciseType.WEIGHT_ONLY]: "Weight",
  [ExerciseType.TIME_ONLY]: "Time",
};

interface Props {
  exercise: Exercise;
  onEdit: (exercise: Exercise) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
}

export default function ExerciseCard({ exercise, onEdit, onDelete, onToggleFavorite }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative flex items-center justify-between rounded-lg border bg-card px-4 py-3 hover:bg-secondary/30 transition-colors group">
      {/* Left */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{exercise.name}</p>
        <span className="inline-block mt-0.5 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {TYPE_BADGE[exercise.type]}
        </span>
        {exercise.notes && (
          <p className="text-xs text-muted-foreground mt-1 truncate">{exercise.notes}</p>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-1 ml-3">
        {/* Favorite */}
        <button
          onClick={() => onToggleFavorite(exercise.id, exercise.is_favorite)}
          className="p-1.5 rounded-md hover:bg-secondary transition-colors"
          aria-label={exercise.is_favorite ? "Remove from favorites" : "Add to favorites"}
        >
          {exercise.is_favorite ? (
            <span className="text-primary text-base">★</span>
          ) : (
            <span className="text-muted-foreground text-base">☆</span>
          )}
        </button>

        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground"
            aria-label="Options"
          >
            ⋯
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-md border bg-card shadow-lg py-1">
                <button
                  onClick={() => { onEdit(exercise); setMenuOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-secondary"
                >
                  Edit
                </button>
                <button
                  onClick={() => { onDelete(exercise.id); setMenuOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-secondary"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
