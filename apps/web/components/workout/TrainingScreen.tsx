"use client";

import { useState } from "react";
import { useWorkoutStore, useExerciseStore } from "@fitnotes/core";
import { createBrowserClient, createWorkoutRepository } from "@fitnotes/database";
import SetRow from "./SetRow";
import type { ExerciseType, Set as FitSet } from "@fitnotes/core";

interface Props {
  workoutExerciseId: string;
  userId: string;
}

export default function TrainingScreen({ workoutExerciseId, userId }: Props) {
  const workoutExercises = useWorkoutStore((s) => s.exercises);
  const sets = useWorkoutStore((s) => s.sets);
  const createSet = useWorkoutStore((s) => s.createSet);
  const updateSet = useWorkoutStore((s) => s.updateSet);
  const deleteSet = useWorkoutStore((s) => s.deleteSet);
  const markSetComplete = useWorkoutStore((s) => s.markSetComplete);
  const exercises = useExerciseStore((s) => s.exercises);
  const [saving, setSaving] = useState(false);

  const client = createBrowserClient();
  const repo = createWorkoutRepository(client);

  const workoutExercise = workoutExercises.find((we) => we.id === workoutExerciseId);
  const exercise = exercises.find((e) => e.id === workoutExercise?.exercise_id);
  const exerciseSets = (workoutExercise ? sets[workoutExercise.id] ?? [] : []).slice().sort((a, b) => a.order_index - b.order_index);

  if (!workoutExercise || !exercise) return null;

  const exerciseType = exercise.type as ExerciseType;

  async function handleCreateSet() {
    if (!workoutExercise) return;
    setSaving(true);
    const { data, error } = await repo.createSet({
      workout_exercise_id: workoutExercise.id,
      order_index: exerciseSets.length,
    }, userId);
    if (!error && data) {
      createSet(workoutExercise.id, {
        id: data.id, workout_exercise_id: data.workout_exercise_id,
        is_complete: data.is_complete, order_index: data.order_index,
      });
    }
    setSaving(false);
  }

  async function handleUpdateSet(setId: string, patch: Partial<FitSet>) {
    if (!workoutExercise) return;
    await repo.updateSet(setId, patch);
    updateSet(workoutExercise.id, setId, patch);
  }

  async function handleDeleteSet(setId: string) {
    if (!workoutExercise) return;
    await repo.deleteSet(setId);
    deleteSet(workoutExercise.id, setId);
  }

  async function handleToggleComplete(setId: string, current: boolean) {
    if (!workoutExercise) return;
    await repo.updateSet(setId, { is_complete: !current });
    markSetComplete(workoutExercise.id, setId, !current);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-base">{exercise.name}</h2>
        <span className="text-xs text-muted-foreground rounded-full border px-2 py-0.5">
          {exerciseType.replace(/_/g, " ").toLowerCase()}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {exerciseSets.filter((s) => s.is_complete).length}/{exerciseSets.length} completadas
        </span>
      </div>

      {exerciseSets.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin series todavía.</p>
      ) : (
        <div className="space-y-1.5">
          {exerciseSets.map((s) => (
            <SetRow
              key={s.id}
              set={s}
              exerciseType={exerciseType}
              onUpdate={handleUpdateSet}
              onDelete={handleDeleteSet}
              onToggleComplete={handleToggleComplete}
            />
          ))}
        </div>
      )}

      <button
        onClick={handleCreateSet}
        disabled={saving}
        className="w-full rounded-lg border border-dashed py-2 text-sm text-muted-foreground hover:bg-secondary/50 disabled:opacity-50"
      >
        {saving ? "Agregando…" : "+ Agregar serie"}
      </button>
    </div>
  );
}
