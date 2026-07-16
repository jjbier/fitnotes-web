"use client";

import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { ChevronLeft, Share2, CalendarDays, CheckSquare, Dumbbell, Clock } from "lucide-react";
import { useWorkoutStore, useExerciseStore, formatWorkoutDate, ExerciseType } from "@fitnotes/core";
import { createBrowserClient, createWorkoutRepository, createExerciseRepository } from "@fitnotes/database";
import TrainingScreen from "@/components/workout/TrainingScreen";
import NavigationPanel from "@/components/workout/NavigationPanel";
import WorkoutTimer from "@/components/workout/WorkoutTimer";
import FinishSummaryModal from "@/components/workout/FinishSummaryModal";
import ShareWorkoutModal from "@/components/workout/ShareWorkoutModal";
import CopyWorkoutModal from "@/components/workout/CopyWorkoutModal";
import MoveWorkoutModal from "@/components/workout/MoveWorkoutModal";
import EmptyState from "@/components/EmptyState";
import { useConfirm } from "@/components/ConfirmDialog";
import { useWakeLock } from "@/hooks/useWakeLock";
import { readBool, SETTING_KEYS } from "@/lib/settings";
import { autoBackupToDriveIfEnabled } from "@/lib/driveBackup";

interface WorkoutDatePageProps {
  params: Promise<{ date: string }>;
}

/**
 * Página de entrenamiento para una fecha arbitraria (`/workout/[date]`): mismo patrón
 * que el dashboard ("Hoy") pero con layout de dos columnas (panel lateral de
 * navegación en desktop, lista apilada en móvil) y navegación de vuelta al calendario
 * en vez de la franja semanal.
 *
 * Al montar carga categorías/ejercicios y el entrenamiento de `date` (con sus
 * ejercicios y series). Soporta iniciar/finalizar entrenamiento con cronómetro
 * pausable, añadir/eliminar ejercicios, reordenarlos por drag&drop, selección
 * múltiple para borrado en lote, y los modales de compartir/copiar/mover
 * entrenamiento (mover navega a la nueva fecha con `window.location.href`, a
 * diferencia del dashboard que actualiza el estado local).
 */
export default function WorkoutDatePage({ params }: WorkoutDatePageProps) {
  const { date } = use(params);

  const activeWorkout = useWorkoutStore((s) => s.activeWorkout);
  const workoutExercises = useWorkoutStore((s) => s.exercises);
  const sets = useWorkoutStore((s) => s.sets);
  const isLoading = useWorkoutStore((s) => s.isLoading);
  const loadWorkout = useWorkoutStore((s) => s.loadWorkout);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const addExerciseToWorkout = useWorkoutStore((s) => s.addExerciseToWorkout);
  const removeExerciseFromWorkout = useWorkoutStore((s) => s.removeExerciseFromWorkout);
  const reorderExercisesStore = useWorkoutStore((s) => s.reorderExercises);
  const finishWorkout = useWorkoutStore((s) => s.finishWorkout);
  const setLoading = useWorkoutStore((s) => s.setLoading);

  const exercises = useExerciseStore((s) => s.exercises);
  const loadExercises = useExerciseStore((s) => s.loadExercises);

  const confirmDelete = useConfirm();

  const [userId, setUserId] = useState("");
  const [activeWEId, setActiveWEId] = useState<string | null>(null);
  const [showExPicker, setShowExPicker] = useState(false);
  const [selectedExId, setSelectedExId] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [keepScreenOn, setKeepScreenOn] = useState(false);
  useWakeLock(keepScreenOn && !!activeWorkout);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [summaryStats, setSummaryStats] = useState<{ duration: number; exercises: number; sets: number; volume: number } | null>(null);
  const elapsedRef = useRef(0);

  const client = createBrowserClient();
  const repo = createWorkoutRepository(client);
  const exRepo = createExerciseRepository(client);

  useEffect(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, [activeWorkout?.id]);

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
      } else {
        // Sin esto, navegar aquí desde otra página con un workout ya cargado
        // en el store deja visible ese workout stale bajo esta fecha.
        loadWorkout({ id: "", date }, [], {});
        setActiveWEId(null);
      }
      setKeepScreenOn(readBool(SETTING_KEYS.KEEP_SCREEN_ON, false));
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  /**
   * userId se resuelve async al montar; si el usuario actúa antes de que
   * termine esa llamada, hay que esperar a que resuelva en vez de insertar con "".
   */
  async function resolveUserId(): Promise<string> {
    if (userId) return userId;
    const { data: { user } } = await client.auth.getUser();
    if (user) setUserId(user.id);
    return user?.id ?? "";
  }

  async function handleStartWorkout() {
    const uid = await resolveUserId();
    const { data, error } = await repo.createWorkout(
      { date, start_time: new Date().toISOString() },
      uid
    );
    if (error || !data) return;
    startWorkout(date);
    loadWorkout({ id: data.id, date: data.date, start_time: data.start_time ?? undefined }, [], {});
  }

  async function handleAddExercise() {
    if (!selectedExId || !activeWorkout || activeWorkout.end_time) return;
    const uid = await resolveUserId();
    const { data, error } = await repo.addExercise({
      workout_id: activeWorkout.id,
      exercise_id: selectedExId,
      order_index: workoutExercises.length,
    }, uid);
    if (error || !data) return;
    addExerciseToWorkout(selectedExId, data.id);
    setActiveWEId(data.id);
    setSelectedExId("");
    setShowExPicker(false);
  }

  /**
   * Aplica el nuevo orden (drag&drop en `NavigationPanel`) al store de forma
   * optimista y persiste los `order_index` recalculados en segundo plano.
   */
  async function handleReorderExercises(orderedIds: string[]) {
    reorderExercisesStore(orderedIds);
    const updates = orderedIds.map((id, i) => ({ id, order_index: i }));
    await repo.reorderExercises(updates);
  }

  async function handleDeleteExercise(workoutExerciseId: string, exerciseName: string) {
    if (!(await confirmDelete({ message: `¿Eliminar "${exerciseName}"? Se eliminarán también todas sus series.` }))) return;
    removeExerciseFromWorkout(workoutExerciseId);
    if (activeWEId === workoutExerciseId) setActiveWEId(null);
    await repo.removeExercise(workoutExerciseId);
  }

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /** Elimina en lote (tras confirmar) los ejercicios marcados en el modo selección múltiple. */
  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    if (!(await confirmDelete({ message: `¿Eliminar ${selectedIds.size} ejercicio(s)? Se eliminarán también todas sus series.` }))) return;
    for (const id of selectedIds) {
      removeExerciseFromWorkout(id);
      await repo.removeExercise(id);
    }
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  /**
   * Finaliza el entrenamiento activo: calcula series completadas (sin
   * calentamiento) y volumen total (peso × reps) a partir de las series en el
   * store, persiste `end_time`/`duration_minutes`, muestra el resumen final y
   * dispara el backup automático a Drive si está habilitado.
   */
  async function handleFinish() {
    if (!activeWorkout) return;
    const allSets = Object.values(sets).flat();
    const totalSets = allSets.filter((s) => s.is_complete && !s.is_warmup).length;
    const totalVolume = allSets.filter((s) => !s.is_warmup).reduce((acc, s) => acc + (s.weight && s.reps ? s.weight * s.reps : 0), 0);
    await repo.updateWorkout(activeWorkout.id, { end_time: new Date().toISOString(), duration_minutes: Math.round(elapsedRef.current / 60) });
    setSummaryStats({ duration: elapsedRef.current, exercises: workoutExercises.length, sets: totalSets, volume: totalVolume });
    finishWorkout();
    setActiveWEId(null);
    setShowExPicker(false);
    setSelectedExId("");
    autoBackupToDriveIfEnabled();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/calendar"
          aria-label="Volver al calendario"
          className="rounded-xl border px-2 py-1 text-sm hover:bg-secondary"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Entrenamiento</h1>
          <p className="text-sm text-muted-foreground">{formatWorkoutDate(date)}</p>
        </div>
        {activeWorkout && activeWorkout.id && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowShare(true)}
              className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium hover:bg-secondary"
            >
              <Share2 size={14} aria-hidden="true" /> Compartir
            </button>
            {!activeWorkout.end_time && (
              <button
                onClick={() => setShowCopy(true)}
                className="rounded-xl border px-3 py-1.5 text-sm font-medium hover:bg-secondary"
              >
                Copiar de…
              </button>
            )}
            <button
              onClick={() => setShowMove(true)}
              className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium hover:bg-secondary"
            >
              <CalendarDays size={14} aria-hidden="true" /> Mover
            </button>
            {workoutExercises.length > 0 && (
              <button
                onClick={toggleSelectMode}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium ${selectMode ? "border-primary text-primary" : "hover:bg-secondary"}`}
                aria-pressed={selectMode}
              >
                <CheckSquare size={14} aria-hidden="true" /> {selectMode ? "Cancelar" : "Seleccionar"}
              </button>
            )}
            {!activeWorkout.end_time && (
              <button
                onClick={handleFinish}
                className="rounded-xl border border-destructive px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                Finalizar
              </button>
            )}
            {!activeWorkout.end_time ? (
              <WorkoutTimer startTime={activeWorkout.start_time} onElapsedChange={(s) => { elapsedRef.current = s; }} />
            ) : (
              <span className="inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-1.5">
                <Clock size={16} className="text-primary" aria-hidden="true" />
                <span className="font-mono text-sm font-semibold tabular-nums text-primary">
                  {activeWorkout.duration_minutes != null ? `${activeWorkout.duration_minutes} min` : "—"}
                </span>
                <span className="text-xs text-muted-foreground">finalizado</span>
              </span>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-2xl border bg-secondary/30 animate-pulse" />
          ))}
        </div>
      ) : !activeWorkout || !activeWorkout.id ? (
        <EmptyState
          icon={Dumbbell}
          title="Sin entrenamiento aún"
          description="Inicia un entrenamiento para registrar tus series y hacer seguimiento del progreso."
          action={{ label: "Iniciar entrenamiento", onClick: handleStartWorkout }}
        />
      ) : (
        <div className="flex gap-5 items-start">
          {/* NavigationPanel — sidebar */}
          <aside className="w-56 shrink-0 rounded-2xl border bg-card p-3 sticky top-4 hidden md:block">
            {selectMode && (
              <div className="mb-2 flex items-center justify-between rounded-xl bg-primary/10 px-2 py-1.5">
                <span className="text-xs font-medium text-primary">{selectedIds.size} sel.</span>
                <button
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.size === 0}
                  className="text-xs font-semibold text-destructive disabled:opacity-40"
                >
                  Eliminar
                </button>
              </div>
            )}
            <NavigationPanel
              workoutExercises={workoutExercises}
              exercises={exercises}
              sets={sets}
              activeExerciseId={activeWEId}
              onSelectExercise={setActiveWEId}
              onAddExercise={activeWorkout.end_time ? undefined : () => setShowExPicker((v) => !v)}
              onReorderExercises={activeWorkout.end_time ? undefined : handleReorderExercises}
              onDeleteExercise={activeWorkout.end_time ? undefined : handleDeleteExercise}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
          </aside>

          {/* Main content */}
          <div className="flex-1 space-y-4 min-w-0">
            {/* Mobile: exercise list (same pattern as sidebar) */}
            <div className="md:hidden">
              {selectMode && (
                <div className="mb-2 flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2">
                  <span className="text-sm font-medium text-primary">{selectedIds.size} seleccionado(s)</span>
                  <button
                    onClick={handleDeleteSelected}
                    disabled={selectedIds.size === 0}
                    className="text-sm font-semibold text-destructive disabled:opacity-40"
                  >
                    Eliminar seleccionados
                  </button>
                </div>
              )}
              <NavigationPanel
                workoutExercises={workoutExercises}
                exercises={exercises}
                sets={sets}
                activeExerciseId={activeWEId}
                onSelectExercise={setActiveWEId}
                onAddExercise={activeWorkout.end_time ? undefined : () => setShowExPicker((v) => !v)}
                onReorderExercises={activeWorkout.end_time ? undefined : handleReorderExercises}
                onDeleteExercise={activeWorkout.end_time ? undefined : handleDeleteExercise}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
              />
            </div>

            {/* Exercise picker */}
            {showExPicker && !activeWorkout.end_time && (
              <div className="flex gap-2">
                <select
                  value={selectedExId}
                  onChange={(e) => setSelectedExId(e.target.value)}
                  aria-label="Seleccionar ejercicio"
                  className="flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Seleccionar ejercicio…</option>
                  {exercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleAddExercise}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Añadir
                </button>
                <button
                  onClick={() => { setShowExPicker(false); setSelectedExId(""); }}
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-secondary"
                >
                  Cancelar
                </button>
              </div>
            )}

            {/* TrainingScreen */}
            {selectMode ? null : activeWEId ? (
              <div className="rounded-2xl border bg-card p-4">
                <TrainingScreen workoutExerciseId={activeWEId} userId={userId} />
              </div>
            ) : (
              <div className="rounded-2xl border bg-card p-10 text-center">
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

      {summaryStats && (
        <FinishSummaryModal stats={summaryStats} onClose={() => setSummaryStats(null)} />
      )}
    </div>
  );
}
