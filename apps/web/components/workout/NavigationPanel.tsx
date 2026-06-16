/**
 * NavigationPanel — Exercise navigation drawer
 *
 * TODO:
 *  - List all exercises in the current workout session
 *  - Highlight the active exercise
 *  - Click to jump to an exercise (calls useWorkoutStore.setActiveExercise)
 *  - Show set count + completion status per exercise
 *  - Button to add another exercise to the session
 *  - Drag-to-reorder (calls useWorkoutStore.reorderExercises)
 */

import type { WorkoutExercise, Exercise, Set } from "@fitnotes/core";

interface NavigationPanelProps {
  workoutExercises: WorkoutExercise[];
  exercises: Exercise[];
  sets: Record<string, Set[]>;
  activeExerciseId: string | null;
  onSelectExercise: (workoutExerciseId: string) => void;
  onAddExercise: () => void;
}

export default function NavigationPanel({
  workoutExercises,
  exercises,
  sets,
  activeExerciseId,
  onSelectExercise,
  onAddExercise,
}: NavigationPanelProps) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1 mb-2">
        Exercises
      </h3>

      {workoutExercises.map((we) => {
        const exercise = exercises.find((e) => e.id === we.exercise_id);
        const exerciseSets = sets[we.id] ?? [];
        const completedSets = exerciseSets.filter((s) => s.is_complete).length;
        const isActive = activeExerciseId === we.id;

        return (
          <button
            key={we.id}
            onClick={() => onSelectExercise(we.id)}
            className={`flex items-center justify-between rounded-md px-3 py-2 text-sm text-left transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "hover:bg-secondary"
            }`}
          >
            <span className="truncate">{exercise?.name ?? "Unknown"}</span>
            <span
              className={`ml-2 text-xs shrink-0 ${
                isActive ? "text-primary-foreground/70" : "text-muted-foreground"
              }`}
            >
              {completedSets}/{exerciseSets.length}
            </span>
          </button>
        );
      })}

      <button
        onClick={onAddExercise}
        className="mt-2 flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
      >
        <span>+</span>
        Add exercise
      </button>
    </div>
  );
}
