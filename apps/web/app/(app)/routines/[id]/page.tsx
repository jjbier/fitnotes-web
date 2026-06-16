/**
 * Routine detail and editor
 *
 * Components: RoutineDayEditor (local stub), ExercisePicker (local stub)
 * Stores: useRoutineStore (routineDays, routineDayExercises), useExerciseStore (exercises)
 * Actions: updateRoutine, addRoutineDay, addExerciseToDay, deleteRoutineDay
 * Params: id — routine UUID
 */

interface RoutineDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RoutineDetailPage({ params }: RoutineDetailPageProps) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {/* TODO: load routine name from useRoutineStore */}
        <h1 className="text-3xl font-bold tracking-tight">Routine Detail</h1>
        <div className="flex gap-2">
          <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">
            Rename
          </button>
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            + Add Day
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground font-mono">{id}</p>

      {/* TODO: render routine days from useRoutineStore.routineDays */}
      {["Day A — Push", "Day B — Pull", "Day C — Legs"].map((day) => (
        <div key={day} className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{day}</h2>
            <button className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
          </div>
          <p className="text-sm text-muted-foreground">No exercises added yet.</p>
          <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">
            + Add Exercise
          </button>
        </div>
      ))}
    </div>
  );
}
