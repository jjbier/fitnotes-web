/**
 * Routines list
 *
 * Components: RoutineCard (local stub)
 * Stores: useRoutineStore (routines)
 * Actions: createRoutine, deleteRoutine, setActiveRoutine
 * Data: loads routines from Supabase on mount
 */

export default function RoutinesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Routines</h1>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          New Routine
        </button>
      </div>

      {/* TODO: render from useRoutineStore.routines */}
      <div className="grid gap-3">
        {["Push Pull Legs", "Upper Lower", "Full Body 3x"].map((name) => (
          <div
            key={name}
            className="flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-secondary/50"
          >
            <div>
              <p className="font-medium">{name}</p>
              <p className="text-xs text-muted-foreground">3 days · Placeholder</p>
            </div>
            <div className="flex gap-2">
              <a
                href={`/routines/placeholder-id`}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
              >
                Edit
              </a>
              <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Start
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-dashed bg-card p-8 text-center text-muted-foreground text-sm">
        Create a routine to save your favourite workout templates.
      </div>
    </div>
  );
}
