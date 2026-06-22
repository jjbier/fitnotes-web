"use client";

import { useEffect, useState } from "react";
import { createBrowserClient, createBodyTrackerRepository } from "@fitnotes/database";

interface Measurement {
  id: string;
  name: string;
  unit: string;
  is_enabled: boolean;
  goal_type: string;
  goal_value: number | null;
}

interface Entry {
  id: string;
  measurement_id: string;
  value: number;
  recorded_at: string;
  comment: string | null;
}

export default function BodyTrackerPage() {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [latestEntries, setLatestEntries] = useState<Record<string, Entry>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [logMeasurementId, setLogMeasurementId] = useState("");
  const [logValue, setLogValue] = useState("");
  const [logComment, setLogComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"track" | "history">("track");
  const [historyEntries, setHistoryEntries] = useState<Entry[]>([]);

  const client = createBrowserClient();
  const repo = createBodyTrackerRepository(client);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const { data: { user } } = await client.auth.getUser();
      if (user) setUserId(user.id);

      const { data: mData } = await repo.getMeasurements();
      if (mData) {
        setMeasurements(mData.filter((m) => m.is_enabled));
        const latestMap: Record<string, Entry> = {};
        await Promise.all(mData.filter((m) => m.is_enabled).map(async (m) => {
          const { data: entries } = await repo.getEntries(m.id, 1);
          if (entries && entries[0]) latestMap[m.id] = entries[0] as Entry;
        }));
        setLatestEntries(latestMap);
      }
      setIsLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadHistory() {
    const { data } = await repo.getAllEntries(userId);
    if (data) setHistoryEntries(data as Entry[]);
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
      setLatestEntries((prev) => ({ ...prev, [logMeasurementId]: data as Entry }));
      setLogValue("");
      setLogComment("");
      setLogMeasurementId("");
    }
    setSaving(false);
  }

  const enabledMeasurements = measurements.filter((m) => m.is_enabled);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Medidas corporales</h1>
        <div className="flex gap-1 rounded-lg border p-1">
          {(["track", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t === "history") loadHistory(); }}
              className={`rounded-md px-3 py-1 text-sm font-medium capitalize ${tab === t ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              {t === "track" ? "Registrar" : "Historial"}
            </button>
          ))}
        </div>
      </div>

      {tab === "track" ? (
        <>
          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-lg border bg-secondary/30 animate-pulse" />)}
            </div>
          ) : enabledMeasurements.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
              No hay medidas activas. Añade algunas en la configuración.
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

          {/* Log form */}
          {logMeasurementId && (
            <div className="rounded-lg border bg-card p-5">
              <h2 className="text-sm font-semibold mb-4">
                Registrar {measurements.find((m) => m.id === logMeasurementId)?.name}
              </h2>
              <form onSubmit={handleLog} className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={logValue}
                    onChange={(e) => setLogValue(e.target.value)}
                    placeholder={measurements.find((m) => m.id === logMeasurementId)?.unit ?? "Valor"}
                    step="0.1"
                    autoFocus
                    className="w-32 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
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
      ) : (
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
                  </div>
                  <p className="text-sm font-semibold">{entry.value} {m?.unit}</p>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
