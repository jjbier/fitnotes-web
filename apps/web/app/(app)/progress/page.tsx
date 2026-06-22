"use client";

import { useEffect, useState, useCallback } from "react";
import { useProgressStore, useExerciseStore, calculate1RM } from "@fitnotes/core";
import { createBrowserClient, createProgressRepository, createExerciseRepository } from "@fitnotes/database";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import type { ExerciseType } from "@fitnotes/core";

type ChartMetric = "maxWeight" | "totalVolume" | "maxReps";

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
  const [activeTab, setActiveTab] = useState<"records" | "chart" | "history">("records");
  const [metric, setMetric] = useState<ChartMetric>("maxWeight");

  const client = createBrowserClient();
  const progressRepo = createProgressRepository(client);
  const exRepo = createExerciseRepository(client);

  useEffect(() => {
    async function init() {
      const [catRes, exRes] = await Promise.all([exRepo.getCategories(), exRepo.getExercises()]);
      if (catRes.data && exRes.data) {
        loadExercises(catRes.data, exRes.data.map((ex) => ({
          id: ex.id, name: ex.name, category_id: ex.category_id ?? "",
          type: ex.type as ExerciseType, weight_unit: ex.weight_unit as "kg" | "lb",
          notes: ex.notes ?? undefined, is_favorite: ex.is_favorite, created_at: ex.created_at,
        })));
      }
      setLoading(true);
      const { data } = await progressRepo.getAllPersonalRecords();
      if (data) loadPersonalRecords(data.map((r) => ({ id: r.id, exercise_id: r.exercise_id, reps: r.reps, weight: r.weight, achieved_at: r.achieved_at })));
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
      current[exerciseId] = prRes.data.map((r) => ({ id: r.id, exercise_id: r.exercise_id, reps: r.reps, weight: r.weight, achieved_at: r.achieved_at }));
      loadPersonalRecords(Object.values(current).flat());
    }
    loadChartData(exerciseId, chartRes);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleExerciseChange(id: string) {
    setSelectedExId(id);
    setActiveTab("records");
    if (id) loadExerciseData(id);
  }

  const exPRs = selectedExId ? (personalRecords[selectedExId] ?? []).slice().sort((a, b) => a.reps - b.reps) : [];
  const exChartData = selectedExId ? (chartData[selectedExId] ?? []) : [];
  const selectedExercise = exercises.find((e) => e.id === selectedExId);

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
            <p className="text-sm text-muted-foreground text-center py-6">Sin récords personales aún. Completa series para que se registren automáticamente.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(personalRecords).map(([exId, prs]) => {
                const ex = exercises.find((e) => e.id === exId);
                const best = prs.reduce((top, r) => calculate1RM(r.weight, r.reps) > calculate1RM(top.weight, top.reps) ? r : top, prs[0]!);
                return (
                  <button
                    key={exId}
                    onClick={() => handleExerciseChange(exId)}
                    className="w-full flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2 text-sm hover:bg-secondary"
                  >
                    <span className="font-medium">{ex?.name ?? exId}</span>
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
            {(["records", "chart", "history"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium ${activeTab === tab ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tab === "records" ? "Récords" : tab === "chart" ? "Gráfica" : "Historial"}
              </button>
            ))}
          </div>

          {/* Records tab */}
          {activeTab === "records" && (
            <div className="space-y-2">
              {exPRs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin récords para este ejercicio aún.</p>
              ) : (
                exPRs.map((pr) => (
                  <div key={pr.id} className="flex items-center justify-between rounded-md border px-4 py-3 text-sm">
                    <div>
                      <span className="font-medium">Máx. {pr.reps} rep</span>
                      <span className="ml-2 text-muted-foreground">{pr.weight} kg</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground">1RM est. </span>
                      <span className="font-semibold text-primary">{calculate1RM(pr.weight, pr.reps).toFixed(1)} kg</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Chart tab */}
          {activeTab === "chart" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {(["maxWeight", "totalVolume", "maxReps"] as ChartMetric[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMetric(m)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${metric === m ? "bg-primary text-primary-foreground border-primary" : "hover:bg-secondary"}`}
                  >
                    {metricLabel[m]}
                  </button>
                ))}
              </div>

              {exChartData.length === 0 ? (
                <div className="rounded-lg border border-dashed h-48 flex items-center justify-center text-sm text-muted-foreground">
                  Sin datos aún. Completa series para ver tu progreso.
                </div>
              ) : (
                <div className="rounded-lg border bg-card p-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={exChartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} width={40} />
                      <Tooltip
                        labelFormatter={(l) => String(l)}
                        formatter={(v) => [String(v), metricLabel[metric]]}
                      />
                      <Line
                        type="monotone"
                        dataKey={metric}
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#6366f1" }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* History tab */}
          {activeTab === "history" && (
            <div className="space-y-2">
              {exChartData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin historial de entrenamientos para este ejercicio.</p>
              ) : (
                exChartData.slice().reverse().map((point) => (
                  <div key={point.date} className="flex items-center justify-between rounded-md border px-4 py-3 text-sm">
                    <span className="font-medium">{point.date}</span>
                    <div className="flex gap-4 text-muted-foreground text-xs">
                      <span>{point.maxWeight} kg máx.</span>
                      <span>{point.totalVolume.toFixed(0)} kg vol.</span>
                      <span>{point.maxReps} reps máx.</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
