/**
 * Progress graphs, personal records, and stats
 *
 * Components: ProgressChart, PersonalRecords
 * Stores: useProgressStore (personalRecords), useExerciseStore (exercises)
 * Utils: calculate1RM, calculateVolume from @fitnotes/core
 * Data: loads all PRs from Supabase
 */

export default function ProgressPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Progress</h1>

      {/* Volume over time chart */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-4">Weekly Volume</h2>
        <div className="h-56 flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-md">
          {/* TODO: render ProgressChart with weekly volume data from useProgressStore */}
          Volume chart placeholder
        </div>
      </div>

      {/* Personal records */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Personal Records</h2>
          <span className="text-xs text-muted-foreground">All time</span>
        </div>
        {/* TODO: render PersonalRecords component from useProgressStore.personalRecords */}
        <div className="space-y-2">
          {["Bench Press — 100 kg × 5", "Squat — 140 kg × 3", "Deadlift — 180 kg × 1"].map(
            (pr) => (
              <div
                key={pr}
                className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2 text-sm"
              >
                <span>{pr}</span>
                <span className="text-xs text-muted-foreground">Placeholder</span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Workouts", value: "—" },
          { label: "This Week", value: "—" },
          { label: "Streak", value: "—" },
          { label: "Total Volume", value: "—" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border bg-card p-4 text-center">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
