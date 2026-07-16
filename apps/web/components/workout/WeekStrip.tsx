/**
 * Franja semanal (lunes a domingo) de puntos de actividad, mostrada en el
 * dashboard: resalta el día de hoy, el día actualmente seleccionado, marca
 * con un punto los días que tienen entrenamiento registrado y muestra la
 * racha (días consecutivos con entrenamiento) con un icono de llama.
 */

"use client";

import { Flame } from "lucide-react";

/**
 * Props de `WeekStrip`.
 * @property workoutDates - Conjunto de fechas (`YYYY-MM-DD`) con al menos un entrenamiento registrado.
 * @property currentDate - Fecha actualmente seleccionada/visible, resaltada con fondo sólido.
 * @property today - Fecha de hoy (inyectada por el padre en vez de calculada aquí, para facilitar tests/consistencia horaria).
 * @property onSelectDate - Se invoca con la fecha del día pulsado.
 */
interface WeekStripProps {
  workoutDates: Set<string>;
  currentDate: string;
  today: string;
  onSelectDate: (date: string) => void;
}

/** Iniciales de los días de la semana en español, en orden lunes→domingo (semana ISO). */
const WEEK_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

/**
 * Calcula las 7 fechas (`YYYY-MM-DD`) de la semana ISO (lunes a domingo) que
 * contiene `today`. Usa `T00:00:00` al parsear para evitar desfases de zona
 * horaria al construir la fecha a partir de un string `YYYY-MM-DD`.
 */
function getWeekDates(today: string): string[] {
  const todayDate = new Date(today + "T00:00:00");
  const dow = todayDate.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(todayDate);
  monday.setDate(todayDate.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split("T")[0]!;
  });
}

/**
 * Cuenta los días consecutivos con entrenamiento hacia atrás desde hoy. Si
 * hoy todavía no tiene entrenamiento registrado, la racha se calcula a
 * partir de ayer (para no romper la racha mientras el usuario aún no ha
 * entrenado hoy).
 */
function getStreak(workoutDates: Set<string>, today: string): number {
  let count = 0;
  const d = new Date(today + "T00:00:00");
  if (!workoutDates.has(today)) d.setDate(d.getDate() - 1);
  for (;;) {
    const dateStr = d.toISOString().split("T")[0]!;
    if (!workoutDates.has(dateStr)) break;
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

/**
 * Renderiza los 7 días de la semana actual como botones seleccionables, con
 * indicadores visuales independientes para "hoy" (anillo), "seleccionado"
 * (fondo sólido) y "con entrenamiento" (punto), más la racha si es mayor que 0.
 */
export default function WeekStrip({ workoutDates, currentDate, today, onSelectDate }: WeekStripProps) {
  const weekDates = getWeekDates(today);
  const streak = getStreak(workoutDates, today);

  return (
    <div className="flex items-center gap-1">
      {weekDates.map((dateStr, i) => {
        const has = workoutDates.has(dateStr);
        const isToday = dateStr === today;
        const isFuture = dateStr > today;
        const isCurrent = dateStr === currentDate;
        return (
          <button
            key={dateStr}
            onClick={() => onSelectDate(dateStr)}
            className="flex flex-1 flex-col items-center gap-1"
            aria-label={dateStr}
            aria-current={isCurrent ? "date" : undefined}
          >
            <span className={`text-[10px] font-semibold ${isToday ? "text-primary" : "text-muted-foreground"}`}>
              {WEEK_LABELS[i]}
            </span>
            <span
              className={[
                "flex h-6 w-6 items-center justify-center rounded-full",
                isCurrent ? "bg-primary" : has ? "bg-primary/10" : "",
                isToday && !isCurrent ? "ring-[1.5px] ring-primary" : "",
              ].join(" ")}
            >
              {has && !isFuture && (
                <span className={`h-[7px] w-[7px] rounded-full ${isCurrent ? "bg-primary-foreground" : "bg-primary"}`} />
              )}
            </span>
          </button>
        );
      })}
      {streak > 0 && (
        <div className="ml-2 flex shrink-0 items-center gap-1 rounded-xl bg-orange-50 px-2 py-1 dark:bg-orange-950/30">
          <Flame className="text-orange-500" size={13} aria-hidden="true" />
          <span className="text-xs font-bold text-orange-500">{streak}</span>
        </div>
      )}
    </div>
  );
}
