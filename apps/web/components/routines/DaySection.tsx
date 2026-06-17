"use client";

import { useState } from "react";
import type { RoutineDay, RoutineDayExercise, Exercise } from "@fitnotes/core";

interface Props {
  day: RoutineDay;
  exercises: RoutineDayExercise[];
  allExercises: Exercise[];
  editMode: boolean;
  onRenameDay: (dayId: string, name: string) => Promise<void>;
  onDeleteDay: (dayId: string) => Promise<void>;
  onAddExercise: (dayId: string, exerciseId: string) => Promise<void>;
  onRemoveExercise: (rdeId: string) => Promise<void>;
  onLogAll: (dayId: string) => void;
}

export default function DaySection({
  day, exercises, allExercises, editMode,
  onRenameDay, onDeleteDay, onAddExercise, onRemoveExercise, onLogAll,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [dayName, setDayName] = useState(day.name);
  const [showAddEx, setShowAddEx] = useState(false);
  const [selectedExId, setSelectedExId] = useState("");

  async function handleRename() {
    if (!dayName.trim()) return;
    await onRenameDay(day.id, dayName.trim());
    setRenaming(false);
  }

  async function handleAddExercise() {
    if (!selectedExId) return;
    await onAddExercise(day.id, selectedExId);
    setSelectedExId("");
    setShowAddEx(false);
  }

  const exerciseMap = Object.fromEntries(allExercises.map((e) => [e.id, e]));

  return (
    <div className="rounded-lg border bg-card">
      {/* Day header */}
      <div className="flex items-center gap-2 p-3 border-b">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-muted-foreground hover:text-foreground"
        >
          {collapsed ? "▶" : "▼"}
        </button>
        {renaming ? (
          <input
            autoFocus
            value={dayName}
            onChange={(e) => setDayName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            className="flex-1 rounded border px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        ) : (
          <span
            className="flex-1 font-medium text-sm cursor-pointer"
            onDoubleClick={() => editMode && setRenaming(true)}
          >
            {day.name}
          </span>
        )}
        <span className="text-xs text-muted-foreground">{exercises.length} exercises</span>
        {!editMode && (
          <button
            onClick={() => onLogAll(day.id)}
            className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Log All
          </button>
        )}
        {editMode && (
          <>
            <button onClick={() => setRenaming(true)} className="rounded border px-2 py-0.5 text-xs hover:bg-secondary">Rename</button>
            <button
              onClick={() => onDeleteDay(day.id)}
              className="rounded border px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10"
            >
              Delete
            </button>
          </>
        )}
      </div>

      {!collapsed && (
        <div className="p-3 space-y-2">
          {exercises.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No exercises. Add some below.</p>
          ) : (
            exercises.map((rde) => {
              const ex = exerciseMap[rde.exercise_id];
              return (
                <div key={rde.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  {rde.group_id && (
                    <div className="w-1 h-6 rounded bg-primary/50 shrink-0" />
                  )}
                  <span className="flex-1">{ex?.name ?? rde.exercise_id}</span>
                  <span className="text-xs text-muted-foreground">{ex?.type?.replace(/_/g, " ").toLowerCase()}</span>
                  {editMode && (
                    <button
                      onClick={() => onRemoveExercise(rde.id)}
                      className="text-destructive hover:text-destructive/70 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })
          )}

          {editMode && (
            <div className="pt-1">
              {showAddEx ? (
                <div className="flex gap-2">
                  <select
                    value={selectedExId}
                    onChange={(e) => setSelectedExId(e.target.value)}
                    className="flex-1 rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Select exercise…</option>
                    {allExercises.map((ex) => (
                      <option key={ex.id} value={ex.id}>{ex.name}</option>
                    ))}
                  </select>
                  <button onClick={handleAddExercise} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">Add</button>
                  <button onClick={() => setShowAddEx(false)} className="rounded-md border px-3 py-1.5 text-xs hover:bg-secondary">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddEx(true)}
                  className="w-full rounded-md border border-dashed py-2 text-xs text-muted-foreground hover:bg-secondary/50"
                >
                  + Add exercise
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
