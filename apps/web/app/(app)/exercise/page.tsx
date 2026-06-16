/**
 * Exercise list with category filters
 *
 * Components: ExerciseCard (local stub), CategoryFilter (local stub)
 * Stores: useExerciseStore (categories, exercises, favorites)
 * Actions: loadExercises, toggleFavorite
 * Data: loads all exercises and categories from Supabase on mount
 */

export default function ExercisePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Exercises</h1>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          New Exercise
        </button>
      </div>

      {/* TODO: render category filter chips from useExerciseStore.categories */}
      <div className="flex gap-2 flex-wrap">
        {["All", "Chest", "Back", "Legs", "Shoulders", "Arms", "Core"].map((cat) => (
          <button
            key={cat}
            className="rounded-full border px-3 py-1 text-sm hover:bg-secondary data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
          >
            {cat}
          </button>
        ))}
      </div>

      {/* TODO: replace with real exercise list from useExerciseStore.exercises */}
      <div className="grid gap-3">
        {["Bench Press", "Squat", "Deadlift", "Overhead Press", "Pull-up"].map((name) => (
          <div
            key={name}
            className="flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-secondary/50"
          >
            <div>
              <p className="font-medium">{name}</p>
              <p className="text-xs text-muted-foreground">Weight × Reps</p>
            </div>
            <button className="text-muted-foreground hover:text-primary">☆</button>
          </div>
        ))}
      </div>
    </div>
  );
}
