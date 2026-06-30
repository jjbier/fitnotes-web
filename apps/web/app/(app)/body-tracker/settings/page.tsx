"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GoalType } from "@fitnotes/core";
import { createBrowserClient, createBodyTrackerRepository } from "@fitnotes/database";

interface Measurement {
  id: string;
  name: string;
  unit: string;
  is_enabled: boolean;
  is_default: boolean;
  goal_type: string;
  goal_value: number | null;
}

export default function BodyTrackerSettingsPage() {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newGoalType, setNewGoalType] = useState<GoalType>(GoalType.DECREASE);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const client = createBrowserClient();
  const repo = createBodyTrackerRepository(client);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const { data: { user } } = await client.auth.getUser();
      if (user) setUserId(user.id);
      const { data } = await repo.getMeasurements();
      if (data) setMeasurements(data as Measurement[]);
      setIsLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleToggle(m: Measurement) {
    setSaving(m.id);
    await repo.updateMeasurement(m.id, { is_enabled: !m.is_enabled });
    setMeasurements((prev) => prev.map((x) => x.id === m.id ? { ...x, is_enabled: !m.is_enabled } : x));
    setSaving(null);
  }

  async function handleDelete(id: string) {
    setSaving(id);
    await repo.deleteMeasurement(id);
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
    setConfirmDeleteId(null);
    setSaving(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newUnit.trim()) return;
    setCreating(true);
    const { data, error } = await repo.createMeasurement({
      name: newName.trim(),
      unit: newUnit.trim(),
      goal_type: newGoalType,
      is_enabled: true,
    }, userId);
    if (!error && data) {
      setMeasurements((prev) => [...prev, data as Measurement]);
      setNewName("");
      setNewUnit("");
      setNewGoalType(GoalType.DECREASE);
      setShowCreateForm(false);
    }
    setCreating(false);
  }

  const enabled = measurements.filter((m) => m.is_enabled);
  const disabled = measurements.filter((m) => !m.is_enabled);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href="/body-tracker"
          aria-label="Volver"
          className="rounded-md border px-2 py-1 text-sm hover:bg-secondary"
        >
          <span aria-hidden="true">←</span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Configuración de medidas</h1>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg border bg-secondary/30 animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Enabled measurements */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Activas</h2>
            {enabled.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">Sin medidas activas.</p>
            ) : (
              enabled.map((m) => (
                <MeasurementRow
                  key={m.id}
                  m={m}
                  saving={saving === m.id}
                  confirmDelete={confirmDeleteId === m.id}
                  onToggle={() => handleToggle(m)}
                  onDelete={() => handleDelete(m.id)}
                  onAskDelete={() => setConfirmDeleteId(m.id)}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                />
              ))
            )}
          </section>

          {/* Disabled measurements */}
          {disabled.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Desactivadas</h2>
              {disabled.map((m) => (
                <MeasurementRow
                  key={m.id}
                  m={m}
                  saving={saving === m.id}
                  confirmDelete={confirmDeleteId === m.id}
                  onToggle={() => handleToggle(m)}
                  onDelete={() => handleDelete(m.id)}
                  onAskDelete={() => setConfirmDeleteId(m.id)}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                />
              ))}
            </section>
          )}

          {/* Create new measurement */}
          <section className="space-y-3">
            {!showCreateForm ? (
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground hover:bg-secondary w-full"
              >
                <span className="text-lg leading-none">+</span>
                Nueva medida
              </button>
            ) : (
              <div className="rounded-lg border bg-card p-5 space-y-4">
                <h2 className="text-sm font-semibold">Nueva medida</h2>
                <form onSubmit={handleCreate} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">Nombre</label>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Ej. Cintura"
                        autoFocus
                        required
                        className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">Unidad</label>
                      <input
                        type="text"
                        value={newUnit}
                        onChange={(e) => setNewUnit(e.target.value)}
                        placeholder="Ej. cm, kg, %"
                        required
                        className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground uppercase tracking-wide">Objetivo</label>
                    <select
                      value={newGoalType}
                      onChange={(e) => setNewGoalType(e.target.value as GoalType)}
                      className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value={GoalType.DECREASE}>Reducir</option>
                      <option value={GoalType.INCREASE}>Aumentar</option>
                      <option value={GoalType.SPECIFIC}>Valor específico</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowCreateForm(false); setNewName(""); setNewUnit(""); }}
                      className="rounded-md border px-4 py-2 text-sm hover:bg-secondary"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={creating || !newName.trim() || !newUnit.trim()}
                      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {creating ? "Creando…" : "Crear medida"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function MeasurementRow({
  m, saving, confirmDelete, onToggle, onDelete, onAskDelete, onCancelDelete,
}: {
  m: Measurement;
  saving: boolean;
  confirmDelete: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          disabled={saving}
          aria-label={m.is_enabled ? "Desactivar" : "Activar"}
          className={`relative h-5 w-9 rounded-full transition-colors disabled:opacity-50 ${
            m.is_enabled ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              m.is_enabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
        <div>
          <p className="text-sm font-medium">{m.name}</p>
          <p className="text-xs text-muted-foreground">{m.unit}</p>
        </div>
      </div>

      {confirmDelete ? (
        <div className="flex items-center gap-2">
          <p className="text-xs text-destructive">¿Eliminar con todos sus datos?</p>
          <button
            onClick={onDelete}
            disabled={saving}
            className="rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            Sí
          </button>
          <button
            onClick={onCancelDelete}
            className="rounded-md border px-2 py-1 text-xs hover:bg-secondary"
          >
            No
          </button>
        </div>
      ) : (
        !m.is_default && (
          <button
            onClick={onAskDelete}
            aria-label={`Eliminar ${m.name}`}
            className="text-muted-foreground hover:text-destructive text-sm px-2"
          >
            ✕
          </button>
        )
      )}
    </div>
  );
}
