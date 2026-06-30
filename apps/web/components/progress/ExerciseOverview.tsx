"use client";

import { useCallback, useEffect, useState } from "react";
import type { Exercise, PersonalRecord } from "@fitnotes/core";
import { calculate1RM } from "@fitnotes/core";
import {
  createBrowserClient,
  createProgressRepository,
  createWorkoutRepository,
  createGoalsRepository,
} from "@fitnotes/database";
import type { ChartPoint, ExerciseGoalRow } from "@fitnotes/database";
import ProgressChart from "./ProgressChart";
import PersonalRecords from "./PersonalRecords";

type Tab = "records" | "chart" | "history" | "goals";

type HistorySet = {
  id: string;
  order_index: number;
  is_complete: boolean;
  is_warmup: boolean | null;
  weight: number | null;
  reps: number | null;
  distance: number | null;
  time_seconds: number | null;
};

interface ExerciseOverviewProps {
  exercise: Exercise;
  exercises: Exercise[];
  userId: string;
  onClose: () => void;
}

export default function ExerciseOverview({ exercise, exercises, userId, onClose }: ExerciseOverviewProps) {
  const [activeTab, setActiveTab] = useState<Tab>("records");
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [historySets, setHistorySets] = useState<Record<string, HistorySet[]>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);

  const [goal, setGoal] = useState<ExerciseGoalRow | null>(null);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalForm, setGoalForm] = useState({ target_weight: "", target_reps: "", target_date: "", notes: "" });
  const [goalSaving, setGoalSaving] = useState(false);

  const client = createBrowserClient();
  const progressRepo = createProgressRepository(client);
  const workoutRepo = createWorkoutRepository(client);
  const goalsRepo = createGoalsRepository(client);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const [prRes, chartRes, goalsRes] = await Promise.all([
        progressRepo.getPersonalRecords(exercise.id),
        progressRepo.getChartData(exercise.id),
        goalsRepo.getGoals(),
      ]);
      if (prRes.data) {
        setRecords(prRes.data.map((r) => ({
          id: r.id, exercise_id: r.exercise_id, reps: r.reps,
          weight: r.weight, achieved_at: r.achieved_at,
        })));
      }
      setChartData(chartRes);
      const found = goalsRes.find((g) => g.exercise_id === exercise.id);
      setGoal(found ?? null);
      setIsLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  const handleExpandDate = useCallback(async (date: string) => {
    if (expandedDate === date) { setExpandedDate(null); return; }
    setExpandedDate(date);
    if (historySets[date]) return;
    setHistoryLoading(date);
    const { data: workout } = await workoutRepo.getWorkoutByDate(date);
    if (workout) {
      const { data: wes } = await workoutRepo.getWorkoutExercises(workout.id);
      const we = (wes ?? []).find((w) => w.exercise_id === exercise.id);
      if (we) {
        const { data: sets } = await workoutRepo.getSets(we.id);
        setHistorySets((prev) => ({
          ...prev,
          [date]: (sets ?? []).map((s) => ({
            id: s.id, order_index: s.order_index, is_complete: s.is_complete,
            is_warmup: s.is_warmup ?? null,
            weight: s.weight ?? null, reps: s.reps ?? null,
            distance: s.distance ?? null, time_seconds: s.time_seconds ?? null,
          })),
        }));
      } else {
        setHistorySets((prev) => ({ ...prev, [date]: [] }));
      }
    }
    setHistoryLoading(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedDate, historySets, exercise.id]);

  async function handleSaveGoal() {
    if (!userId) return;
    setGoalSaving(true);
    const saved = await goalsRepo.upsertGoal({
      exercise_id: exercise.id,
      target_weight: goalForm.target_weight ? parseFloat(goalForm.target_weight) : undefined,
      target_reps: goalForm.target_reps ? parseInt(goalForm.target_reps, 10) : undefined,
      target_date: goalForm.target_date || undefined,
      notes: goalForm.notes || undefined,
    }, userId);
    if (saved) setGoal(saved);
    setShowGoalForm(false);
    setGoalSaving(false);
  }

  async function handleDeleteGoal() {
    await goalsRepo.deleteGoal(exercise.id);
    setGoal(null);
    setShowGoalForm(false);
  }

  async function handleMarkAchieved() {
    await goalsRepo.markAchieved(exercise.id);
    setGoal((g) => g ? { ...g, achieved_at: new Date().toISOString() } : g);
  }

  function openGoalForm(existing?: ExerciseGoalRow) {
    setGoalForm({
      target_weight: existing?.target_weight?.toString() ?? "",
      target_reps: existing?.target_reps?.toString() ?? "",
      target_date: existing?.target_date ?? "",
      notes: existing?.notes ?? "",
    });
    setShowGoalForm(true);
  }

  const exPRs = records.filter((r) => r.exercise_id === exercise.id);
  const bestWeight = exPRs.length > 0 ? Math.max(...exPRs.map((p) => p.weight)) : 0;
  const bestReps = exPRs.length > 0 ? Math.max(...exPRs.map((p) => p.reps)) : 0;
  const best1RM = exPRs.length > 0 ? Math.max(...exPRs.map((p) => calculate1RM(p.weight, p.reps))) : 0;
  const totalSessions = chartData.length;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-background shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-bold text-lg leading-tight truncate">{exercise.name}</h2>
            {!isLoading && (
              <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                {best1RM > 0 && (
                  <span>1RM est. <span className="font-semibold text-foreground">{best1RM.toFixed(1)} kg</span></span>
                )}
                {bestWeight > 0 && (
                  <span>Mejor <span className="font-semibold text-foreground">{bestWeight} kg</span></span>
                )}
                {totalSessions > 0 && (
                  <span><span className="font-semibold text-foreground">{totalSessions}</span> sesiones</span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-md p-1.5 hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b px-4 pt-2">
          {(["records", "chart", "history", "goals"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "records" ? "Récords" : tab === "chart" ? "Gráfica" : tab === "history" ? "Historial" : "Objetivo"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-secondary/30 animate-pulse" />)}
            </div>
          ) : activeTab === "records" ? (
            <PersonalRecords records={records} exercises={exercises} selectedExercise={exercise} />
          ) : activeTab === "chart" ? (
            <ProgressChart data={chartData} exerciseName={exercise.name} />
          ) : activeTab === "history" ? (
            <div className="space-y-2">
              {chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin historial para este ejercicio.</p>
              ) : (
                chartData.slice().reverse().map((point) => {
                  const isExpanded = expandedDate === point.date;
                  const isLoadingThis = historyLoading === point.date;
                  const sets = historySets[point.date] ?? [];
                  return (
                    <div key={point.date} className="rounded-md border text-sm overflow-hidden">
                      <button
                        onClick={() => handleExpandDate(point.date)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 text-left"
                      >
                        <span className="font-medium flex-1">{point.date}</span>
                        <div className="flex gap-3 text-muted-foreground text-xs">
                          {point.maxWeight > 0 && <span>{point.maxWeight} kg</span>}
                          {point.totalVolume > 0 && <span>{point.totalVolume.toFixed(0)} vol.</span>}
                          {point.maxReps > 0 && <span>{point.maxReps} reps</span>}
                        </div>
                        <span className="text-muted-foreground text-xs">{isExpanded ? "▲" : "▼"}</span>
                      </button>
                      {isExpanded && (
                        <div className="border-t px-4 pb-3 pt-2 space-y-1.5 bg-secondary/10">
                          {isLoadingThis ? (
                            <div className="space-y-1 py-1">
                              {[1, 2, 3].map((i) => <div key={i} className="h-7 rounded bg-secondary/40 animate-pulse" />)}
                            </div>
                          ) : sets.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">Sin series registradas.</p>
                          ) : (
                            sets.map((s, idx) => (
                              <div
                                key={s.id}
                                className={`flex items-center gap-2 rounded-md px-3 py-2 ${s.is_complete ? "bg-primary/5" : "bg-secondary/30"}`}
                              >
                                <span className="text-xs text-muted-foreground w-5 shrink-0">{idx + 1}</span>
                                <span className="flex-1 text-xs">
                                  {s.weight != null && s.reps != null && `${s.weight} kg × ${s.reps}`}
                                  {s.weight != null && s.reps == null && `${s.weight} kg`}
                                  {s.weight == null && s.reps != null && `${s.reps} reps`}
                                  {s.distance != null && `${s.distance} km`}
                                  {s.time_seconds != null && ` · ${s.time_seconds} s`}
                                  {s.is_warmup && <span className="ml-1 text-muted-foreground">(calent.)</span>}
                                </span>
                                {s.is_complete && <span className="text-xs text-primary shrink-0">✓</span>}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Goals tab */
            <div className="space-y-4">
              {goal && !showGoalForm ? (
                <div className="rounded-lg border bg-card p-5 space-y-4">
                  {goal.achieved_at && (
                    <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                      <span>🏆</span>
                      <span>
                        Objetivo conseguido el{" "}
                        {new Date(goal.achieved_at).toLocaleDateString("es-ES", {
                          day: "numeric", month: "long", year: "numeric",
                        })}
                      </span>
                    </div>
                  )}

                  {goal.target_weight && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Peso objetivo</span>
                        <span className="text-muted-foreground">{bestWeight} / {goal.target_weight} kg</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min((bestWeight / goal.target_weight) * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        {((bestWeight / goal.target_weight) * 100).toFixed(0)}% completado
                      </p>
                    </div>
                  )}

                  {goal.target_reps && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Reps objetivo</span>
                        <span className="text-muted-foreground">{bestReps} / {goal.target_reps} reps</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min((bestReps / goal.target_reps) * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        {((bestReps / goal.target_reps) * 100).toFixed(0)}% completado
                      </p>
                    </div>
                  )}

                  {goal.target_date && (
                    <p className="text-sm text-muted-foreground">
                      Fecha límite:{" "}
                      {new Date(goal.target_date).toLocaleDateString("es-ES", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </p>
                  )}
                  {goal.notes && <p className="text-sm text-muted-foreground italic">{goal.notes}</p>}

                  <div className="flex gap-2 pt-1 flex-wrap">
                    <button
                      onClick={() => openGoalForm(goal)}
                      className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
                    >
                      Editar
                    </button>
                    {!goal.achieved_at && (
                      <button
                        onClick={handleMarkAchieved}
                        className="rounded-md border border-green-600 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                      >
                        Marcar conseguido
                      </button>
                    )}
                    <button
                      onClick={handleDeleteGoal}
                      className="ml-auto rounded-md border border-destructive px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ) : !showGoalForm ? (
                <div className="rounded-lg border border-dashed p-10 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">Sin objetivo para este ejercicio.</p>
                  <button
                    onClick={() => openGoalForm()}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Crear objetivo
                  </button>
                </div>
              ) : null}

              {showGoalForm && (
                <div className="rounded-lg border bg-card p-5 space-y-4">
                  <h3 className="font-semibold text-sm">{goal ? "Editar objetivo" : "Nuevo objetivo"}</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="ov-goal-weight" className="text-xs font-medium text-muted-foreground">
                        Peso objetivo (kg)
                      </label>
                      <input
                        id="ov-goal-weight"
                        type="number" min="0" step="0.5"
                        value={goalForm.target_weight}
                        onChange={(e) => setGoalForm((f) => ({ ...f, target_weight: e.target.value }))}
                        placeholder="ej. 100"
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label htmlFor="ov-goal-reps" className="text-xs font-medium text-muted-foreground">
                        Reps objetivo
                      </label>
                      <input
                        id="ov-goal-reps"
                        type="number" min="0"
                        value={goalForm.target_reps}
                        onChange={(e) => setGoalForm((f) => ({ ...f, target_reps: e.target.value }))}
                        placeholder="ej. 10"
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="ov-goal-date" className="text-xs font-medium text-muted-foreground">
                      Fecha límite (opcional)
                    </label>
                    <input
                      id="ov-goal-date"
                      type="date"
                      value={goalForm.target_date}
                      onChange={(e) => setGoalForm((f) => ({ ...f, target_date: e.target.value }))}
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <div>
                    <label htmlFor="ov-goal-notes" className="text-xs font-medium text-muted-foreground">
                      Notas (opcional)
                    </label>
                    <textarea
                      id="ov-goal-notes"
                      value={goalForm.notes}
                      onChange={(e) => setGoalForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      placeholder="Motivación, contexto…"
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowGoalForm(false)}
                      className="rounded-md border px-4 py-2 text-sm hover:bg-secondary"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveGoal}
                      disabled={goalSaving || (!goalForm.target_weight && !goalForm.target_reps)}
                      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {goalSaving ? "Guardando…" : "Guardar objetivo"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
