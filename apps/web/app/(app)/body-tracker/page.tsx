"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useBodyTrackerStore, GoalType } from "@fitnotes/core";
import { createBrowserClient, createBodyTrackerRepository } from "@fitnotes/database";
import type { BodyMeasurementEntry } from "@fitnotes/core";

function formatTimeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "hoy";
  if (days === 1) return "hace 1 día";
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "hace 1 mes" : `hace ${months} meses`;
  const years = Math.floor(months / 12);
  return years === 1 ? "hace 1 año" : `hace ${years} años`;
}

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
  const [logDate, setLogDate] = useState("");
  const [previousEntries, setPreviousEntries] = useState<Record<string, HistoryEntry>>({});
  const [saving, setSaving] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyFilterId, setHistoryFilterId] = useState("");
  const [chartMeasurementId, setChartMeasurementId] = useState("");
  const [chartLoading, setChartLoading] = useState(false);

  const client = createBrowserClient();
  const repo = createBodyTrackerRepository(client);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await client.auth.getUser();
      if (user) {
        setUserId(user.id);
        await repo.seedDefaultMeasurementsIfNeeded(user.id);
      }

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
          const { data: entries } = await repo.getEntries(m.id, 2);
          if (entries && entries[0]) {
            setLatestEntry({
              id: entries[0].id,
              measurement_id: entries[0].measurement_id,
              value: entries[0].value,
              comment: entries[0].comment ?? undefined,
              recorded_at: entries[0].recorded_at,
            });
          }
          if (entries && entries[1]) {
            setPreviousEntries((prev) => ({ ...prev, [m.id]: entries[1] as HistoryEntry }));
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
    const recordedAt = logDate ? `${logDate}T12:00:00` : new Date().toISOString();
    const { data, error } = await repo.addEntry({
      measurement_id: logMeasurementId,
      value: parseFloat(logValue),
      comment: logComment || undefined,
      recorded_at: recordedAt,
    }, userId);
    if (!error && data) {
      const entry: BodyMeasurementEntry = {
        id: data.id,
        measurement_id: data.measurement_id,
        value: data.value,
        comment: data.comment ?? undefined,
        recorded_at: data.recorded_at,
      };
      const priorLatest = latestEntries[logMeasurementId];
      if (priorLatest) {
        setPreviousEntries((prev) => ({ ...prev, [logMeasurementId]: priorLatest as HistoryEntry }));
      }
      addEntry(entry);
      setHistoryLoaded(false);
      setLogValue("");
      setLogComment("");
      setLogDate("");
      setLogMeasurementId("");
    }
    setSaving(false);
  }

  const enabledMeasurements = measurements.filter((m) => m.is_enabled);

  const entriesByMeasurement = useMemo(() => {
    const map: Record<string, HistoryEntry[]> = {};
    for (const e of historyEntries) (map[e.measurement_id] ??= []).push(e);
    return map;
  }, [historyEntries]);

  function deltaColorClassFor(m: { goal_type: GoalType; goal_value?: number } | undefined, current: number, prev: number): string {
    if (!m) return "text-muted-foreground";
    if (m.goal_type === "SPECIFIC" && m.goal_value != null) {
      return Math.abs(current - m.goal_value) <= Math.abs(prev - m.goal_value) ? "text-green-600" : "text-destructive";
    }
    const delta = current - prev;
    return m.goal_type === "DECREASE"
      ? (delta <= 0 ? "text-green-600" : "text-destructive")
      : (delta >= 0 ? "text-green-600" : "text-destructive");
  }

  const filteredHistory = historyFilterId ? historyEntries.filter((e) => e.measurement_id === historyFilterId) : historyEntries;
  const groupedHistory = useMemo(() => {
    const groups: { date: string; entries: HistoryEntry[] }[] = [];
    for (const e of filteredHistory) {
      const date = e.recorded_at.slice(0, 10);
      const last = groups[groups.length - 1];
      if (last && last.date === date) last.entries.push(e);
      else groups.push({ date, entries: [e] });
    }
    return groups;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyEntries, historyFilterId]);

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
                        {formatTimeAgo(latest.recorded_at)}
                      </p>
                    )}
                    {latest && previousEntries[m.id] && (() => {
                      const prev = previousEntries[m.id]!;
                      const delta = latest.value - prev.value;
                      return (
                        <p className={`text-xs font-semibold mt-0.5 ${deltaColorClassFor(m, latest.value, prev.value)}`}>
                          {delta >= 0 ? "+" : ""}{delta % 1 === 0 ? delta : delta.toFixed(1)} {m.unit} vs anterior
                        </p>
                      );
                    })()}
                    <button
                      onClick={() => { setLogMeasurementId(m.id); setLogDate(new Date().toISOString().split("T")[0]!); }}
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
                  <label htmlFor="log-date" className="sr-only">Fecha</label>
                  <input
                    id="log-date"
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label htmlFor="history-filter" className="text-sm font-medium shrink-0">Medida:</label>
            <select
              id="history-filter"
              value={historyFilterId}
              onChange={(e) => setHistoryFilterId(e.target.value)}
              className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring flex-1 max-w-xs"
            >
              <option value="">Todas las medidas</option>
              {measurements.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {groupedHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin registros aún.</p>
          ) : (
            <div className="space-y-5">
              {groupedHistory.map((group) => (
                <div key={group.date} className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {new Date(`${group.date}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                  </h3>
                  {group.entries.map((entry) => {
                    const m = measurements.find((x) => x.id === entry.measurement_id);
                    const list = entriesByMeasurement[entry.measurement_id] ?? [];
                    const idx = list.findIndex((x) => x.id === entry.id);
                    const prev = idx >= 0 ? list[idx + 1] : undefined;
                    const delta = prev ? entry.value - prev.value : null;
                    return (
                      <div key={entry.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">{m?.name ?? "—"}</p>
                          {entry.comment && <p className="text-xs text-muted-foreground">{entry.comment}</p>}
                          {delta != null && prev && (
                            <p className={`text-xs font-medium ${deltaColorClassFor(m, entry.value, prev.value)}`}>
                              {delta >= 0 ? "+" : ""}{delta % 1 === 0 ? delta : delta.toFixed(1)} {m?.unit} vs anterior
                            </p>
                          )}
                        </div>
                        <p className="text-sm font-semibold">{entry.value} {m?.unit}</p>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
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
                  {selectedMeasurement?.goal_value != null && (
                    <ReferenceLine
                      y={selectedMeasurement.goal_value}
                      stroke="#f59e0b"
                      strokeDasharray="4 3"
                      label={{ value: `Objetivo ${selectedMeasurement.goal_value}`, position: "insideTopRight", fontSize: 11, fill: "#f59e0b" }}
                    />
                  )}
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
