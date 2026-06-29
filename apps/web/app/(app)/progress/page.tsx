"use client";

import { useEffect, useState, useCallback } from "react";
import { useProgressStore, useExerciseStore, calculate1RM, estimateRepMax } from "@fitnotes/core";
import {
  createBrowserClient, createProgressRepository,
  createExerciseRepository, createGoalsRepository,
  createWorkoutRepository,
} from "@fitnotes/database";
import type { ExerciseGoalRow } from "@fitnotes/database";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import type { ExerciseType } from "@fitnotes/core";

type ChartMetric = "maxWeight" | "totalVolume" | "maxReps";
type Tab = "records" | "chart" | "history" | "goals";

function linearRegression(values: number[]): number[] {
  const n = values.length;
  if (n < 2) return [...values];
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((s, v) => s + v, 0) / n;
  const num = values.reduce((s, v, i) => s + (i - xMean) * (v - yMean), 0);
  const den = values.reduce((s, _, i) => s + Math.pow(i - xMean, 2), 0);
  if (den === 0) return values.map(() => parseFloat(yMean.toFixed(2)));
  const slope = num / den;
  const intercept = yMean - slope * xMean;
  return values.map((_, i) => parseFloat((slope * i + intercept).toFixed(2)));
}

export default function ProgressPage() {
  const personalRecords = useProgressStore((s) => s.personalRecords);
  const chartData = useProgressStore((s) => s.chartData);
  const isLoading = useProgressStore((s) => s.isLoading);
  const loadPersonalRecords = useProgressStore((s) => s.loadPersonalRecords);
  const loadChartData = useProgressStore((s) => s.loadChartData);
  const setLoading = useProgressStore((s) => s.setLoading);

  const exercises = useExerciseStore((s) => s.exercises);
  const loadExercises = useExerciseStore((s) => s.loadExercises);

  const [selectedExId, setSelectedExId] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("records");
  const [metric, setMetric] = useState<ChartMetric>("maxWeight");
  const [showTrend, setShowTrend] = useState(false);
  const [prSubTab, setPrSubTab] = useState<"real" | "estimado">("real");

  type HistorySet = {
    id: string; order_index: number; is_complete: boolean; is_warmup: boolean | null;
    weight: number | null; reps: number | null; distance: number | null; time_seconds: number | null;
  };
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [historySets, setHistorySets] = useState<Record<string, HistorySet[]>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ weight: "", reps: "", distance: "", time_seconds: "" });

  const [goals, setGoals] = useState<ExerciseGoalRow[]>([]);
  const [goalSaving, setGoalSaving] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalForm, setGoalForm] = useState({ target_weight: "", target_reps: "", target_date: "", notes: "" });
  const [userId, setUserId] = useState("");

  const client = createBrowserClient();
  const progressRepo = createProgressRepository(client);
  const exRepo = createExerciseRepository(client);
  const goalsRepo = createGoalsRepository(client);
  const workoutRepo = createWorkoutRepository(client);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await client.auth.getUser();
      if (user) setUserId(user.id);

      const [catRes, exRes] = await Promise.all([exRepo.getCategories(), exRepo.getExercises()]);
      if (catRes.data && exRes.data) {
        loadExercises(catRes.data, exRes.data.map((ex) => ({
          id: ex.id, name: ex.name, category_id: ex.category_id ?? "",
          type: ex.type as ExerciseType, weight_unit: ex.weight_unit as "kg" | "lb",
          notes: ex.notes ?? undefined, is_favorite: ex.is_favorite, created_at: ex.created_at,
        })));
      }
      setLoading(true);
      const [prRes, goalsRes] = await Promise.all([
        progressRepo.getAllPersonalRecords(),
        goalsRepo.getGoals(),
      ]);
      if (prRes.data) {
        loadPersonalRecords(prRes.data.map((r) => ({
          id: r.id, exercise_id: r.exercise_id, reps: r.reps, weight: r.weight, achieved_at: r.achieved_at,
        })));
      }
      setGoals(goalsRes);
      setLoading(false);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadExerciseData = useCallback(async (exerciseId: string) => {
    setLoading(true);
    const [prRes, chartRes] = await Promise.all([
      progressRepo.getPersonalRecords(exerciseId),
      progressRepo.getChartData(exerciseId),
    ]);
    if (prRes.data) {
      const current = { ...useProgressStore.getState().personalRecords };
      current[exerciseId] = prRes.data.map((r) => ({
        id: r.id, exercise_id: r.exercise_id, reps: r.reps, weight: r.weight, achieved_at: r.achieved_at,
      }));
      loadPersonalRecords(Object.values(current).flat());
    }
    loadChartData(exerciseId, chartRes);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleExerciseChange(id: string) {
    setSelectedExId(id);
    setActiveTab("records");
    setPrSubTab("real");
    setShowGoalForm(false);
    if (id) loadExerciseData(id);
  }

  async function handleSaveGoal() {
    if (!selectedExId || !userId) return;
    setGoalSaving(true);
    const saved = await goalsRepo.upsertGoal({
      exercise_id: selectedExId,
      target_weight: goalForm.target_weight ? parseFloat(goalForm.target_weight) : undefined,
      target_reps: goalForm.target_reps ? parseInt(goalForm.target_reps, 10) : undefined,
      target_date: goalForm.target_date || undefined,
      notes: goalForm.notes || undefined,
    }, userId);
    if (saved) {
      setGoals((prev) => {
        const filtered = prev.filter((g) => g.exercise_id !== selectedExId);
        return [...filtered, saved];
      });
    }
    setShowGoalForm(false);
    setGoalSaving(false);
  }

  async function handleDeleteGoal(exerciseId: string) {
    await goalsRepo.deleteGoal(exerciseId);
    setGoals((prev) => prev.filter((g) => g.exercise_id !== exerciseId));
    setShowGoalForm(false);
  }

  async function handleMarkAchieved(exerciseId: string) {
    await goalsRepo.markAchieved(exerciseId);
    setGoals((prev) => prev.map((g) =>
      g.exercise_id === exerciseId ? { ...g, achieved_at: new Date().toISOString() } : g
    ));
  }

  async function handleExpandDate(date: string) {
    if (expandedDate === date) { setExpandedDate(null); return; }
    setExpandedDate(date);
    if (historySets[date]) return;
    setHistoryLoading(date);
    const { data: workout } = await workoutRepo.getWorkoutByDate(date);
    if (workout) {
      const { data: wes } = await workoutRepo.getWorkoutExercises(workout.id);
      const we = (wes ?? []).find((w) => w.exercise_id === selectedExId);
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
  }

  function startEditSet(s: { id: string; weight: number | null; reps: number | null; distance: number | null; time_seconds: number | null }) {
    setEditingSetId(s.id);
    setEditDraft({
      weight: s.weight?.toString() ?? "",
      reps: s.reps?.toString() ?? "",
      distance: s.distance?.toString() ?? "",
      time_seconds: s.time_seconds?.toString() ?? "",
    });
  }

  async function saveEditSet(setId: string, date: string) {
    const patch: Record<string, number | undefined> = {};
    if (editDraft.weight !== "") patch.weight = parseFloat(editDraft.weight);
    if (editDraft.reps !== "") patch.reps = parseInt(editDraft.reps, 10);
    if (editDraft.distance !== "") patch.distance = parseFloat(editDraft.distance);
    if (editDraft.time_seconds !== "") patch.time_seconds = parseInt(editDraft.time_seconds, 10);
    await workoutRepo.updateSet(setId, patch);
    setHistorySets((prev) => ({
      ...prev,
      [date]: (prev[date] ?? []).map((s) =>
        s.id === setId
          ? { ...s, weight: patch.weight ?? s.weight, reps: patch.reps ?? s.reps, distance: patch.distance ?? s.distance, time_seconds: patch.time_seconds ?? s.time_seconds }
          : s
      ),
    }));
    setEditingSetId(null);
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

  const exPRs = selectedExId ? (personalRecords[selectedExId] ?? []).slice().sort((a, b) => a.reps - b.reps) : [];
  const exChartData = selectedExId ? (chartData[selectedExId] ?? []) : [];
  const selectedExercise = exercises.find((e) => e.id === selectedExId);
  const currentGoal = goals.find((g) => g.exercise_id === selectedExId);
  const bestWeight = exPRs.length > 0 ? Math.max(...exPRs.map((p) => p.weight)) : 0;
  const bestReps = exPRs.length > 0 ? Math.max(...exPRs.map((p) => p.reps)) : 0;

  const metricLabel: Record<ChartMetric, string> = {
    maxWeight: "Peso máx. (kg)",
    totalVolume: "Volumen total (kg)",
    maxReps: "Reps máx.",
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Progreso</h1>

      {/* Exercise selector */}
      <div>
        <label className="block text-xs font-medium mb-1 text-muted-foreground">Ejercicio</label>
        <select
          value={selectedExId}
          onChange={(e) => handleExerciseChange(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Seleccionar un ejercicio…</option>
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>{ex.name}</option>
          ))}
        </select>
      </div>

      {!selectedExId ? (
        /* All-exercise PR summary */
        <div className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold mb-4">Todos los récords personales</h2>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded bg-secondary/30 animate-pulse" />)}
            </div>
          ) : Object.keys(personalRecords).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Sin récords personales aún. Completa series para que se registren automáticamente.
            </p>
          ) : (
            <div className="space-y-2">
              {Object.entries(personalRecords).map(([exId, prs]) => {
                const ex = exercises.find((e) => e.id === exId);
                const best = prs.reduce((top, r) =>
                  calculate1RM(r.weight, r.reps) > calculate1RM(top.weight, top.reps) ? r : top, prs[0]!);
                const hasGoal = goals.some((g) => g.exercise_id === exId && !g.achieved_at);
                return (
                  <button
                    key={exId}
                    onClick={() => handleExerciseChange(exId)}
                    className="w-full flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2 text-sm hover:bg-secondary"
                  >
                    <span className="font-medium flex items-center gap-2">
                      {ex?.name ?? exId}
                      {hasGoal && <span className="text-xs text-primary">●</span>}
                    </span>
                    <span className="text-muted-foreground">
                      {best.weight} kg × {best.reps} · est. 1RM {calculate1RM(best.weight, best.reps).toFixed(1)} kg
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-lg">{selectedExercise?.name}</h2>
            {isLoading && <span className="text-xs text-muted-foreground animate-pulse">Cargando…</span>}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 rounded-lg border bg-secondary/30 p-1">
            {(["records", "chart", "history", "goals"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab ? "bg-white shadow-sm dark:bg-secondary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "records" ? "Récords" : tab === "chart" ? "Gráfica" : tab === "history" ? "Historial" : "Objetivos"}
              </button>
            ))}
          </div>

          {/* Records tab */}
          {activeTab === "records" && (
            <div className="space-y-3">
              {/* Sub-tab toggle */}
              <div className="flex rounded-lg border bg-secondary/20 p-0.5 w-fit">
                {(["real", "estimado"] as const).map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setPrSubTab(sub)}
                    className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
                      prSubTab === sub ? "bg-white shadow-sm dark:bg-secondary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {sub === "real" ? "Real" : "Estimado"}
                  </button>
                ))}
              </div>

              {exPRs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin récords para este ejercicio aún.</p>
              ) : prSubTab === "real" ? (
                /* Real: stored PRs per rep count */
                <div className="space-y-2">
                  {exPRs.map((pr) => (
                    <div key={pr.id} className="flex items-center justify-between rounded-md border px-4 py-3 text-sm">
                      <div>
                        <span className="font-medium">{pr.reps} rep{pr.reps !== 1 ? "s" : ""}</span>
                        <span className="ml-2 text-muted-foreground font-semibold">{pr.weight} kg</span>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        1RM est. <span className="font-semibold text-primary">{calculate1RM(pr.weight, pr.reps).toFixed(1)} kg</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Estimado: full 1–12 rep table from best 1RM */
                (() => {
                  const best1RM = Math.max(...exPRs.map((pr) => calculate1RM(pr.weight, pr.reps)));
                  const realRepSet = new Set(exPRs.map((pr) => pr.reps));
                  return (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground mb-2">
                        Basado en 1RM estimado de <span className="font-semibold text-foreground">{best1RM.toFixed(1)} kg</span>
                      </p>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((reps) => {
                        const est = estimateRepMax(best1RM, reps);
                        const isActual = realRepSet.has(reps);
                        const actualPR = exPRs.find((pr) => pr.reps === reps);
                        return (
                          <div
                            key={reps}
                            className={`flex items-center justify-between rounded-md border px-4 py-2.5 text-sm ${isActual ? "border-primary/30 bg-primary/5" : ""}`}
                          >
                            <span className="font-medium flex items-center gap-2">
                              {reps} rep{reps !== 1 ? "s" : ""}
                              {isActual && <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">PR</span>}
                            </span>
                            <div className="text-right">
                              <span className="font-semibold">{est.toFixed(1)} kg</span>
                              {isActual && actualPR && (
                                <span className="ml-2 text-xs text-green-600">real {actualPR.weight} kg</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* Chart tab */}
          {activeTab === "chart" && (
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap items-center">
                {(["maxWeight", "totalVolume", "maxReps"] as ChartMetric[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMetric(m)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${metric === m ? "bg-primary text-primary-foreground border-primary" : "hover:bg-secondary"}`}
                  >
                    {metricLabel[m]}
                  </button>
                ))}
                <button
                  onClick={() => setShowTrend((v) => !v)}
                  className={`ml-auto rounded-full border px-3 py-1 text-xs font-medium ${showTrend ? "bg-orange-500 text-white border-orange-500" : "hover:bg-secondary text-muted-foreground"}`}
                >
                  Tendencia
                </button>
              </div>
              {exChartData.length === 0 ? (
                <div className="rounded-lg border border-dashed h-48 flex items-center justify-center text-sm text-muted-foreground">
                  Sin datos aún. Completa series para ver tu progreso.
                </div>
              ) : (() => {
                const trendValues = showTrend && exChartData.length >= 2
                  ? linearRegression(exChartData.map((p) => p[metric] as number))
                  : null;
                const chartData = trendValues
                  ? exChartData.map((p, i) => ({ ...p, trend: trendValues[i] }))
                  : exChartData;
                return (
                  <div className="rounded-lg border bg-card p-4">
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                        <YAxis tick={{ fontSize: 10 }} width={40} />
                        <Tooltip
                          labelFormatter={(l) => String(l)}
                          formatter={(v, name) => [String(v), name === "trend" ? "Tendencia" : metricLabel[metric]]}
                        />
                        <Line type="monotone" dataKey={metric} stroke="#6366f1" strokeWidth={2}
                          dot={{ r: 3, fill: "#6366f1" }} activeDot={{ r: 5 }} />
                        {trendValues && (
                          <Line type="linear" dataKey="trend" stroke="#f97316" strokeWidth={1.5}
                            strokeDasharray="5 3" dot={false} activeDot={false} />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </div>
          )}

          {/* History tab */}
          {activeTab === "history" && (
            <div className="space-y-2">
              {exChartData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin historial para este ejercicio.</p>
              ) : (
                exChartData.slice().reverse().map((point) => {
                  const isExpanded = expandedDate === point.date;
                  const isLoadingThis = historyLoading === point.date;
                  const sets = historySets[point.date] ?? [];
                  const exType = selectedExercise?.type;
                  return (
                    <div key={point.date} className="rounded-md border text-sm overflow-hidden">
                      {/* Summary row — click to expand */}
                      <button
                        onClick={() => handleExpandDate(point.date)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 text-left"
                      >
                        <span className="font-medium flex-1">{point.date}</span>
                        <div className="flex gap-3 text-muted-foreground text-xs">
                          {point.maxWeight > 0 && <span>{point.maxWeight} kg máx.</span>}
                          {point.totalVolume > 0 && <span>{point.totalVolume.toFixed(0)} kg vol.</span>}
                          {point.maxReps > 0 && <span>{point.maxReps} reps</span>}
                        </div>
                        <span className="text-muted-foreground text-xs ml-1">{isExpanded ? "▲" : "▼"}</span>
                      </button>

                      {/* Expanded sets */}
                      {isExpanded && (
                        <div className="border-t px-4 pb-3 pt-2 space-y-1.5 bg-secondary/10">
                          {isLoadingThis ? (
                            <div className="space-y-1 py-1">
                              {[1, 2, 3].map((i) => <div key={i} className="h-8 rounded bg-secondary/40 animate-pulse" />)}
                            </div>
                          ) : sets.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">Sin series registradas.</p>
                          ) : (
                            sets.map((s, idx) => {
                              const isEditing = editingSetId === s.id;
                              return (
                                <div key={s.id} className={`flex items-center gap-2 rounded-md px-3 py-2 ${s.is_complete ? "bg-primary/5" : "bg-secondary/30"}`}>
                                  <span className="text-xs text-muted-foreground w-5 shrink-0">{idx + 1}</span>
                                  {isEditing ? (
                                    <>
                                      <div className="flex-1 flex items-center gap-2 flex-wrap">
                                        {(exType === "WEIGHT_REPS" || exType === "WEIGHT_ONLY") && (
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number" value={editDraft.weight} min="0" step="0.5"
                                              onChange={(e) => setEditDraft((d) => ({ ...d, weight: e.target.value }))}
                                              className="w-16 rounded border px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-ring"
                                              aria-label="Peso"
                                            />
                                            <span className="text-xs text-muted-foreground">kg</span>
                                          </div>
                                        )}
                                        {(exType === "WEIGHT_REPS" || exType === "REPS_ONLY") && (
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number" value={editDraft.reps} min="0"
                                              onChange={(e) => setEditDraft((d) => ({ ...d, reps: e.target.value }))}
                                              className="w-14 rounded border px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-ring"
                                              aria-label="Reps"
                                            />
                                            <span className="text-xs text-muted-foreground">reps</span>
                                          </div>
                                        )}
                                        {exType === "DISTANCE_TIME" && (
                                          <>
                                            <div className="flex items-center gap-1">
                                              <input type="number" value={editDraft.distance} min="0" step="0.1"
                                                onChange={(e) => setEditDraft((d) => ({ ...d, distance: e.target.value }))}
                                                className="w-16 rounded border px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-ring"
                                                aria-label="Distancia" />
                                              <span className="text-xs text-muted-foreground">km</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <input type="number" value={editDraft.time_seconds} min="0"
                                                onChange={(e) => setEditDraft((d) => ({ ...d, time_seconds: e.target.value }))}
                                                className="w-16 rounded border px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-ring"
                                                aria-label="Tiempo" />
                                              <span className="text-xs text-muted-foreground">s</span>
                                            </div>
                                          </>
                                        )}
                                        {exType === "TIME_ONLY" && (
                                          <div className="flex items-center gap-1">
                                            <input type="number" value={editDraft.time_seconds} min="0"
                                              onChange={(e) => setEditDraft((d) => ({ ...d, time_seconds: e.target.value }))}
                                              className="w-16 rounded border px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-ring"
                                              aria-label="Tiempo" />
                                            <span className="text-xs text-muted-foreground">s</span>
                                          </div>
                                        )}
                                      </div>
                                      <button onClick={() => saveEditSet(s.id, point.date)} className="text-xs font-medium text-primary hover:underline shrink-0">Guardar</button>
                                      <button onClick={() => setEditingSetId(null)} className="text-xs text-muted-foreground hover:text-foreground shrink-0">✕</button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="flex-1 text-xs">
                                        {s.weight != null && s.reps != null && `${s.weight} kg × ${s.reps}`}
                                        {s.weight != null && s.reps == null && `${s.weight} kg`}
                                        {s.weight == null && s.reps != null && `${s.reps} reps`}
                                        {s.distance != null && `${s.distance} km`}
                                        {s.time_seconds != null && ` · ${s.time_seconds} s`}
                                        {s.is_warmup && <span className="ml-1 text-muted-foreground">(calent.)</span>}
                                      </span>
                                      {s.is_complete && <span className="text-xs text-primary shrink-0">✓</span>}
                                      <button
                                        onClick={() => startEditSet(s)}
                                        aria-label="Editar serie"
                                        className="text-muted-foreground hover:text-foreground text-xs shrink-0"
                                      >
                                        ✎
                                      </button>
                                    </>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Goals tab */}
          {activeTab === "goals" && (
            <div className="space-y-4">
              {currentGoal && !showGoalForm ? (
                <div className="rounded-lg border bg-card p-5 space-y-4">
                  {/* Achieved badge */}
                  {currentGoal.achieved_at && (
                    <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                      <span>🏆</span>
                      <span>Objetivo conseguido el {new Date(currentGoal.achieved_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</span>
                    </div>
                  )}

                  {/* Weight progress */}
                  {currentGoal.target_weight && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Peso objetivo</span>
                        <span className="text-muted-foreground">
                          {bestWeight} / {currentGoal.target_weight} kg
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min((bestWeight / currentGoal.target_weight) * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        {((bestWeight / currentGoal.target_weight) * 100).toFixed(0)}% completado
                      </p>
                    </div>
                  )}

                  {/* Reps progress */}
                  {currentGoal.target_reps && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Reps objetivo</span>
                        <span className="text-muted-foreground">
                          {bestReps} / {currentGoal.target_reps} reps
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min((bestReps / currentGoal.target_reps) * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        {((bestReps / currentGoal.target_reps) * 100).toFixed(0)}% completado
                      </p>
                    </div>
                  )}

                  {/* Date & notes */}
                  {currentGoal.target_date && (
                    <p className="text-sm text-muted-foreground">
                      Fecha límite: {new Date(currentGoal.target_date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  )}
                  {currentGoal.notes && (
                    <p className="text-sm text-muted-foreground italic">{currentGoal.notes}</p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => openGoalForm(currentGoal)}
                      className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
                    >
                      Editar
                    </button>
                    {!currentGoal.achieved_at && (
                      <button
                        onClick={() => handleMarkAchieved(selectedExId)}
                        className="rounded-md border border-green-600 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                      >
                        Marcar conseguido
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteGoal(selectedExId)}
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

              {/* Goal form */}
              {showGoalForm && (
                <div className="rounded-lg border bg-card p-5 space-y-4">
                  <h3 className="font-semibold text-sm">{currentGoal ? "Editar objetivo" : "Nuevo objetivo"}</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="goal-weight" className="text-xs font-medium text-muted-foreground">Peso objetivo (kg)</label>
                      <input
                        id="goal-weight"
                        type="number"
                        min="0"
                        step="0.5"
                        value={goalForm.target_weight}
                        onChange={(e) => setGoalForm((f) => ({ ...f, target_weight: e.target.value }))}
                        placeholder="ej. 100"
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label htmlFor="goal-reps" className="text-xs font-medium text-muted-foreground">Reps objetivo</label>
                      <input
                        id="goal-reps"
                        type="number"
                        min="0"
                        value={goalForm.target_reps}
                        onChange={(e) => setGoalForm((f) => ({ ...f, target_reps: e.target.value }))}
                        placeholder="ej. 10"
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="goal-date" className="text-xs font-medium text-muted-foreground">Fecha límite (opcional)</label>
                    <input
                      id="goal-date"
                      type="date"
                      value={goalForm.target_date}
                      onChange={(e) => setGoalForm((f) => ({ ...f, target_date: e.target.value }))}
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <div>
                    <label htmlFor="goal-notes" className="text-xs font-medium text-muted-foreground">Notas (opcional)</label>
                    <textarea
                      id="goal-notes"
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
      )}
    </div>
  );
}
