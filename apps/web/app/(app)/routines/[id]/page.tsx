"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRoutineStore, useExerciseStore } from "@fitnotes/core";
import type { RoutineDayExercise, PredefinedSet } from "@fitnotes/core";
import {
  createBrowserClient,
  createRoutineRepository,
  createExerciseRepository,
  createWorkoutRepository,
} from "@fitnotes/database";
import { CalendarDays } from "lucide-react";
import DaySection from "@/components/routines/DaySection";
import PredefinedSetsModal from "@/components/routines/PredefinedSetsModal";
import EmptyState from "@/components/EmptyState";
import { useConfirm } from "@/components/ConfirmDialog";

interface Props {
  params: Promise<{ id: string }>;
}

export default function RoutineDetailPage({ params }: Props) {
  const { id: routineId } = use(params);
  const router = useRouter();

  const routines = useRoutineStore((s) => s.routines);
  const routineDays = useRoutineStore((s) => s.routineDays);
  const routineDayExercises = useRoutineStore((s) => s.routineDayExercises);
  const predefinedSets = useRoutineStore((s) => s.predefinedSets);
  const isLoading = useRoutineStore((s) => s.isLoading);
  const confirmDelete = useConfirm();

  const loadRoutines = useRoutineStore((s) => s.loadRoutines);
  const loadRoutineDays = useRoutineStore((s) => s.loadRoutineDays);
  const loadRoutineDayExercises = useRoutineStore((s) => s.loadRoutineDayExercises);
  const loadPredefinedSets = useRoutineStore((s) => s.loadPredefinedSets);
  const savePredefinedSetsStore = useRoutineStore((s) => s.savePredefinedSets);
  const addRoutineDay = useRoutineStore((s) => s.addRoutineDay);
  const updateRoutineDay = useRoutineStore((s) => s.updateRoutineDay);
  const deleteRoutineDay = useRoutineStore((s) => s.deleteRoutineDay);
  const reorderDaysStore = useRoutineStore((s) => s.reorderDays);
  const addExerciseToDay = useRoutineStore((s) => s.addExerciseToDay);
  const removeExerciseFromDay = useRoutineStore((s) => s.removeExerciseFromDay);
  const reorderExercisesInDayStore = useRoutineStore((s) => s.reorderExercisesInDay);
  const setLoading = useRoutineStore((s) => s.setLoading);

  const exercises = useExerciseStore((s) => s.exercises);
  const loadExercises = useExerciseStore((s) => s.loadExercises);

  const [editMode, setEditMode] = useState(false);
  const [newDayName, setNewDayName] = useState("");
  const [showNewDay, setShowNewDay] = useState(false);
  const [userId, setUserId] = useState("");
  const [loggingDayId, setLoggingDayId] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);

  // Drag & drop for days
  const [dragDayId, setDragDayId] = useState<string | null>(null);
  const [dragOverDayId, setDragOverDayId] = useState<string | null>(null);

  // Predefined sets modal
  const [setsModalRde, setSetsModalRde] = useState<RoutineDayExercise | null>(null);

  const client = createBrowserClient();
  const repo = createRoutineRepository(client);
  const exRepo = createExerciseRepository(client);
  const workoutRepo = createWorkoutRepository(client);

  const routine = routines.find((r) => r.id === routineId);
  const days = (routineDays[routineId] ?? []).slice().sort((a, b) => a.order_index - b.order_index);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await client.auth.getUser();
      if (user) setUserId(user.id);

      const [rRes, exRes, catRes] = await Promise.all([
        repo.getRoutines(),
        exRepo.getExercises(),
        exRepo.getCategories(),
      ]);

      if (rRes.data) {
        loadRoutines(rRes.data.map((r) => ({ id: r.id, name: r.name, notes: r.notes ?? undefined })));
      }
      if (catRes.data && exRes.data) {
        loadExercises(catRes.data, exRes.data.map((ex) => ({
          id: ex.id,
          name: ex.name,
          category_id: ex.category_id ?? "",
          type: ex.type as Parameters<typeof loadExercises>[1][number]["type"],
          weight_unit: ex.weight_unit as "kg" | "lb",
          notes: ex.notes ?? undefined,
          is_favorite: ex.is_favorite,
          created_at: ex.created_at,
        })));
      }

      const { data: daysData } = await repo.getDays(routineId);
      if (daysData) {
        loadRoutineDays(
          routineId,
          daysData.map((d) => ({ id: d.id, routine_id: d.routine_id, name: d.name, order_index: d.order_index }))
        );
        for (const day of daysData) {
          const { data: rdeData } = await repo.getDayExercises(day.id);
          if (rdeData) {
            loadRoutineDayExercises(
              day.id,
              rdeData.map((e) => ({
                id: e.id,
                routine_day_id: e.routine_day_id,
                exercise_id: e.exercise_id,
                order_index: e.order_index,
                group_id: e.group_id ?? undefined,
                group_name: (e as { group_name?: string | null }).group_name ?? undefined,
              }))
            );
            // Load predefined sets for each exercise
            for (const rde of rdeData) {
              const { data: sets } = await repo.getPredefinedSets(rde.id);
              if (sets && sets.length > 0) {
                loadPredefinedSets(
                  rde.id,
                  sets.map((s) => ({
                    id: s.id,
                    routine_day_exercise_id: s.routine_day_exercise_id,
                    weight: s.weight ?? undefined,
                    reps: s.reps ?? undefined,
                    distance: s.distance ?? undefined,
                    time_seconds: s.time_seconds ?? undefined,
                    order_index: s.order_index,
                  }))
                );
              }
            }
          }
        }
      }
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routineId]);

  // ─── Day management ────────────────────────────────────────────────────────

  async function handleAddDay() {
    if (!newDayName.trim()) return;
    const { data, error } = await repo.createDay(
      { routine_id: routineId, name: newDayName.trim(), order_index: days.length },
      userId
    );
    if (error || !data) return;
    addRoutineDay({ id: data.id, routine_id: data.routine_id, name: data.name, order_index: data.order_index });
    loadRoutineDayExercises(data.id, []);
    setNewDayName("");
    setShowNewDay(false);
  }

  async function handleRenameDay(dayId: string, name: string) {
    const { error } = await repo.updateDay(dayId, { name });
    if (error) return;
    updateRoutineDay(dayId, { name });
  }

  async function handleDeleteDay(dayId: string) {
    if (!(await confirmDelete("¿Eliminar este día y todos sus ejercicios?"))) return;
    const { error } = await repo.deleteDay(dayId);
    if (error) return;
    deleteRoutineDay(routineId, dayId);
  }

  // ─── Day drag & drop ───────────────────────────────────────────────────────

  async function handleDayDragEnd() {
    if (!dragDayId || !dragOverDayId || dragDayId === dragOverDayId) {
      setDragDayId(null);
      setDragOverDayId(null);
      return;
    }
    const fromIdx = days.findIndex((d) => d.id === dragDayId);
    const toIdx = days.findIndex((d) => d.id === dragOverDayId);
    if (fromIdx === -1 || toIdx === -1) {
      setDragDayId(null);
      setDragOverDayId(null);
      return;
    }
    const newOrder = [...days];
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, moved!);
    const updates = newOrder.map((d, i) => ({ id: d.id, order_index: i }));
    reorderDaysStore(routineId, updates);
    setDragDayId(null);
    setDragOverDayId(null);
    await repo.reorderDays(updates);
  }

  // ─── Exercise management ───────────────────────────────────────────────────

  async function handleAddExercise(dayId: string, exerciseId: string) {
    const dayExs = routineDayExercises[dayId] ?? [];
    const { data, error } = await repo.addExercise(
      { routine_day_id: dayId, exercise_id: exerciseId, order_index: dayExs.length },
      userId
    );
    if (error || !data) return;
    addExerciseToDay({
      id: data.id,
      routine_day_id: data.routine_day_id,
      exercise_id: data.exercise_id,
      order_index: data.order_index,
      group_id: data.group_id ?? undefined,
    });
  }

  async function handleRemoveExercise(rdeId: string) {
    const dayId = Object.keys(routineDayExercises).find((dId) =>
      routineDayExercises[dId]?.some((e) => e.id === rdeId)
    );
    const { error } = await repo.removeExercise(rdeId);
    if (error || !dayId) return;
    removeExerciseFromDay(dayId, rdeId);
  }

  async function handleReorderExercises(dayId: string, updates: { id: string; order_index: number }[]) {
    reorderExercisesInDayStore(dayId, updates);
    await repo.reorderExercises(updates);
  }

  // ─── Supersets ─────────────────────────────────────────────────────────────

  async function handleCreateSuperset(rdeId: string, nextRdeId: string) {
    const groupId = crypto.randomUUID();
    const dayId = Object.keys(routineDayExercises).find((dId) =>
      routineDayExercises[dId]?.some((e) => e.id === rdeId)
    );
    if (!dayId) return;

    await Promise.all([
      repo.updateDayExercise(rdeId, { group_id: groupId }),
      repo.updateDayExercise(nextRdeId, { group_id: groupId }),
    ]);

    // Update store
    const dayExs = routineDayExercises[dayId] ?? [];
    loadRoutineDayExercises(
      dayId,
      dayExs.map((e) =>
        e.id === rdeId || e.id === nextRdeId ? { ...e, group_id: groupId } : e
      )
    );
  }

  async function handleRemoveFromSuperset(rdeId: string) {
    const dayId = Object.keys(routineDayExercises).find((dId) =>
      routineDayExercises[dId]?.some((e) => e.id === rdeId)
    );
    if (!dayId) return;

    const dayExs = routineDayExercises[dayId] ?? [];
    const thisRde = dayExs.find((e) => e.id === rdeId);
    const groupId = thisRde?.group_id;
    if (!groupId) return;

    await repo.updateDayExercise(rdeId, { group_id: null, group_name: null });

    // If only one exercise left in the group, also ungroup it
    const remaining = dayExs.filter((e) => e.group_id === groupId && e.id !== rdeId);
    if (remaining.length === 1) {
      await repo.updateDayExercise(remaining[0]!.id, { group_id: null, group_name: null });
    }

    loadRoutineDayExercises(
      dayId,
      dayExs.map((e) => {
        if (e.id === rdeId) return { ...e, group_id: undefined, group_name: undefined };
        if (remaining.length === 1 && e.id === remaining[0]!.id)
          return { ...e, group_id: undefined, group_name: undefined };
        return e;
      })
    );
  }

  async function handleRenameGroup(groupId: string, name: string) {
    const dayId = Object.keys(routineDayExercises).find((dId) =>
      routineDayExercises[dId]?.some((e) => e.group_id === groupId)
    );
    if (!dayId) return;
    await repo.updateDayGroupName(groupId, name);
    const dayExs = routineDayExercises[dayId] ?? [];
    loadRoutineDayExercises(
      dayId,
      dayExs.map((e) =>
        e.group_id === groupId ? { ...e, group_name: name || undefined } : e
      )
    );
  }

  // ─── Predefined sets ───────────────────────────────────────────────────────

  async function handleSavePredefinedSets(
    rdeId: string,
    sets: Array<{ weight?: number; reps?: number; distance?: number; time_seconds?: number; order_index: number }>
  ) {
    const { data } = await repo.savePredefinedSets(rdeId, sets, userId);
    const saved: PredefinedSet[] = (data ?? []).map((s) => ({
      id: s.id,
      routine_day_exercise_id: s.routine_day_exercise_id,
      weight: s.weight ?? undefined,
      reps: s.reps ?? undefined,
      distance: s.distance ?? undefined,
      time_seconds: s.time_seconds ?? undefined,
      order_index: s.order_index,
    }));
    // If repo returned nothing (empty array case), build from input
    const stored: PredefinedSet[] = saved.length > 0
      ? saved
      : sets.map((s, i) => ({
          id: `local-${i}`,
          routine_day_exercise_id: rdeId,
          weight: s.weight,
          reps: s.reps,
          distance: s.distance,
          time_seconds: s.time_seconds,
          order_index: s.order_index,
        }));
    savePredefinedSetsStore(rdeId, stored);
  }

  // ─── Log All ───────────────────────────────────────────────────────────────

  async function handleLogAll(dayId: string) {
    setLoggingDayId(dayId);
    setLogError(null);
    try {
      const today = new Date().toISOString().split("T")[0]!;

      // Get or create today's workout
      let workoutId: string;
      const { data: existing } = await workoutRepo.getWorkoutByDate(today);
      if (existing) {
        workoutId = existing.id;
      } else {
        const { data: created, error: createErr } = await workoutRepo.createWorkout(
          { date: today, start_time: new Date().toISOString() },
          userId
        );
        if (createErr || !created) {
          setLogError("No se pudo crear el entrenamiento.");
          return;
        }
        workoutId = created.id;
      }

      // Get current exercise count in workout to continue order
      const { data: existingWEs } = await workoutRepo.getWorkoutExercises(workoutId);
      let exOrderBase = existingWEs?.length ?? 0;

      const dayExercises = (routineDayExercises[dayId] ?? [])
        .slice()
        .sort((a, b) => a.order_index - b.order_index);

      for (const rde of dayExercises) {
        const { data: we, error: weErr } = await workoutRepo.addExercise(
          {
            workout_id: workoutId,
            exercise_id: rde.exercise_id,
            order_index: exOrderBase,
            group_id: rde.group_id,
            group_name: rde.group_name,
          },
          userId
        );
        if (weErr || !we) continue;
        exOrderBase++;

        const pSets = predefinedSets[rde.id] ?? [];
        if (pSets.length === 0) continue;

        // Get last session sets for "copy previous" logic
        const lastSets = await workoutRepo.getLastSessionSets(rde.exercise_id, workoutId);

        for (let j = 0; j < pSets.length; j++) {
          const ps = pSets[j]!;
          const hasValues =
            ps.weight != null || ps.reps != null ||
            ps.distance != null || ps.time_seconds != null;

          let weight = ps.weight;
          let reps = ps.reps;
          let distance = ps.distance;
          let time_seconds = ps.time_seconds;

          if (!hasValues && lastSets.length > 0) {
            const lastSet = lastSets[j] ?? lastSets[lastSets.length - 1]!;
            weight = lastSet.weight ?? undefined;
            reps = lastSet.reps ?? undefined;
            distance = lastSet.distance ?? undefined;
            time_seconds = lastSet.time_seconds ?? undefined;
          }

          await workoutRepo.createSet(
            {
              workout_exercise_id: we.id,
              order_index: j,
              weight: weight ?? undefined,
              reps: reps ?? undefined,
              distance: distance ?? undefined,
              time_seconds: time_seconds ?? undefined,
            },
            userId
          );
        }
      }

      router.push("/dashboard");
    } catch {
      setLogError("Error al registrar el entrenamiento.");
    } finally {
      setLoggingDayId(null);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const setsModalExercise = setsModalRde
    ? exercises.find((e) => e.id === setsModalRde.exercise_id)
    : undefined;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/routines" className="text-muted-foreground hover:text-foreground text-sm">
          ← Rutinas
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl font-bold tracking-tight flex-1">
          {routine?.name ?? "Rutina"}
        </h1>
        <button
          onClick={() => setEditMode((v) => !v)}
          className={`rounded-xl border px-4 py-2 text-sm font-medium ${
            editMode ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
          }`}
        >
          {editMode ? "Hecho" : "Editar"}
        </button>
        {editMode && (
          <button
            onClick={() => setShowNewDay(true)}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + Añadir día
          </button>
        )}
      </div>

      {routine?.notes && (
        <p className="text-sm text-muted-foreground">{routine.notes}</p>
      )}

      {logError && (
        <p className="text-sm text-destructive">{logError}</p>
      )}

      {showNewDay && (
        <div className="flex gap-2">
          <input
            autoFocus
            value={newDayName}
            onChange={(e) => setNewDayName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddDay()}
            placeholder="Nombre del día (p. ej. Empuje, Tirón, Piernas)"
            className="flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleAddDay}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Añadir
          </button>
          <button
            onClick={() => setShowNewDay(false)}
            className="rounded-xl border px-4 py-2 text-sm hover:bg-secondary"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Days list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl border bg-secondary/30 animate-pulse" />
          ))}
        </div>
      ) : days.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Sin días aún"
          description="Añade el primer día de esta rutina para empezar a planificar ejercicios."
          action={{ label: "Añadir día", onClick: () => { setEditMode(true); setShowNewDay(true); } }}
        />
      ) : (
        <div className="space-y-3">
          {days.map((day) => (
            <div
              key={day.id}
              draggable={editMode}
              onDragStart={() => setDragDayId(day.id)}
              onDragOver={(e) => { e.preventDefault(); setDragOverDayId(day.id); }}
              onDragEnd={handleDayDragEnd}
              className={[
                "transition-opacity",
                dragDayId === day.id ? "opacity-40" : "",
                dragOverDayId === day.id && dragDayId !== day.id ? "ring-2 ring-primary rounded-2xl" : "",
                editMode ? "cursor-grab active:cursor-grabbing" : "",
              ].join(" ")}
            >
              <DaySection
                day={day}
                exercises={routineDayExercises[day.id] ?? []}
                allExercises={exercises}
                predefinedSets={predefinedSets}
                editMode={editMode}
                isLoggingAll={loggingDayId === day.id}
                onRenameDay={handleRenameDay}
                onDeleteDay={handleDeleteDay}
                onAddExercise={handleAddExercise}
                onRemoveExercise={handleRemoveExercise}
                onLogAll={handleLogAll}
                onReorderExercises={handleReorderExercises}
                onOpenPredefinedSets={(rde) => setSetsModalRde(rde)}
                onCreateSuperset={handleCreateSuperset}
                onRemoveFromSuperset={handleRemoveFromSuperset}
                onRenameGroup={handleRenameGroup}
              />
            </div>
          ))}
        </div>
      )}

      {/* Predefined sets modal */}
      {setsModalRde && (
        <PredefinedSetsModal
          rde={setsModalRde}
          exercise={setsModalExercise}
          initialSets={predefinedSets[setsModalRde.id] ?? []}
          onSave={handleSavePredefinedSets}
          onClose={() => setSetsModalRde(null)}
        />
      )}
    </div>
  );
}
