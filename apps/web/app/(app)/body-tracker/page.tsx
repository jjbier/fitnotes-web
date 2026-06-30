"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useBodyTrackerStore, GoalType } from "@fitnotes/core";
import { createBrowserClient, createBodyTrackerRepository } from "@fitnotes/database";
import type { BodyMeasurementEntry } from "@fitnotes/core";

interface HistoryEntry {
  id: string;
  measurement_id: string;
  value: number;
  recorded_at: string;
  comment: string | null;
}

export default function BodyTrackerPage() {
  const measurements = useBodyTrackerStore((s) => s.measurements);
  const latestEntries = useBodyTrackerStore((s) => s.latestEntries);
  const chartData = useBodyTrackerStore((s) => s.chartData);
  const isLoading = useBodyTrackerStore((s) => s.isLoading);
  const loadMeasurements = useBodyTrackerStore((s) => s.loadMeasurements);
  const setLatestEntry = useBodyTrackerStore((s) => s.setLatestEntry);
  const loadChartData = useBodyTrackerStore((s) => s.loadChartData);
  const addEntry = useBodyTrackerStore((s) => s.addEntry);
  const setLoading = useBodyTrackerStore((s) => s.setLoading);

  const [userId, setUserId] = useState("");
  const [tab, setTab] = useState<"track" | "history" | "chart">("track");
  const [logMeasurementId, setLogMeasurementId] = useState("");
  const [logValue, setLogValue] = useState("");
  const [logComment, setLogComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [chartMeasurementId, setChartMeasurementId] = useState("");
  const [chartLoading, setChartLoading] = useState(false);

  const client = createBrowserClient();
  const repo = createBodyTrackerRepository(client);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await client.auth.getUser();
      if (user) setUserId(user.id);

      const { data: mData } = await repo.getMeasurements();
      if (mData) {
        loadMeasurements(mData.map((m) => ({
          id: m.id, name: m.name, unit: m.unit,
          goal_type: m.goal_type as GoalType,
          goal_value: m.goal_value ?? undefined,
          is_enabled: m.is_enabled,
          is_default: m.is_default,
        })));
        await Promise.all(mData.filter((m) => m.is_enabled).map(async (m) => {
          const { data: entries } = await repo.getEntries(m.id, 1);
          if (entries && entries[0]) {
            setLatestEntry({
              id: entries[0].id,
              measurement_id: entries[0].measurement_id,
              value: entries[0].value,
              comment: entries[0].comment ?? undefined,
              recorded_at: entries[0].recorded_at,
            });
          }
        }));
      }
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab !== "chart" || !chartMeasurementId || chartData[chartMeasurementId]) return;
    async function loadChart() {
      setChartLoading(true);
      const { data } = await repo.getEntries(chartMeasurementId, 200);
      if (data) {
        loadChartData(chartMeasurementId, data.map((e) => ({
          id: e.id,
          measurement_id: e.measurement_id,
          value: e.value,
          comment: e.comment ?? undefined,
          recorded_at: e.recorded_at,
        })));
      }
      setChartLoading(false);
    }
    loadChart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, chartMeasurementId]);

  async function loadHistory() {
    if (historyLoaded) return;
    const { data } = await repo.getAllEntries(userId);
    if (data) {
      setHistoryEntries(data as HistoryEntry[]);
      setHistoryLoaded(true);
    }
  }

  async function handleLog(e: React.FormEvent) {
    e.preventDefault();
    if (!logMeasurementId || !logValue) return;
    setSaving(true);
    const { data, error } = await repo.addEntry({
      measurement_id: logMeasurementId,
      value: parseFloat(logValue),
      comment: logComment || undefined,
    }, userId);
    if (!error && data) {
      const entry: BodyMeasurementEntry = {
        id: data.id,
        measurement_id: data.measurement_id,
        value: data.value,
        comment: data.comment ?? undefined,
        recorded_at: data.recorded_at,
      };
      addEntry(entry);
      setHistoryLoaded(false);
      setLogValue("");
      setLogComment("");
      setLogMeasurementId("");
    }
    setSaving(false);
  }

  const enabledMeasurements = measurements.filter((m) => m.is_enabled);

  const chartPoints = (chartData[chartMeasurementId] ?? [])
    .slice()
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
    .map((e) => ({
      date: e.recorded_at.slice(0, 10),
      value: e.value,
    }));

  const selectedMeasurement = measurements.find((m) => m.id === chartMeasurementId);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Medidas corporales</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/body-tracker/settings"
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
          >
            Configuración
          </Link>
          <div role="tablist" aria-label="Secciones de medidas" className="flex gap-1 rounded-lg border p-1">
            {(["track", "history", "chart"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => { setTab(t); if (t === "history") loadHistory(); }}
                className={`rounded-md px-3 py-1 text-sm font-medium ${tab === t ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
              >
                {t === "track" ? "Registrar" : t === "history" ? "Historial" : "Gráfica"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Registrar tab */}
      {tab === "track" && (
        <>
          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-lg border bg-secondary/30 animate-pulse" />)}
            </div>
          ) : enabledMeasurements.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
              No hay medidas activas.{" "}
              <Link href="/body-tracker/settings" className="underline text-primary">
                Añade algunas en la configuración.
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {enabledMeasurements.map((m) => {
                const latest = latestEntries[m.id];
                return (
                  <div key={m.id} className="rounded-lg border bg-card p-5">
                    <div className="flex items-center justify-between mb-1">
                      <h2 className="font-semibold text-sm">{m.name}</h2>
                      <span className="text-xs text-muted-foreground">{m.unit}</span>
                    </div>
                    <p className="text-3xl font-bold">{latest ? latest.value : "—"}</p>
                    {latest && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(latest.recorded_at).toLocaleDateString()}
                      </p>
                    )}
                    <button
                      onClick={() => setLogMeasurementId(m.id)}
                      className="mt-3 rounded-md border px-3 py-1 text-xs hover:bg-secondary"
                    >
                      Registrar
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {logMeasurementId && (
            <div className="rounded-lg border bg-card p-5">
              <h2 className="text-sm font-semibold mb-4">
                Registrar {measurements.find((m) => m.id === logMeasurementId)?.name}
              </h2>
              <form onSubmit={handleLog} className="space-y-3">
                <div className="flex gap-2">
                  <label htmlFor="log-value" className="sr-only">
                    Valor ({measurements.find((m) => m.id === logMeasurementId)?.unit ?? "Valor"})
                  </label>
                  <input
                    id="log-value"
                    type="number"
                    value={logValue}
                    onChange={(e) => setLogValue(e.target.value)}
                    placeholder={measurements.find((m) => m.id === logMeasurementId)?.unit ?? "Valor"}
                    step="0.1"
                    autoFocus
                    className="w-32 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <label htmlFor="log-comment" className="sr-only">Comentario (opcional)</label>
                  <input
                    id="log-comment"
                    type="text"
                    value={logComment}
                    onChange={(e) => setLogComment(e.target.value)}
                    placeholder="Comentario (opcional)"
                    className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setLogMeasurementId("")} className="rounded-md border px-4 py-2 text-sm hover:bg-secondary">Cancelar</button>
                  <button type="submit" disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {saving ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}

      {/* Historial tab */}
      {tab === "history" && (
        <div className="space-y-2">
          {historyEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin registros aún.</p>
          ) : (
            historyEntries.map((entry) => {
              const m = measurements.find((m) => m.id === entry.measurement_id);
              return (
                <div key={entry.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{m?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(entry.recorded_at).toLocaleDateString()}</p>
                    {entry.comment && <p className="text-xs text-muted-foreground">{entry.comment}</p>}
                  </div>
                  <p className="text-sm font-semibold">{entry.value} {m?.unit}</p>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Gráfica tab */}
      {tab === "chart" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label htmlFor="chart-measure" className="text-sm font-medium shrink-0">Medida:</label>
            <select
              id="chart-measure"
              value={chartMeasurementId}
              onChange={(e) => setChartMeasurementId(e.target.value)}
              className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring flex-1 max-w-xs"
            >
              <option value="">Seleccionar medida…</option>
              {enabledMeasurements.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {!chartMeasurementId ? (
            <div className="rounded-lg border border-dashed p-16 text-center text-muted-foreground text-sm">
              Selecciona una medida para ver la gráfica.
            </div>
          ) : chartLoading ? (
            <div className="h-64 rounded-lg border bg-secondary/30 animate-pulse" />
          ) : chartPoints.length < 2 ? (
            <div className="rounded-lg border border-dashed p-16 text-center text-muted-foreground text-sm">
              {chartPoints.length === 0 ? "Sin datos registrados para esta medida." : "Necesitas al menos 2 registros para ver la gráfica."}
            </div>
          ) : (
            <div className="rounded-lg border bg-card p-5">
              <p className="text-sm font-semibold mb-4">
                {selectedMeasurement?.name} ({selectedMeasurement?.unit})
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartPoints} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => {
                      const [, m, d] = v.split("-");
                      return `${d}/${m}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} width={45} />
                  <Tooltip
                    formatter={(v: number) => [`${v} ${selectedMeasurement?.unit}`, selectedMeasurement?.name ?? ""]}
                    labelFormatter={(l: string) => new Date(l).toLocaleDateString()}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    className="stroke-primary"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
