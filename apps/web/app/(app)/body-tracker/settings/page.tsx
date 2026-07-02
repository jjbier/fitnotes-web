"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, GripVertical } from "lucide-react";
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
  const [confirmResetId, setConfirmResetId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newGoalType, setNewGoalType] = useState<GoalType>(GoalType.DECREASE);
  const [newGoalValue, setNewGoalValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editGoalType, setEditGoalType] = useState<GoalType>(GoalType.DECREASE);
  const [editGoalValue, setEditGoalValue] = useState("");
  const [editSaving, setEditSaving] = useState(false);

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

  async function handleMeasurementDrop(toId: string) {
    if (!draggedId || draggedId === toId) { setDraggedId(null); setDragOverId(null); return; }
    const enabled = measurements.filter((m) => m.is_enabled);
    const disabled = measurements.filter((m) => !m.is_enabled);
    const fromIdx = enabled.findIndex((m) => m.id === draggedId);
    const toIdx = enabled.findIndex((m) => m.id === toId);
    if (fromIdx === -1 || toIdx === -1) { setDraggedId(null); setDragOverId(null); return; }

    const reordered = [...enabled];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved!);

    setMeasurements([...reordered, ...disabled]);
    setDraggedId(null);
    setDragOverId(null);

    await repo.reorderMeasurements(reordered.map((m, i) => ({ id: m.id, order_index: i })));
  }

  async function handleReset(id: string) {
    setSaving(id);
    await repo.resetMeasurement(id);
    setConfirmResetId(null);
    setSaving(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newUnit.trim()) return;
    setCreating(true);
    const parsedGoalValue = newGoalValue.trim() ? parseFloat(newGoalValue) : null;
    const { data, error } = await repo.createMeasurement({
      name: newName.trim(),
      unit: newUnit.trim(),
      goal_type: newGoalType,
      goal_value: Number.isFinite(parsedGoalValue) ? parsedGoalValue : null,
      is_enabled: true,
      order_index: measurements.length,
    }, userId);
    if (!error && data) {
      setMeasurements((prev) => [...prev, data as Measurement]);
      setNewName("");
      setNewUnit("");
      setNewGoalType(GoalType.DECREASE);
      setNewGoalValue("");
      setShowCreateForm(false);
    }
    setCreating(false);
  }

  function openEdit(m: Measurement) {
    setEditingId(m.id);
    setEditName(m.name);
    setEditUnit(m.unit);
    setEditGoalType(m.goal_type as GoalType);
    setEditGoalValue(m.goal_value != null ? String(m.goal_value) : "");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !editName.trim() || !editUnit.trim()) return;
    setEditSaving(true);
    const parsedGoalValue = editGoalValue.trim() ? parseFloat(editGoalValue) : null;
    const { data, error } = await repo.updateMeasurement(editingId, {
      name: editName.trim(),
      unit: editUnit.trim(),
      goal_type: editGoalType,
      goal_value: Number.isFinite(parsedGoalValue) ? parsedGoalValue : null,
    });
    if (!error && data) {
      setMeasurements((prev) => prev.map((m) => m.id === editingId ? (data as Measurement) : m));
      setEditingId(null);
    }
    setEditSaving(false);
  }

  const enabled = measurements.filter((m) => m.is_enabled);
  const disabled = measurements.filter((m) => !m.is_enabled);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href="/body-tracker"
          aria-label="Volver"
          className="rounded-xl border px-2 py-1 text-sm hover:bg-secondary"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Configuración de medidas</h1>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl border bg-secondary/30 animate-pulse" />)}
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
                <div key={m.id} className="space-y-2">
                  <div
                    draggable
                    onDragStart={() => setDraggedId(m.id)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverId(m.id); }}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={() => handleMeasurementDrop(m.id)}
                    onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                    className={[
                      "flex items-center gap-2 rounded-2xl transition-colors",
                      draggedId === m.id ? "opacity-40" : "",
                      dragOverId === m.id && draggedId !== m.id ? "ring-2 ring-primary" : "",
                    ].join(" ")}
                  >
                    <span className="shrink-0" title="Arrastrar para reordenar">
                      <GripVertical className="text-muted-foreground select-none opacity-30 hover:opacity-70 cursor-grab active:cursor-grabbing" size={16} aria-hidden="true" />
                    </span>
                    <div className="flex-1">
                      <MeasurementRow
                        m={m}
                        saving={saving === m.id}
                        confirmDelete={confirmDeleteId === m.id}
                        confirmReset={confirmResetId === m.id}
                        onToggle={() => handleToggle(m)}
                        onDelete={() => handleDelete(m.id)}
                        onAskDelete={() => setConfirmDeleteId(m.id)}
                        onCancelDelete={() => setConfirmDeleteId(null)}
                        onReset={() => handleReset(m.id)}
                        onAskReset={() => setConfirmResetId(m.id)}
                        onCancelReset={() => setConfirmResetId(null)}
                        onAskEdit={() => openEdit(m)}
                      />
                    </div>
                  </div>
                  {editingId === m.id && (
                    <EditMeasurementForm
                      name={editName} unit={editUnit} goalType={editGoalType} goalValue={editGoalValue}
                      saving={editSaving}
                      onNameChange={setEditName} onUnitChange={setEditUnit}
                      onGoalTypeChange={setEditGoalType} onGoalValueChange={setEditGoalValue}
                      onSubmit={handleSaveEdit} onCancel={() => setEditingId(null)}
                    />
                  )}
                </div>
              ))
            )}
          </section>

          {/* Disabled measurements */}
          {disabled.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Desactivadas</h2>
              {disabled.map((m) => (
                <div key={m.id} className="space-y-2">
                  <MeasurementRow
                    m={m}
                    saving={saving === m.id}
                    confirmDelete={confirmDeleteId === m.id}
                    confirmReset={confirmResetId === m.id}
                    onToggle={() => handleToggle(m)}
                    onDelete={() => handleDelete(m.id)}
                    onAskDelete={() => setConfirmDeleteId(m.id)}
                    onCancelDelete={() => setConfirmDeleteId(null)}
                    onReset={() => handleReset(m.id)}
                    onAskReset={() => setConfirmResetId(m.id)}
                    onCancelReset={() => setConfirmResetId(null)}
                    onAskEdit={() => openEdit(m)}
                  />
                  {editingId === m.id && (
                    <EditMeasurementForm
                      name={editName} unit={editUnit} goalType={editGoalType} goalValue={editGoalValue}
                      saving={editSaving}
                      onNameChange={setEditName} onUnitChange={setEditUnit}
                      onGoalTypeChange={setEditGoalType} onGoalValueChange={setEditGoalValue}
                      onSubmit={handleSaveEdit} onCancel={() => setEditingId(null)}
                    />
                  )}
                </div>
              ))}
            </section>
          )}

          {/* Create new measurement */}
          <section className="space-y-3">
            {!showCreateForm ? (
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2 rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground hover:bg-secondary w-full"
              >
                <span className="text-lg leading-none">+</span>
                Nueva medida
              </button>
            ) : (
              <div className="rounded-2xl border bg-card p-5 space-y-4">
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
                        className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
                        className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">Objetivo</label>
                      <select
                        value={newGoalType}
                        onChange={(e) => setNewGoalType(e.target.value as GoalType)}
                        className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value={GoalType.DECREASE}>Reducir</option>
                        <option value={GoalType.INCREASE}>Aumentar</option>
                        <option value={GoalType.SPECIFIC}>Valor específico</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">Valor objetivo (opcional)</label>
                      <input
                        type="number"
                        step="any"
                        value={newGoalValue}
                        onChange={(e) => setNewGoalValue(e.target.value)}
                        placeholder="Ej. 80"
                        className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowCreateForm(false); setNewName(""); setNewUnit(""); setNewGoalValue(""); }}
                      className="rounded-xl border px-4 py-2 text-sm hover:bg-secondary"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={creating || !newName.trim() || !newUnit.trim()}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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
  m, saving, confirmDelete, confirmReset, onToggle, onDelete, onAskDelete, onCancelDelete, onReset, onAskReset, onCancelReset, onAskEdit,
}: {
  m: Measurement;
  saving: boolean;
  confirmDelete: boolean;
  confirmReset: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onReset: () => void;
  onAskReset: () => void;
  onCancelReset: () => void;
  onAskEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3">
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
            className="rounded-xl bg-destructive px-2 py-1 text-xs text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            Sí
          </button>
          <button
            onClick={onCancelDelete}
            className="rounded-xl border px-2 py-1 text-xs hover:bg-secondary"
          >
            No
          </button>
        </div>
      ) : confirmReset ? (
        <div className="flex items-center gap-2">
          <p className="text-xs text-destructive">¿Borrar todos los valores registrados?</p>
          <button
            onClick={onReset}
            disabled={saving}
            className="rounded-xl bg-destructive px-2 py-1 text-xs text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            Sí
          </button>
          <button
            onClick={onCancelReset}
            className="rounded-xl border px-2 py-1 text-xs hover:bg-secondary"
          >
            No
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          {!m.is_default && (
            <button
              onClick={onAskEdit}
              aria-label={`Editar ${m.name}`}
              className="text-muted-foreground hover:text-foreground text-sm px-2"
            >
              ✎
            </button>
          )}
          <button
            onClick={onAskReset}
            aria-label={`Reiniciar ${m.name}`}
            title="Borrar todos los valores registrados"
            className="text-muted-foreground hover:text-foreground text-sm px-2"
          >
            ↺
          </button>
          {!m.is_default && (
            <button
              onClick={onAskDelete}
              aria-label={`Eliminar ${m.name}`}
              className="text-muted-foreground hover:text-destructive text-sm px-2"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EditMeasurementForm({
  name, unit, goalType, goalValue, saving,
  onNameChange, onUnitChange, onGoalTypeChange, onGoalValueChange, onSubmit, onCancel,
}: {
  name: string;
  unit: string;
  goalType: GoalType;
  goalValue: string;
  saving: boolean;
  onNameChange: (v: string) => void;
  onUnitChange: (v: string) => void;
  onGoalTypeChange: (v: GoalType) => void;
  onGoalValueChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border bg-card p-4 space-y-3 ml-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground uppercase tracking-wide">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            required
            className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground uppercase tracking-wide">Unidad</label>
          <input
            type="text"
            value={unit}
            onChange={(e) => onUnitChange(e.target.value)}
            required
            className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground uppercase tracking-wide">Objetivo</label>
          <select
            value={goalType}
            onChange={(e) => onGoalTypeChange(e.target.value as GoalType)}
            className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value={GoalType.DECREASE}>Reducir</option>
            <option value={GoalType.INCREASE}>Aumentar</option>
            <option value={GoalType.SPECIFIC}>Valor específico</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground uppercase tracking-wide">Valor objetivo (opcional)</label>
          <input
            type="number"
            step="any"
            value={goalValue}
            onChange={(e) => onGoalValueChange(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border px-4 py-2 text-sm hover:bg-secondary"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving || !name.trim() || !unit.trim()}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
