/**
 * Exercise detail + training screen
 *
 * Components: TrainingScreen, SetList, SetForm, ProgressChart
 * Stores: useExerciseStore (exercise by id), useWorkoutStore (sets), useProgressStore (PRs)
 * Params: id — exercise UUID
 * Data: loads exercise data, history, and PRs from Supabase
 */

interface ExerciseDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ExerciseDetailPage({ params }: ExerciseDetailPageProps) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      {/* TODO: load exercise name from useExerciseStore.exercises */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Exercise Detail</h1>
        <p className="text-xs text-muted-foreground font-mono">{id}</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Best 1RM", value: "—" },
          { label: "Best Set", value: "—" },
          { label: "Total Volume", value: "—" },
          { label: "Sessions", value: "—" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border bg-card p-4 text-center">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* TODO: render ProgressChart with historical sets data */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-4">Progress Chart</h2>
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
          Chart placeholder — wire up ProgressChart with recharts
        </div>
      </div>

      {/* TODO: render SetList for current session */}
    </div>
  );
}
