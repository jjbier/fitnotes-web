"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useWorkoutStore, useExerciseStore, formatWorkoutDate, ExerciseType } from "@fitnotes/core";
import { createBrowserClient, createWorkoutRepository, createExerciseRepository } from "@fitnotes/database";
import TrainingScreen from "@/components/workout/TrainingScreen";
import NavigationPanel from "@/components/workout/NavigationPanel";
import WorkoutTimer from "@/components/workout/WorkoutTimer";
import ShareWorkoutModal from "@/components/workout/ShareWorkoutModal";
import CopyWorkoutModal from "@/components/workout/CopyWorkoutModal";
import MoveWorkoutModal from "@/components/workout/MoveWorkoutModal";
import { useWakeLock } from "@/hooks/useWakeLock";
import { readBool, SETTING_KEYS } from "@/lib/settings";
import { autoBackupToDriveIfEnabled } from "@/lib/driveBackup";

interface WorkoutDatePageProps {
  params: Promise<{ date: string }>;
}

export default function WorkoutDatePage({ params }: WorkoutDatePageProps) {
  const { date } = use(params);

  const activeWorkout = useWorkoutStore((s) => s.activeWorkout);
  const workoutExercises = useWorkoutStore((s) => s.exercises);
  const sets = useWorkoutStore((s) => s.sets);
  const isLoading = useWorkoutStore((s) => s.isLoading);
  const loadWorkout = useWorkoutStore((s) => s.loadWorkout);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const addExerciseToWorkout = useWorkoutStore((s) => s.addExerciseToWorkout);
  const reorderExercisesStore = useWorkoutStore((s) => s.reorderExercises);
  const finishWorkout = useWorkoutStore((s) => s.finishWorkout);
  const setLoading = useWorkoutStore((s) => s.setLoading);

  const exercises = useExerciseStore((s) => s.exercises);
  const loadExercises = useExerciseStore((s) => s.loadExercises);

  const [userId, setUserId] = useState("");
  const [activeWEId, setActiveWEId] = useState<string | null>(null);
  const [showExPicker, setShowExPicker] = useState(false);
  const [selectedExId, setSelectedExId] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [keepScreenOn, setKeepScreenOn] = useState(false);
  useWakeLock(keepScreenOn && !!activeWorkout);

  const client = createBrowserClient();
  const repo = createWorkoutRepository(client);
  const exRepo = createExerciseRepository(client);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await client.auth.getUser();
      if (user) setUserId(user.id);

      const [catRes, exRes, workoutRes] = await Promise.all([
        exRepo.getCategories(),
        exRepo.getExercises(),
        repo.getWorkoutByDate(date),
      ]);

      if (catRes.data && exRes.data) {
        loadExercises(catRes.data, exRes.data.map((ex) => ({
          id: ex.id, name: ex.name,
          category_id: ex.category_id ?? "",
          type: ex.type as ExerciseType,
          weight_unit: ex.weight_unit as "kg" | "lb",
          notes: ex.notes ?? undefined,
          is_favorite: ex.is_favorite,
          created_at: ex.created_at,
        })));
      }

      const workout = workoutRes.data;
      if (workout) {
        const { data: wExercises } = await repo.getWorkoutExercises(workout.id);
        const setsMap: Record<string, Parameters<typeof loadWorkout>[2][string]> = {};
        for (const we of wExercises ?? []) {
          const { data: wSets } = await repo.getSets(we.id);
          setsMap[we.id] = (wSets ?? []).map((s) => ({
            id: s.id, workout_exercise_id: s.workout_exercise_id,
            weight: s.weight ?? undefined, reps: s.reps ?? undefined,
            distance: s.distance ?? undefined, time_seconds: s.time_seconds ?? undefined,
            is_complete: s.is_complete, is_warmup: s.is_warmup ?? false,
            comment: s.comment ?? undefined, order_index: s.order_index,
          }));
        }
        loadWorkout(
          {
            id: workout.id, date: workout.date,
            comment: workout.comment ?? undefined,
            start_time: workout.start_time ?? undefined,
            end_time: workout.end_time ?? undefined,
            duration_minutes: workout.duration_minutes ?? undefined,
          },
          (wExercises ?? []).map((we) => ({
            id: we.id, workout_id: we.workout_id, exercise_id: we.exercise_id,
            order_index: we.order_index, group_id: we.group_id ?? undefined,
          })),
          setsMap
        );
        if ((wExercises ?? []).length > 0) setActiveWEId(wExercises![0]!.id);
      }
      setKeepScreenOn(readBool(SETTING_KEYS.KEEP_SCREEN_ON, false));
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function handleStartWorkout() {
    const { data, error } = await repo.createWorkout(
      { date, start_time: new Date().toISOString() },
      userId
    );
    if (error || !data) return;
    startWorkout(date);
    loadWorkout({ id: data.id, date: data.date, start_time: data.start_time ?? undefined }, [], {});
  }

  async function handleAddExercise() {
    if (!selectedExId || !activeWorkout) return;
    const { data, error } = await repo.addExercise({
      workout_id: activeWorkout.id,
      exercise_id: selectedExId,
      order_index: workoutExercises.length,
    }, userId);
    if (error || !data) return;
    addExerciseToWorkout(selectedExId);
    setActiveWEId(data.id);
    setSelectedExId("");
    setShowExPicker(false);
  }

  async function handleReorderExercises(orderedIds: string[]) {
    reorderExercisesStore(orderedIds);
    const updates = orderedIds.map((id, i) => ({ id, order_index: i }));
    await repo.reorderExercises(updates);
  }

  async function handleFinish() {
    if (!activeWorkout) return;
    await repo.updateWorkout(activeWorkout.id, { end_time: new Date().toISOString() });
    finishWorkout();
    setActiveWEId(null);
    autoBackupToDriveIfEnabled();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/calendar"
          aria-label="Volver al calendario"
          className="rounded-md border px-2 py-1 text-sm hover:bg-secondary"
        >
          <span aria-hidden="true">←</span>
        </Link>
        <div className="flex-1">
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Entrenamiento</h1>
            {activeWorkout && <WorkoutTimer startTime={activeWorkout.start_time} />}
          </div>
          <p className="text-sm text-muted-foreground">{formatWorkoutDate(date)}</p>
        </div>
        {activeWorkout && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowShare(true)}
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-secondary"
            >
              Compartir
            </button>
            <button
              onClick={() => setShowCopy(true)}
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-secondary"
            >
              Copiar de…
            </button>
            <button
              onClick={() => setShowMove(true)}
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-secondary"
            >
              Mover a…
            </button>
            <button
              onClick={handleFinish}
              className="rounded-md border border-destructive px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              Finalizar
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg border bg-secondary/30 animate-pulse" />
          ))}
        </div>
      ) : !activeWorkout ? (
        <div className="rounded-lg border bg-card p-10 text-center space-y-4">
          <p className="text-muted-foreground text-sm">Sin entrenamiento para este día.</p>
          <button
            onClick={handleStartWorkout}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Iniciar entrenamiento
          </button>
        </div>
      ) : (
        <div className="flex gap-5 items-start">
          {/* NavigationPanel — sidebar */}
          <aside className="w-52 shrink-0 rounded-lg border bg-card p-3 sticky top-4 hidden md:block">
            <NavigationPanel
              workoutExercises={workoutExercises}
              exercises={exercises}
              sets={sets}
              activeExerciseId={activeWEId}
              onSelectExercise={setActiveWEId}
              onAddExercise={() => setShowExPicker((v) => !v)}
              onReorderExercises={handleReorderExercises}
            />
          </aside>

          {/* Main content */}
          <div className="flex-1 space-y-4 min-w-0">
            {/* Mobile: exercise tabs (same pattern as dashboard) */}
            <div className="flex gap-2 flex-wrap md:hidden">
              {workoutExercises.map((we) => {
                const ex = exercises.find((e) => e.id === we.exercise_id);
                return (
                  <button
                    key={we.id}
                    onClick={() => setActiveWEId(we.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      activeWEId === we.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-secondary"
                    }`}
                  >
                    {ex?.name ?? we.exercise_id}
                  </button>
                );
              })}
              <button
                onClick={() => setShowExPicker((v) => !v)}
                className="rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground hover:bg-secondary"
              >
                + Ejercicio
              </button>
            </div>

            {/* Exercise picker */}
            {showExPicker && (
              <div className="flex gap-2">
                <select
                  value={selectedExId}
                  onChange={(e) => setSelectedExId(e.target.value)}
                  aria-label="Seleccionar ejercicio"
                  className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Seleccionar ejercicio…</option>
                  {exercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleAddExercise}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Añadir
                </button>
                <button
                  onClick={() => { setShowExPicker(false); setSelectedExId(""); }}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-secondary"
                >
                  Cancelar
                </button>
              </div>
            )}

            {/* TrainingScreen */}
            {activeWEId ? (
              <div className="rounded-lg border bg-card p-4">
                <TrainingScreen workoutExerciseId={activeWEId} userId={userId} />
              </div>
            ) : (
              <div className="rounded-lg border bg-card p-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Selecciona un ejercicio para ver sus series.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {showShare && activeWorkout && (
        <ShareWorkoutModal
          date={date}
          workoutExercises={workoutExercises}
          exercises={exercises}
          sets={sets}
          onClose={() => setShowShare(false)}
        />
      )}

      {showCopy && activeWorkout && (
        <CopyWorkoutModal
          currentWorkout={activeWorkout}
          currentExercises={workoutExercises}
          userId={userId}
          onCopied={async () => {
            const { data: workout } = await repo.getWorkoutByDate(date);
            if (!workout) return;
            const { data: wExercises } = await repo.getWorkoutExercises(workout.id);
            const setsMap: Record<string, Parameters<typeof loadWorkout>[2][string]> = {};
            for (const we of wExercises ?? []) {
              const { data: wSets } = await repo.getSets(we.id);
              setsMap[we.id] = (wSets ?? []).map((s) => ({
                id: s.id, workout_exercise_id: s.workout_exercise_id,
                weight: s.weight ?? undefined, reps: s.reps ?? undefined,
                distance: s.distance ?? undefined, time_seconds: s.time_seconds ?? undefined,
                is_complete: s.is_complete, is_warmup: s.is_warmup ?? false,
                comment: s.comment ?? undefined, order_index: s.order_index,
              }));
            }
            loadWorkout(
              { id: workout.id, date: workout.date, comment: workout.comment ?? undefined, start_time: workout.start_time ?? undefined, end_time: workout.end_time ?? undefined, duration_minutes: workout.duration_minutes ?? undefined },
              (wExercises ?? []).map((we) => ({ id: we.id, workout_id: we.workout_id, exercise_id: we.exercise_id, order_index: we.order_index, group_id: we.group_id ?? undefined })),
              setsMap
            );
            if ((wExercises ?? []).length > 0) setActiveWEId(wExercises![0]!.id);
          }}
          onClose={() => setShowCopy(false)}
        />
      )}

      {showMove && activeWorkout && (
        <MoveWorkoutModal
          workoutId={activeWorkout.id}
          currentDate={date}
          onMoved={(newDate) => {
            window.location.href = `/workout/${newDate}`;
          }}
          onClose={() => setShowMove(false)}
        />
      )}
    </div>
  );
}
