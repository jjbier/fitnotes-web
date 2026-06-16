/**
 * Dashboard — Today's workout (Home Screen)
 *
 * Components: TrainingScreen, SetList, NavigationPanel
 * Stores: useWorkoutStore (activeWorkout, exercises, sets), useExerciseStore (exercises)
 * Data: loads today's workout from Supabase on mount
 */

import { formatWorkoutDate, todayISO } from "@fitnotes/core";

export default function DashboardPage() {
  const today = todayISO();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Today&apos;s Workout</h1>
        <p className="text-muted-foreground">{formatWorkoutDate(today)}</p>
      </div>

      {/* TODO: render TrainingScreen when activeWorkout is set */}
      <div className="rounded-lg border bg-card p-8 text-center space-y-4">
        <p className="text-muted-foreground">No workout started yet.</p>
        <button className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Start Workout
        </button>
      </div>

      {/* TODO: recent workouts section */}
      <section>
        <h2 className="text-xl font-semibold mb-3">Recent Activity</h2>
        <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground text-sm">
          Your recent workouts will appear here.
        </div>
      </section>
    </div>
  );
}
