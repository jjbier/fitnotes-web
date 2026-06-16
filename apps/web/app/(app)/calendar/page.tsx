/**
 * Calendar view — month grid + workout list
 *
 * Components: CalendarGrid (local stub), WorkoutListItem (local stub)
 * Stores: useWorkoutStore (workouts by date range)
 * Utils: groupWorkoutsByMonth, getWeekRange from @fitnotes/core
 * Data: loads workouts for visible month range from Supabase
 */

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
        <div className="flex gap-2">
          <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">
            ← Prev
          </button>
          <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">
            Today
          </button>
          <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">
            Next →
          </button>
        </div>
      </div>

      {/* TODO: replace with real calendar grid using useWorkoutStore */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-4">June 2026</h2>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="text-xs font-medium text-muted-foreground py-2">
              {d}
            </div>
          ))}
          {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => (
            <div
              key={day}
              className="aspect-square flex items-center justify-center rounded-md text-sm hover:bg-secondary cursor-pointer"
            >
              {day}
            </div>
          ))}
        </div>
      </div>

      {/* TODO: render workout list for selected month using groupWorkoutsByMonth */}
      <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground text-sm">
        Select a date to view workout details.
      </div>
    </div>
  );
}
