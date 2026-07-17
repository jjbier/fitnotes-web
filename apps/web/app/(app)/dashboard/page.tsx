"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Share2, CalendarDays, CheckSquare, Dumbbell, Clock } from "lucide-react";
import { useWorkoutStore, useExerciseStore, formatWorkoutDate, todayISO, ExerciseType } from "@fitnotes/core";
import { createBrowserClient, createWorkoutRepository, createExerciseRepository } from "@fitnotes/database";
import TrainingScreen from "@/components/workout/TrainingScreen";
import NavigationPanel from "@/components/workout/NavigationPanel";
import WorkoutTimer from "@/components/workout/WorkoutTimer";
import WeekStrip from "@/components/workout/WeekStrip";
import FinishSummaryModal from "@/components/workout/FinishSummaryModal";
import ShareWorkoutModal from "@/components/workout/ShareWorkoutModal";
import CopyWorkoutModal from "@/components/workout/CopyWorkoutModal";
import MoveWorkoutModal from "@/components/workout/MoveWorkoutModal";
import EmptyState from "@/components/EmptyState";
import { useConfirm } from "@/components/ConfirmDialog";
import { useWakeLock } from "@/hooks/useWakeLock";
import { readBool, SETTING_KEYS, readHiddenCategories } from "@/lib/settings";
import { autoBackupToDriveIfEnabled } from "@/lib/driveBackup";

/**
 * Página "Hoy" (`/dashboard`): pantalla principal de entrenamiento del día actual.
 *
 * Al montar carga en paralelo categorías, ejercicios y los últimos 60 entrenamientos, y
 * resuelve el entrenamiento de la fecha seleccionada (hoy por defecto, navegable con
 * los botones de día anterior/siguiente o desde la franja semanal `WeekStrip`). Soporta:
 * iniciar/finalizar entrenamiento con cronómetro pausable (`WorkoutTimer`), añadir/eliminar
 * ejercicios, reordenarlos por drag&drop (`NavigationPanel`), selección múltiple para borrado
 * en lote, edición de la nota del entrenamiento, y los modales de compartir/copiar/mover
 * entrenamiento. Al finalizar muestra un resumen (duración, ejercicios, series, volumen) vía
 * `FinishSummaryModal` y dispara el backup automático a Drive si está habilitado.
 */
export default function DashboardPage() {
  const today = todayISO();

  const activeWorkout = useWorkoutStore((s) => s.activeWorkout);
  const workoutExercises = useWorkoutStore((s) => s.exercises);
  const sets = useWorkoutStore((s) => s.sets);
  const workouts = useWorkoutStore((s) => s.workouts);
  const isLoading = useWorkoutStore((s) => s.isLoading);
  const loadWorkout = useWorkoutStore((s) => s.loadWorkout);
  const loadWorkouts = useWorkoutStore((s) => s.loadWorkouts);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const addExerciseToWorkout = useWorkoutStore((s) => s.addExerciseToWorkout);
  const removeExerciseFromWorkout = useWorkoutStore((s) => s.removeExerciseFromWorkout);
  const reorderExercisesStore = useWorkoutStore((s) => s.reorderExercises);
  const finishWorkout = useWorkoutStore((s) => s.finishWorkout);
  const setLoading = useWorkoutStore((s) => s.setLoading);
  const setWorkoutComment = useWorkoutStore((s) => s.setWorkoutComment);

  const exercises = useExerciseStore((s) => s.exercises);
  const categories = useExerciseStore((s) => s.categories);
  const loadExercises = useExerciseStore((s) => s.loadExercises);

  const confirmDelete = useConfirm();

  const [userId, setUserId] = useState("");
  const [activeWEId, setActiveWEId] = useState<string | null>(null);
  const [showExPicker, setShowExPicker] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [keepScreenOn, setKeepScreenOn] = useState(false);
  useWakeLock(keepScreenOn && !!activeWorkout);
  const [selectedExId, setSelectedExId] = useState("");
  const [currentDate, setCurrentDate] = useState(today);
  const [workoutCommentLocal, setWorkoutCommentLocal] = useState("");
  const [showSetCount, setShowSetCount] = useState(true);
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [summaryStats, setSummaryStats] = useState<{ duration: number; exercises: number; sets: number; volume: number } | null>(null);
  const elapsedRef = useRef(0);

  const client = createBrowserClient();
  const repo = createWorkoutRepository(client);
  const exRepo = createExerciseRepository(client);

  /**
   * Carga (o limpia) el estado del store de entrenamiento para una fecha dada:
   * resuelve el workout de esa fecha, sus ejercicios y las series de cada uno, y
   * selecciona el primer ejercicio como activo. Si no hay workout en esa fecha,
   * reinicia el store con un workout vacío (ver comentario interno).
   */
  const loadWorkoutForDate = useCallback(async (date: string, uid: string) => {
    const { data: workout } = await repo.getWorkoutByDate(date);
    if (!workout) {
      // Sin esto, navegar a un día sin entrenamiento deja visible el
      // workout del día anterior (activeWorkout no se limpia).
      loadWorkout({ id: "", date }, [], {});
      setActiveWEId(null);
      return;
    }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setWorkoutCommentLocal(activeWorkout?.comment ?? "");
  }, [activeWorkout?.id, activeWorkout?.comment]);

  useEffect(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, [activeWorkout?.id]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await client.auth.getUser();
      if (user) setUserId(user.id);

      const [catRes, exRes, recentRes] = await Promise.all([
        exRepo.getCategories(),
        exRepo.getExercises(),
        repo.getWorkouts(60),
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
      if (recentRes.data) {
        loadWorkouts(recentRes.data.map((w) => ({
          id: w.id, date: w.date, comment: w.comment ?? undefined,
          start_time: w.start_time ?? undefined, end_time: w.end_time ?? undefined,
          duration_minutes: w.duration_minutes ?? undefined,
        })));
      }

      await loadWorkoutForDate(today, user?.id ?? "");
      setKeepScreenOn(readBool(SETTING_KEYS.KEEP_SCREEN_ON, false));
      setShowSetCount(readBool(SETTING_KEYS.SHOW_SET_COUNT_HOME, true));
      setHiddenCategoryIds(readHiddenCategories());
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * userId se resuelve async al montar; si el usuario crea algo antes de que
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
    const { data: existing } = await repo.getWorkoutByDate(currentDate);
    if (!existing) {
      const { data, error } = await repo.createWorkout({ date: currentDate, start_time: new Date().toISOString() }, uid);
      if (error || !data) return;
    }
    startWorkout(currentDate);
    await loadWorkoutForDate(currentDate, uid);
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
    await repo.reorderExercises(orderedIds.map((id, i) => ({ id, order_index: i })));
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

  async function handleSaveComment() {
    if (!activeWorkout) return;
    setWorkoutComment(workoutCommentLocal);
    await repo.updateWorkout(activeWorkout.id, { comment: workoutCommentLocal || undefined });
  }

  /** Navega `delta` días respecto a `currentDate` y recarga el workout de la nueva fecha. */
  async function handleDateChange(delta: number) {
    // Deshabilitar los botones mientras carga evita que clics rápidos lean
    // un `currentDate` obsoleto (closure) antes de que termine el fetch
    // anterior y salten menos días de los pulsados.
    setLoading(true);
    const date = new Date(currentDate);
    date.setDate(date.getDate() + delta);
    const newDate = date.toISOString().split("T")[0]!;
    setCurrentDate(newDate);
    await loadWorkoutForDate(newDate, userId);
    setLoading(false);
  }

  async function handleSelectDate(date: string) {
    if (date === currentDate) return;
    setLoading(true);
    setCurrentDate(date);
    await loadWorkoutForDate(date, userId);
    setLoading(false);
  }

  const workoutDates = new Set(workouts.map((w) => w.date));

  return (
    <div className="space-y-4">
      {/* Header with date nav */}
      <div className="flex items-center gap-3">
        <button onClick={() => handleDateChange(-1)} disabled={isLoading} aria-label="Día anterior" className="rounded-xl border px-2 py-1 text-sm hover:bg-secondary disabled:opacity-40"><ChevronLeft size={16} aria-hidden="true" /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {currentDate === today ? "Entrenamiento de hoy" : "Entrenamiento"}
          </h1>
          <p className="text-sm text-muted-foreground">{formatWorkoutDate(currentDate)}</p>
        </div>
        <button onClick={() => handleDateChange(1)} disabled={isLoading || currentDate >= today} aria-label="Día siguiente" className="rounded-xl border px-2 py-1 text-sm hover:bg-secondary disabled:opacity-40"><ChevronRight size={16} aria-hidden="true" /></button>
      </div>

      {/* Weekly summary strip */}
      {!isLoading && (
        <WeekStrip workoutDates={workoutDates} currentDate={currentDate} today={today} onSelectDate={handleSelectDate} />
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-16 rounded-2xl border bg-secondary/30 animate-pulse" />)}
        </div>
      ) : !activeWorkout || !activeWorkout.id ? (
        <EmptyState
          icon={Dumbbell}
          title="Sin entrenamiento aún"
          description="Inicia un entrenamiento para registrar tus series y hacer seguimiento del progreso."
          action={{ label: "Iniciar entrenamiento", onClick: handleStartWorkout }}
        />
      ) : (
        <div className="space-y-4">
          {/* Actions */}
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
            <div className="ml-auto flex items-center gap-2">
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
              {!activeWorkout.end_time && (
                <button
                  onClick={handleFinish}
                  className="rounded-xl border border-destructive px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  Finalizar
                </button>
              )}
            </div>
          </div>

          {selectMode && (
            <div className="flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2">
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

          {/* Exercise list */}
          {workoutExercises.length > 0 ? (
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
          ) : !activeWorkout.end_time ? (
            <button
              onClick={() => setShowExPicker(true)}
              className="w-full rounded-2xl border border-dashed py-3.5 text-sm text-muted-foreground hover:bg-secondary"
            >
              + Añadir ejercicio
            </button>
          ) : null}

          {/* Exercise picker */}
          {showExPicker && !activeWorkout.end_time && (
            <div className="flex gap-2">
              <label htmlFor="exercise-picker" className="sr-only">Seleccionar ejercicio</label>
              <select
                id="exercise-picker"
                value={selectedExId}
                onChange={(e) => setSelectedExId(e.target.value)}
                className="flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Seleccionar ejercicio…</option>
                {categories
                  .filter((cat) => !hiddenCategoryIds.includes(cat.id))
                  .slice()
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((cat) => {
                    const catExercises = exercises
                      .filter((ex) => ex.category_id === cat.id)
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name));
                    if (catExercises.length === 0) return null;
                    return (
                      <optgroup key={cat.id} label={cat.name}>
                        {catExercises.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                      </optgroup>
                    );
                  })}
              </select>
              <button onClick={handleAddExercise} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Añadir</button>
              <button onClick={() => setShowExPicker(false)} className="rounded-xl border px-4 py-2 text-sm hover:bg-secondary">Cancelar</button>
            </div>
          )}

          {/* Active exercise sets */}
          {activeWEId && !selectMode && (
            <div className="rounded-2xl border bg-card p-4">
              <TrainingScreen workoutExerciseId={activeWEId} userId={userId} />
            </div>
          )}

          {/* Workout comment */}
          <div>
            <label htmlFor="workout-comment" className="sr-only">Nota del entrenamiento</label>
            <textarea
              id="workout-comment"
              value={workoutCommentLocal}
              onChange={(e) => setWorkoutCommentLocal(e.target.value)}
              onBlur={handleSaveComment}
              disabled={!!activeWorkout.end_time}
              placeholder="Añadir nota al entrenamiento…"
              rows={2}
              className="w-full resize-none rounded-2xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
            />
          </div>
        </div>
      )}

      {showShare && activeWorkout && (
        <ShareWorkoutModal
          date={currentDate}
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
          onCopied={() => loadWorkoutForDate(currentDate, userId)}
          onClose={() => setShowCopy(false)}
        />
      )}

      {showMove && activeWorkout && (
        <MoveWorkoutModal
          workoutId={activeWorkout.id}
          currentDate={currentDate}
          onMoved={(newDate) => {
            setCurrentDate(newDate);
            loadWorkoutForDate(newDate, userId);
          }}
          onClose={() => setShowMove(false)}
        />
      )}

      {summaryStats && (
        <FinishSummaryModal stats={summaryStats} onClose={() => setSummaryStats(null)} />
      )}

      {/* Recent workouts */}
      {workouts.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Entrenamientos recientes</h2>
          <div className="space-y-2">
            {workouts.slice(0, 5).map((w) => (
              <Link
                key={w.id}
                href={`/workout/${w.date}`}
                className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3 hover:bg-secondary/50"
              >
                <span className="text-sm font-medium">{formatWorkoutDate(w.date)}</span>
                <ChevronRight className="text-muted-foreground" size={14} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
