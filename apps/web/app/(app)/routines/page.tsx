"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRoutineStore } from "@fitnotes/core";
import { createBrowserClient, createRoutineRepository } from "@fitnotes/database";
import RoutineForm from "@/components/routines/RoutineForm";
import type { Routine } from "@fitnotes/core";

export default function RoutinesPage() {
  const routines = useRoutineStore((s) => s.routines);
  const isLoading = useRoutineStore((s) => s.isLoading);
  const loadRoutines = useRoutineStore((s) => s.loadRoutines);
  const createRoutine = useRoutineStore((s) => s.createRoutine);
  const updateRoutine = useRoutineStore((s) => s.updateRoutine);
  const deleteRoutine = useRoutineStore((s) => s.deleteRoutine);
  const setLoading = useRoutineStore((s) => s.setLoading);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Routine | null>(null);
  const [userId, setUserId] = useState("");

  const client = createBrowserClient();
  const repo = createRoutineRepository(client);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await client.auth.getUser();
      if (user) setUserId(user.id);
      const { data } = await repo.getRoutines();
      if (data) loadRoutines(data.map((r) => ({ id: r.id, name: r.name, notes: r.notes ?? undefined })));
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // userId se resuelve async al montar; si el usuario crea/copia algo antes de que
  // termine esa llamada, hay que esperar a que resuelva en vez de insertar con "".
  async function resolveUserId(): Promise<string> {
    if (userId) return userId;
    const { data: { user } } = await client.auth.getUser();
    if (user) setUserId(user.id);
    return user?.id ?? "";
  }

  const handleCreate = useCallback(async (data: { name: string; notes: string }) => {
    const uid = await resolveUserId();
    const { data: created, error } = await repo.createRoutine(data, uid);
    if (error) throw new Error(error.message);
    createRoutine({ id: created.id, name: created.name, notes: created.notes ?? undefined });
    setShowForm(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleUpdate = useCallback(async (data: { name: string; notes: string }) => {
    if (!editing) return;
    const { data: updated, error } = await repo.updateRoutine(editing.id, data);
    if (error) throw new Error(error.message);
    updateRoutine(editing.id, { name: updated.name, notes: updated.notes ?? undefined });
    setEditing(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta rutina y todos sus días?")) return;
    const { error } = await repo.deleteRoutine(id);
    if (error) return;
    deleteRoutine(id);
  }

  async function handleCopy(routine: Routine) {
    const uid = await resolveUserId();
    const { data, error } = await repo.copyRoutine(routine.id, `Copia de ${routine.name}`, uid);
    if (error || !data) return;
    createRoutine({ id: data.id, name: data.name, notes: data.notes ?? undefined });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Rutinas</h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + Nueva rutina
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Nueva rutina</h2>
          <RoutineForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {editing && (
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Editar rutina</h2>
          <RoutineForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg border bg-secondary/30 animate-pulse" />)}
        </div>
      ) : routines.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
          Sin rutinas aún. Crea una para guardar tus plantillas de entrenamiento favoritas.
        </div>
      ) : (
        <div className="space-y-2">
          {routines.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-lg border bg-card p-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{r.name}</p>
                {r.notes && <p className="text-xs text-muted-foreground truncate">{r.notes}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleCopy(r)} className="rounded-md border px-3 py-1.5 text-xs hover:bg-secondary">Copiar</button>
                <button onClick={() => setEditing(r)} className="rounded-md border px-3 py-1.5 text-xs hover:bg-secondary">Editar</button>
                <Link href={`/routines/${r.id}`} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                  Abrir
                </Link>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="rounded-md border px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
