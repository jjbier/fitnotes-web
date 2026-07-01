"use client";

import { useEffect, useState } from "react";
import { useWorkoutStore, useExerciseStore } from "@fitnotes/core";
import { createBrowserClient, createWorkoutRepository, createProgressRepository } from "@fitnotes/database";
import SetRow from "./SetRow";
import SetCommentModal from "./SetCommentModal";
import type { ExerciseType, Set as FitSet } from "@fitnotes/core";
import { readBool, SETTING_KEYS, readDefaultWeightIncrement } from "@/lib/settings";

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
  const [networkError, setNetworkError] = useState(false);
  const [commentSetId, setCommentSetId] = useState<string | null>(null);

  const [prMap, setPrMap] = useState<Record<number, number>>({});
  const [trackPRs, setTrackPRs] = useState(true);
  const [autoComplete, setAutoComplete] = useState(false);
  const [autoNextSet, setAutoNextSet] = useState(false);

  const client = createBrowserClient();
  const repo = createWorkoutRepository(client);
  const progressRepo = createProgressRepository(client);

  const workoutExercise = workoutExercises.find((we) => we.id === workoutExerciseId);
  const exercise = exercises.find((e) => e.id === workoutExercise?.exercise_id);
  const exerciseSets = (workoutExercise ? sets[workoutExercise.id] ?? [] : []).slice().sort((a, b) => a.order_index - b.order_index);

  useEffect(() => {
    setTrackPRs(readBool(SETTING_KEYS.TRACK_PRS, true));
    setAutoComplete(readBool(SETTING_KEYS.AUTO_COMPLETE, false));
    setAutoNextSet(readBool(SETTING_KEYS.AUTO_NEXT_SET, false));
    async function loadPRs() {
      if (!exercise) return;
      const { data } = await progressRepo.getPersonalRecords(exercise.id);
      if (!data) return;
      const map: Record<number, number> = {};
      for (const r of data) {
        if (map[r.reps] == null || r.weight > map[r.reps]!) map[r.reps] = r.weight;
      }
      setPrMap(map);
    }
    loadPRs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);

  if (!workoutExercise || !exercise) return null;

  const exerciseType = exercise.type as ExerciseType;

  function isSetPR(s: FitSet): boolean {
    if (!s.is_complete || s.weight == null || s.reps == null) return false;
    const best = prMap[s.reps];
    return best != null && s.weight >= best;
  }

  function showNetworkError() {
    setNetworkError(true);
    setTimeout(() => setNetworkError(false), 3000);
  }

  async function handleCreateSet() {
    if (!workoutExercise) return;
    const tempId = `temp-${Date.now()}`;
    const newOrder = exerciseSets.length;

    // Auto-complete: optimistically mark last incomplete set before adding new one
    if (autoComplete) {
      const lastIncomplete = [...exerciseSets].reverse().find((s) => !s.is_complete);
      if (lastIncomplete) {
        markSetComplete(workoutExercise.id, lastIncomplete.id, true);
        repo.updateSet(lastIncomplete.id, { is_complete: true }).then(({ error }) => {
          if (error) markSetComplete(workoutExercise.id, lastIncomplete.id, false);
        });
      }
    }

    // Add temp set immediately
    createSet(workoutExercise.id, {
      id: tempId,
      workout_exercise_id: workoutExercise.id,
      is_complete: false,
      is_warmup: false,
      order_index: newOrder,
    });

    const { data, error } = await repo.createSet({
      workout_exercise_id: workoutExercise.id,
      order_index: newOrder,
    }, userId);

    deleteSet(workoutExercise.id, tempId);
    if (!error && data) {
      createSet(workoutExercise.id, {
        id: data.id, workout_exercise_id: data.workout_exercise_id,
        is_complete: data.is_complete, order_index: data.order_index,
      });
    } else if (error) {
      showNetworkError();
    }
  }

  async function handleUpdateSet(setId: string, patch: Partial<FitSet>) {
    if (!workoutExercise) return;
    const old = exerciseSets.find((s) => s.id === setId);
    updateSet(workoutExercise.id, setId, patch);
    const { error } = await repo.updateSet(setId, patch as Parameters<typeof repo.updateSet>[1]);
    if (error) {
      if (old) {
        const rollback = Object.fromEntries(
          Object.keys(patch).map((k) => [k, old[k as keyof FitSet]])
        ) as Partial<FitSet>;
        updateSet(workoutExercise.id, setId, rollback);
      }
      showNetworkError();
    }
  }

  async function handleDeleteSet(setId: string) {
    if (!workoutExercise) return;
    const saved = exerciseSets.find((s) => s.id === setId);
    deleteSet(workoutExercise.id, setId);
    const { error } = await repo.deleteSet(setId);
    if (error) {
      if (saved) createSet(workoutExercise.id, saved);
      showNetworkError();
    }
  }

  async function handleSaveComment(setId: string, comment: string) {
    if (!workoutExercise) return;
    const old = exerciseSets.find((s) => s.id === setId)?.comment;
    const patch = { comment: comment || undefined };
    updateSet(workoutExercise.id, setId, patch);
    const { error } = await repo.updateSet(setId, patch);
    if (error) {
      updateSet(workoutExercise.id, setId, { comment: old });
      showNetworkError();
    }
  }

  async function handleToggleComplete(setId: string, current: boolean) {
    if (!workoutExercise) return;
    const next = !current;
    markSetComplete(workoutExercise.id, setId, next);
    const { error } = await repo.updateSet(setId, { is_complete: next });
    if (error) {
      markSetComplete(workoutExercise.id, setId, current);
      showNetworkError();
      return;
    }
    if (next && autoNextSet) {
      const currentIdx = exerciseSets.findIndex((s) => s.id === setId);
      const nextSet = exerciseSets.slice(currentIdx + 1).find((s) => !s.is_complete);
      if (nextSet) {
        document.getElementById(`set-row-${nextSet.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
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

      {networkError && (
        <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-1.5" role="alert">
          Error de red — cambio no guardado
        </p>
      )}

      {exerciseSets.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin series todavía.</p>
      ) : (
        <div className="space-y-1.5">
          {exerciseSets.map((s) => (
            <div key={s.id} id={`set-row-${s.id}`} className={s.id.startsWith("temp-") ? "opacity-60" : ""}>
              <SetRow
                set={s}
                exerciseType={exerciseType}
                onUpdate={handleUpdateSet}
                onDelete={handleDeleteSet}
                onToggleComplete={handleToggleComplete}
                onComment={setCommentSetId}
                isPR={trackPRs && isSetPR(s)}
                weightStep={exercise.weight_increment ?? readDefaultWeightIncrement()}
              />
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleCreateSet}
        className="w-full rounded-lg border border-dashed py-2 text-sm text-muted-foreground hover:bg-secondary/50"
      >
        + Agregar serie
      </button>

      {commentSetId && (
        <SetCommentModal
          initialComment={exerciseSets.find((s) => s.id === commentSetId)?.comment ?? ""}
          onSave={(comment) => handleSaveComment(commentSetId, comment)}
          onClose={() => setCommentSetId(null)}
        />
      )}
    </div>
  );
}
