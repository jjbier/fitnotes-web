"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient, createCalendarRepository } from "@fitnotes/database";
import { formatWorkoutDate } from "@fitnotes/core";
import { readWeekStart } from "@/lib/settings";

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [weekStart, setWeekStart] = useState<0 | 1>(1);
  const [workoutDates, setWorkoutDates] = useState<Set<string>>(new Set());
  const [categoryColors, setCategoryColors] = useState<Record<string, string[]>>({});
  const [workouts, setWorkouts] = useState<{id: string; date: string; comment: string | null}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [listView, setListView] = useState(false);
  const [history, setHistory] = useState<{id: string; date: string; comment: string | null}[]>([]);

  useEffect(() => { setWeekStart(readWeekStart()); }, []);

  const client = createBrowserClient();
  const repo = createCalendarRepository(client);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const [workoutsRes, colors] = await Promise.all([
        repo.getWorkoutsForMonth(year, month),
        repo.getWorkoutCategoryColorsForMonth(year, month),
      ]);
      if (workoutsRes.data) {
        setWorkouts(workoutsRes.data);
        setWorkoutDates(new Set(workoutsRes.data.map((w) => w.date)));
      }
      setCategoryColors(colors);
      setIsLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  useEffect(() => {
    if (listView) {
      repo.getWorkoutHistory(50).then(({ data }) => { if (data) setHistory(data); });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listView]);

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  const daysInMonth = getDaysInMonth(year, month);
  const rawFirstDow = getFirstDayOfWeek(year, month);
  const firstDow = weekStart === 1 ? (rawFirstDow + 6) % 7 : rawFirstDow;
  const monthName = new Date(year, month - 1, 1).toLocaleDateString("es", { month: "long", year: "numeric" });
  const today = new Date().toISOString().split("T")[0]!;
  const DAY_HEADERS = weekStart === 1
    ? ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"]
    : ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];

  const selectedWorkout = workouts.find((w) => w.date === selectedDate);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight flex-1">Calendar</h1>
        <button
          onClick={() => setListView((v) => !v)}
          className={`rounded-md border px-3 py-1.5 text-sm ${listView ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
        >
          {listView ? "Month View" : "List View"}
        </button>
      </div>

      {listView ? (
        /* List view */
        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No workouts yet.</p>
          ) : (
            history.map((w) => (
              <Link
                key={w.id}
                href={`/workout/${w.date}`}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 hover:bg-secondary/50"
              >
                <span className="text-sm font-medium">{formatWorkoutDate(w.date)}</span>
                {w.comment && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{w.comment}</span>}
                <span className="text-xs text-muted-foreground">→</span>
              </Link>
            ))
          )}
        </div>
      ) : (
        <>
          {/* Month nav */}
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} aria-label="Mes anterior" className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"><span aria-hidden="true">←</span></button>
            <h2 className="flex-1 text-center font-semibold">{monthName}</h2>
            <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); }} className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">Today</button>
            <button onClick={nextMonth} aria-label="Mes siguiente" className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"><span aria-hidden="true">→</span></button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-1">
            {DAY_HEADERS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
            ))}
            {/* Empty cells for first week offset */}
            {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const hasWorkout = workoutDates.has(dateStr);
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              const dots = categoryColors[dateStr] ?? (hasWorkout ? ["var(--primary)"] : []);
              const visibleDots = dots.slice(0, 4);
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-colors
                    ${isSelected ? "bg-primary text-primary-foreground" : isToday ? "border-2 border-primary text-primary" : "hover:bg-secondary"}
                    ${!hasWorkout && !isToday && !isSelected ? "text-muted-foreground" : ""}
                  `}
                >
                  {day}
                  {visibleDots.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {visibleDots.map((color, ci) => (
                        <div
                          key={ci}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: isSelected ? "var(--primary-foreground)" : color }}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected day popup */}
          {selectedDate && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">{formatWorkoutDate(selectedDate)}</h3>
                {selectedWorkout && (
                  <Link href={`/workout/${selectedDate}`} className="text-xs text-primary hover:underline">Open workout →</Link>
                )}
              </div>
              {selectedWorkout ? (
                <p className="text-xs text-muted-foreground">{selectedWorkout.comment ?? "Workout logged"}</p>
              ) : (
                <p className="text-xs text-muted-foreground">No workout on this day.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
