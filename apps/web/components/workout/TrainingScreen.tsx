/**
 * TrainingScreen
 *
 * TODO:
 *  - Render active exercise name + category
 *  - Show set history for this session (SetList)
 *  - Provide quick-add set form (SetForm)
 *  - Navigation arrows between exercises (NavigationPanel)
 *  - Finish workout button that calls useWorkoutStore.finishWorkout()
 */

import type { WorkoutExercise, Set, Exercise } from "@fitnotes/core";

interface TrainingScreenProps {
  workoutExercise: WorkoutExercise;
  exercise: Exercise;
  sets: Set[];
  onAddSet: (partial: Partial<Set>) => void;
  onUpdateSet: (setId: string, patch: Partial<Set>) => void;
  onDeleteSet: (setId: string) => void;
  onFinish: () => void;
}

export default function TrainingScreen({
  exercise,
  sets,
  onAddSet,
  onFinish,
}: TrainingScreenProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{exercise.name}</h2>
        <button
          onClick={onFinish}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Finish
        </button>
      </div>

      {/* TODO: render SetList */}
      <div className="rounded-md border divide-y">
        {sets.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground text-center">
            No sets yet. Add your first set below.
          </p>
        ) : (
          sets.map((set, idx) => (
            <div key={set.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="w-6 text-muted-foreground">{idx + 1}</span>
              <span>{set.weight ?? "—"} kg</span>
              <span>×</span>
              <span>{set.reps ?? "—"} reps</span>
              <span
                className={`ml-auto text-xs font-medium ${
                  set.is_complete ? "text-green-600" : "text-muted-foreground"
                }`}
              >
                {set.is_complete ? "✓" : "○"}
              </span>
            </div>
          ))
        )}
      </div>

      {/* TODO: replace with SetForm component */}
      <button
        onClick={() => onAddSet({ weight: undefined, reps: undefined })}
        className="w-full rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground hover:bg-secondary"
      >
        + Add Set
      </button>
    </div>
  );
}
