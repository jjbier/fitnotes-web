"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Dumbbell } from "lucide-react";
import { formatWorkoutDate } from "@fitnotes/core";
import { createBrowserClient, createWorkoutRepository } from "@fitnotes/database";
import EmptyState from "@/components/EmptyState";
import WorkoutPickerModal, { type PickableWorkout } from "@/components/workout/WorkoutPickerModal";

interface WorkoutDatePageProps {
  params: Promise<{ date: string }>;
}

/**
 * Shim de compatibilidad: `/workout/date/[date]` (antes `/workout/[date]`, la
 * página real de entrenamiento) — vive en `workout/date/` en vez de junto a
 * `workout/[id]` porque Next.js no permite dos slugs dinámicos distintos
 * (`id` y `date`) al mismo nivel. Existe porque varios puntos de entrada
 * (progreso, calendario "día seleccionado", atajos "hoy") todavía solo tienen
 * una fecha en mano, no un id concreto (ver `/workout/[id]/page.tsx`, Fase 3
 * de docs/implementation-plan-multi-workout-per-day.md).
 *
 * Resuelve `getWorkoutsByDate(date)` y redirige a `/workout/{id}`: directo si
 * hay exactamente uno; si hay varios, muestra `<WorkoutPickerModal>` (Fase 4
 * de docs/implementation-plan-multi-workout-per-day.md) para elegir a cuál.
 * Si no existe ninguno, ofrece crearlo (mismo comportamiento que tenía antes
 * esta ruta) y redirige al nuevo id.
 */
export default function WorkoutDateRedirectPage({ params }: WorkoutDatePageProps) {
  const { date } = use(params);
  const router = useRouter();
  const [notFound, setNotFound] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pickerWorkouts, setPickerWorkouts] = useState<PickableWorkout[] | null>(null);

  const client = createBrowserClient();
  const repo = createWorkoutRepository(client);

  useEffect(() => {
    let cancelled = false;
    setNotFound(false);
    setPickerWorkouts(null);
    repo.getWorkoutsByDate(date).then(({ data }) => {
      if (cancelled) return;
      const workouts = data ?? [];
      if (workouts.length === 0) {
        setNotFound(true);
      } else if (workouts.length === 1) {
        router.replace(`/workout/${workouts[0]!.id}`);
      } else {
        setPickerWorkouts(workouts);
      }
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function handleStartWorkout() {
    setCreating(true);
    const { data: { user } } = await client.auth.getUser();
    const { data, error } = await repo.createWorkout(
      { date, start_time: new Date().toISOString() },
      user?.id ?? ""
    );
    if (error || !data) { setCreating(false); return; }
    router.replace(`/workout/${data.id}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/calendar"
          aria-label="Volver al calendario"
          className="rounded-xl border px-2 py-1 text-sm hover:bg-secondary"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Entrenamiento</h1>
          <p className="text-sm text-muted-foreground">{formatWorkoutDate(date)}</p>
        </div>
      </div>

      {notFound ? (
        <EmptyState
          icon={Dumbbell}
          title="Sin entrenamiento aún"
          description="Inicia un entrenamiento para registrar tus series y hacer seguimiento del progreso."
          action={{ label: creating ? "Creando…" : "Iniciar entrenamiento", onClick: handleStartWorkout }}
        />
      ) : (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-2xl border bg-secondary/30 animate-pulse" />
          ))}
        </div>
      )}

      {pickerWorkouts && (
        <WorkoutPickerModal
          workouts={pickerWorkouts}
          creating={creating}
          onChoose={(id) => router.replace(`/workout/${id}`)}
          onCreateNew={handleStartWorkout}
          onClose={() => router.back()}
        />
      )}
    </div>
  );
}
