/**
 * Workout detail for a specific date
 *
 * Components: TrainingScreen, SetList, SetForm, NavigationPanel
 * Stores: useWorkoutStore (activeWorkout, exercises, sets)
 * Params: date — ISO date string YYYY-MM-DD
 * Data: loads workout for date from Supabase, falls back to empty state
 */

import { formatWorkoutDate } from "@fitnotes/core";

interface WorkoutDatePageProps {
  params: Promise<{ date: string }>;
}

export default async function WorkoutDatePage({ params }: WorkoutDatePageProps) {
  const { date } = await params;
  const displayDate = formatWorkoutDate(date);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workout</h1>
        <p className="text-muted-foreground">{displayDate}</p>
      </div>

      {/* TODO: load workout data for this date */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">No exercises logged yet</span>
          <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">
            Add Exercise
          </button>
        </div>
      </div>

      {/* TODO: render TrainingScreen component with exercises and sets */}
    </div>
  );
}
