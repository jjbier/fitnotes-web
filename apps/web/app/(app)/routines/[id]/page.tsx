"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRoutineStore, useExerciseStore } from "@fitnotes/core";
import { createBrowserClient, createRoutineRepository, createExerciseRepository } from "@fitnotes/database";
import DaySection from "@/components/routines/DaySection";

interface Props {
  params: Promise<{ id: string }>;
}

export default function RoutineDetailPage({ params }: Props) {
  const { id: routineId } = use(params);

  const routines = useRoutineStore((s) => s.routines);
  const routineDays = useRoutineStore((s) => s.routineDays);
  const routineDayExercises = useRoutineStore((s) => s.routineDayExercises);
  const isLoading = useRoutineStore((s) => s.isLoading);
  const loadRoutines = useRoutineStore((s) => s.loadRoutines);
  const loadRoutineDays = useRoutineStore((s) => s.loadRoutineDays);
  const loadRoutineDayExercises = useRoutineStore((s) => s.loadRoutineDayExercises);
  const addRoutineDay = useRoutineStore((s) => s.addRoutineDay);
  const updateRoutineDay = useRoutineStore((s) => s.updateRoutineDay);
  const deleteRoutineDay = useRoutineStore((s) => s.deleteRoutineDay);
  const addExerciseToDay = useRoutineStore((s) => s.addExerciseToDay);
  const removeExerciseFromDay = useRoutineStore((s) => s.removeExerciseFromDay);
  const setLoading = useRoutineStore((s) => s.setLoading);

  const exercises = useExerciseStore((s) => s.exercises);
  const loadExercises = useExerciseStore((s) => s.loadExercises);

  const [editMode, setEditMode] = useState(false);
  const [newDayName, setNewDayName] = useState("");
  const [showNewDay, setShowNewDay] = useState(false);
  const [userId, setUserId] = useState("");

  const client = createBrowserClient();
  const repo = createRoutineRepository(client);
  const exRepo = createExerciseRepository(client);

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
      if (rRes.data) loadRoutines(rRes.data.map((r) => ({ id: r.id, name: r.name, notes: r.notes ?? undefined })));
      if (catRes.data && exRes.data) {
        loadExercises(catRes.data, exRes.data.map((ex) => ({
          id: ex.id, name: ex.name,
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
        loadRoutineDays(routineId, daysData.map((d) => ({ id: d.id, routine_id: d.routine_id, name: d.name, order_index: d.order_index })));
        for (const day of daysData) {
          const { data: rdeData } = await repo.getDayExercises(day.id);
          if (rdeData) {
            loadRoutineDayExercises(day.id, rdeData.map((e) => ({
              id: e.id, routine_day_id: e.routine_day_id, exercise_id: e.exercise_id,
              order_index: e.order_index, group_id: e.group_id ?? undefined,
            })));
          }
        }
      }
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routineId]);

  async function handleAddDay() {
    if (!newDayName.trim()) return;
    const { data, error } = await repo.createDay({
      routine_id: routineId,
      name: newDayName.trim(),
      order_index: days.length,
    }, userId);
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
    if (!confirm("Delete this day and all its exercises?")) return;
    const { error } = await repo.deleteDay(dayId);
    if (error) return;
    deleteRoutineDay(routineId, dayId);
  }

  async function handleAddExercise(dayId: string, exerciseId: string) {
    const dayExs = routineDayExercises[dayId] ?? [];
    const { data, error } = await repo.addExercise({
      routine_day_id: dayId, exercise_id: exerciseId, order_index: dayExs.length,
    }, userId);
    if (error || !data) return;
    addExerciseToDay({ id: data.id, routine_day_id: data.routine_day_id, exercise_id: data.exercise_id, order_index: data.order_index, group_id: data.group_id ?? undefined });
  }

  async function handleRemoveExercise(rdeId: string) {
    const dayId = Object.keys(routineDayExercises).find((dId) =>
      routineDayExercises[dId]?.some((e) => e.id === rdeId)
    );
    const { error } = await repo.removeExercise(rdeId);
    if (error || !dayId) return;
    removeExerciseFromDay(dayId, rdeId);
  }

  function handleLogAll(dayId: string) {
    alert(`Log All for day ${dayId} — will be wired in Phase 3 (workout logging)`);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/routines" className="text-muted-foreground hover:text-foreground text-sm">← Routines</Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl font-bold tracking-tight flex-1">
          {routine?.name ?? "Routine"}
        </h1>
        <button
          onClick={() => setEditMode((v) => !v)}
          className={`rounded-md border px-4 py-2 text-sm font-medium ${editMode ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
        >
          {editMode ? "Done" : "Edit"}
        </button>
        {editMode && (
          <button
            onClick={() => setShowNewDay(true)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + Add Day
          </button>
        )}
      </div>

      {/* Notes */}
      {routine?.notes && (
        <p className="text-sm text-muted-foreground">{routine.notes}</p>
      )}

      {/* New day form */}
      {showNewDay && (
        <div className="flex gap-2">
          <input
            autoFocus
            value={newDayName}
            onChange={(e) => setNewDayName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddDay()}
            placeholder="Day name (e.g. Push, Pull, Legs)"
            className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button onClick={handleAddDay} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Add</button>
          <button onClick={() => setShowNewDay(false)} className="rounded-md border px-4 py-2 text-sm hover:bg-secondary">Cancel</button>
        </div>
      )}

      {/* Days */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-lg border bg-secondary/30 animate-pulse" />)}
        </div>
      ) : days.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
          No days yet. Toggle Edit and add your first day.
        </div>
      ) : (
        <div className="space-y-3">
          {days.map((day) => (
            <DaySection
              key={day.id}
              day={day}
              exercises={routineDayExercises[day.id] ?? []}
              allExercises={exercises}
              editMode={editMode}
              onRenameDay={handleRenameDay}
              onDeleteDay={handleDeleteDay}
              onAddExercise={handleAddExercise}
              onRemoveExercise={handleRemoveExercise}
              onLogAll={handleLogAll}
            />
          ))}
        </div>
      )}
    </div>
  );
}
