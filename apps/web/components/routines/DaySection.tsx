"use client";

import { useState } from "react";
import type { RoutineDay, RoutineDayExercise, Exercise, PredefinedSet } from "@fitnotes/core";

interface Props {
  day: RoutineDay;
  exercises: RoutineDayExercise[];
  allExercises: Exercise[];
  predefinedSets: Record<string, PredefinedSet[]>;
  editMode: boolean;
  isLoggingAll: boolean;
  onRenameDay: (dayId: string, name: string) => Promise<void>;
  onDeleteDay: (dayId: string) => Promise<void>;
  onAddExercise: (dayId: string, exerciseId: string) => Promise<void>;
  onRemoveExercise: (rdeId: string) => Promise<void>;
  onLogAll: (dayId: string) => Promise<void>;
  onReorderExercises: (dayId: string, updates: { id: string; order_index: number }[]) => Promise<void>;
  onOpenPredefinedSets: (rde: RoutineDayExercise) => void;
  onCreateSuperset: (rdeId: string, nextRdeId: string) => Promise<void>;
  onRemoveFromSuperset: (rdeId: string) => Promise<void>;
  onRenameGroup: (groupId: string, name: string) => Promise<void>;
}

export default function DaySection({
  day, exercises, allExercises, predefinedSets, editMode, isLoggingAll,
  onRenameDay, onDeleteDay, onAddExercise, onRemoveExercise, onLogAll,
  onReorderExercises, onOpenPredefinedSets, onCreateSuperset, onRemoveFromSuperset, onRenameGroup,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [dayName, setDayName] = useState(day.name);
  const [showAddEx, setShowAddEx] = useState(false);
  const [selectedExId, setSelectedExId] = useState("");

  // Drag & drop for exercises within this day
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Superset group rename
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [groupNameInput, setGroupNameInput] = useState("");

  const sortedExercises = [...exercises].sort((a, b) => a.order_index - b.order_index);
  const exerciseMap = Object.fromEntries(allExercises.map((e) => [e.id, e]));

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

  async function handleExDragEnd() {
    if (dragIdx === null || dragOverIdx === null || dragIdx === dragOverIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const newOrder = [...sortedExercises];
    const [moved] = newOrder.splice(dragIdx, 1);
    newOrder.splice(dragOverIdx, 0, moved!);
    const updates = newOrder.map((ex, i) => ({ id: ex.id, order_index: i }));
    setDragIdx(null);
    setDragOverIdx(null);
    await onReorderExercises(day.id, updates);
  }

  async function handleStartRenameGroup(groupId: string, currentName: string) {
    setRenamingGroupId(groupId);
    setGroupNameInput(currentName);
  }

  async function handleSaveGroupName() {
    if (!renamingGroupId) return;
    await onRenameGroup(renamingGroupId, groupNameInput.trim());
    setRenamingGroupId(null);
    setGroupNameInput("");
  }

  // Determine which group_id colors to use (cycle through a small palette)
  const groupColors: Record<string, string> = {};
  const palette = ["bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];
  let colorIdx = 0;
  for (const ex of sortedExercises) {
    if (ex.group_id && !groupColors[ex.group_id]) {
      groupColors[ex.group_id] = palette[colorIdx % palette.length]!;
      colorIdx++;
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      {/* Day header */}
      <div className="flex items-center gap-2 p-3 border-b">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label={collapsed ? "Expandir día" : "Contraer día"}
          aria-expanded={!collapsed}
        >
          <span aria-hidden="true">{collapsed ? "▶" : "▼"}</span>
        </button>

        {renaming ? (
          <input
            autoFocus
            value={dayName}
            onChange={(e) => setDayName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            className="flex-1 rounded border px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Nombre del día"
          />
        ) : (
          <span
            className="flex-1 font-medium text-sm cursor-pointer"
            onDoubleClick={() => editMode && setRenaming(true)}
          >
            {day.name}
          </span>
        )}

        <span className="text-xs text-muted-foreground shrink-0">
          {sortedExercises.length} ej.
        </span>

        {!editMode && (
          <button
            onClick={() => onLogAll(day.id)}
            disabled={isLoggingAll || sortedExercises.length === 0}
            className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shrink-0"
          >
            {isLoggingAll ? "Registrando…" : "Registrar todo"}
          </button>
        )}

        {editMode && (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => setRenaming(true)}
              className="rounded border px-2 py-0.5 text-xs hover:bg-secondary"
            >
              Renombrar
            </button>
            <button
              onClick={() => onDeleteDay(day.id)}
              className="rounded border px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10"
            >
              Eliminar
            </button>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="p-3 space-y-1.5">
          {sortedExercises.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Sin ejercicios. Añade algunos abajo.
            </p>
          ) : (
            sortedExercises.map((rde, i) => {
              const ex = exerciseMap[rde.exercise_id];
              const isBeingDragged = dragIdx === i;
              const isDragTarget = dragOverIdx === i && dragIdx !== i;
              const sets = predefinedSets[rde.id] ?? [];
              const nextRde = sortedExercises[i + 1];
              const isGroupedWithNext =
                rde.group_id && nextRde?.group_id === rde.group_id;
              const barColor = rde.group_id ? (groupColors[rde.group_id] ?? "bg-primary") : "";

              return (
                <div key={rde.id}>
                  {/* Group name badge at start of a group */}
                  {rde.group_id &&
                    (i === 0 || sortedExercises[i - 1]?.group_id !== rde.group_id) && (
                      <div className="flex items-center gap-1 mb-1 ml-3">
                        <div className={`w-2 h-2 rounded-full ${barColor}`} />
                        {renamingGroupId === rde.group_id ? (
                          <input
                            autoFocus
                            value={groupNameInput}
                            onChange={(e) => setGroupNameInput(e.target.value)}
                            onBlur={handleSaveGroupName}
                            onKeyDown={(e) => e.key === "Enter" && handleSaveGroupName()}
                            className="rounded border px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                            aria-label="Nombre del grupo"
                          />
                        ) : (
                          <span
                            className="text-xs text-muted-foreground cursor-pointer hover:text-foreground"
                            onClick={() =>
                              editMode &&
                              handleStartRenameGroup(
                                rde.group_id!,
                                rde.group_name ?? "Superset"
                              )
                            }
                            title={editMode ? "Clic para renombrar" : undefined}
                          >
                            {rde.group_name ?? "Superset"}
                          </span>
                        )}
                      </div>
                    )}

                  <div
                    draggable={editMode}
                    onDragStart={() => setDragIdx(i)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i); }}
                    onDragEnd={handleExDragEnd}
                    className={[
                      "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-opacity",
                      isBeingDragged ? "opacity-40" : "",
                      isDragTarget ? "ring-2 ring-primary" : "",
                      editMode ? "cursor-grab active:cursor-grabbing" : "",
                    ].join(" ")}
                  >
                    {/* Group color bar */}
                    {rde.group_id && (
                      <div
                        className={`w-1 rounded shrink-0 ${barColor} ${isGroupedWithNext ? "h-full self-stretch" : "h-4"}`}
                      />
                    )}

                    {/* Drag handle icon in edit mode */}
                    {editMode && (
                      <span className="text-muted-foreground/50 text-xs select-none shrink-0" aria-hidden="true">
                        ⠿
                      </span>
                    )}

                    <span className="flex-1 truncate">{ex?.name ?? rde.exercise_id}</span>

                    {/* Predefined sets badge */}
                    <button
                      onClick={() => onOpenPredefinedSets(rde)}
                      className={[
                        "text-xs px-1.5 py-0.5 rounded shrink-0",
                        sets.length > 0
                          ? "bg-primary/10 text-primary hover:bg-primary/20"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                      ].join(" ")}
                      title="Configurar series predefinidas"
                    >
                      {sets.length > 0 ? `${sets.length}s` : "series"}
                    </button>

                    {!editMode && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {ex?.type?.replace(/_/g, " ").toLowerCase()}
                      </span>
                    )}

                    {editMode && (
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Superset link/unlink */}
                        {rde.group_id ? (
                          <button
                            onClick={() => onRemoveFromSuperset(rde.id)}
                            className="text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/30 dark:text-violet-400"
                            title="Quitar del superset"
                            aria-label="Quitar del superset"
                          >
                            ✕ grupo
                          </button>
                        ) : nextRde ? (
                          <button
                            onClick={() => onCreateSuperset(rde.id, nextRde.id)}
                            className="text-xs px-1.5 py-0.5 rounded border hover:bg-secondary text-muted-foreground"
                            title="Agrupar con siguiente ejercicio"
                            aria-label="Agrupar con siguiente ejercicio"
                          >
                            🔗
                          </button>
                        ) : null}

                        {/* Remove exercise */}
                        <button
                          onClick={() => onRemoveExercise(rde.id)}
                          className="text-destructive hover:text-destructive/70 text-xs"
                          aria-label={`Quitar ${ex?.name ?? "ejercicio"} del día`}
                        >
                          <span aria-hidden="true">✕</span>
                        </button>
                      </div>
                    )}
                  </div>
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
                    <option value="">Seleccionar ejercicio…</option>
                    {allExercises.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddExercise}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Añadir
                  </button>
                  <button
                    onClick={() => setShowAddEx(false)}
                    className="rounded-md border px-3 py-1.5 text-xs hover:bg-secondary"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddEx(true)}
                  className="w-full rounded-md border border-dashed py-2 text-xs text-muted-foreground hover:bg-secondary/50"
                >
                  + Añadir ejercicio
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
