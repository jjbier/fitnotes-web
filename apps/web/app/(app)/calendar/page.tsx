"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient, createCalendarRepository, createExerciseRepository } from "@fitnotes/database";
import { formatWorkoutDate } from "@fitnotes/core";
import { readWeekStart } from "@/lib/settings";

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

type Category = { id: string; name: string; color: string };
type Exercise = { id: string; name: string };

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [weekStart, setWeekStart] = useState<0 | 1>(1);
  const [workoutDates, setWorkoutDates] = useState<Set<string>>(new Set());
  const [categoryColors, setCategoryColors] = useState<Record<string, string[]>>({});
  const [categoryIds, setCategoryIds] = useState<Record<string, string[]>>({});
  const [workouts, setWorkouts] = useState<{id: string; date: string; comment: string | null}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [listView, setListView] = useState(false);
  const [history, setHistory] = useState<{id: string; date: string; comment: string | null}[]>([]);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(new Set());
  const [catMatchMode, setCatMatchMode] = useState<"any" | "all">("any");
  const [filterExId, setFilterExId] = useState("");
  const [filterMinWeight, setFilterMinWeight] = useState("");
  const [filterMinReps, setFilterMinReps] = useState("");
  const [filteredExDates, setFilteredExDates] = useState<Set<string> | null>(null);
  const [filterExLoading, setFilterExLoading] = useState(false);

  useEffect(() => { setWeekStart(readWeekStart()); }, []);

  const client = createBrowserClient();
  const repo = createCalendarRepository(client);
  const exRepo = createExerciseRepository(client);

  // Load categories + exercises once for filter panel
  useEffect(() => {
    async function loadFilterData() {
      const [catRes, exRes] = await Promise.all([exRepo.getCategories(), exRepo.getExercises()]);
      if (catRes.data) setCategories(catRes.data.map((c) => ({ id: c.id, name: c.name, color: c.color })));
      if (exRes.data) setExercises(exRes.data.map((e) => ({ id: e.id, name: e.name })));
    }
    loadFilterData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load month data (workouts + category colors + category IDs)
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const [workoutsRes, colors, ids] = await Promise.all([
        repo.getWorkoutsForMonth(year, month),
        repo.getWorkoutCategoryColorsForMonth(year, month),
        repo.getWorkoutCategoryIdsForMonth(year, month),
      ]);
      if (workoutsRes.data) {
        setWorkouts(workoutsRes.data);
        setWorkoutDates(new Set(workoutsRes.data.map((w) => w.date)));
      }
      setCategoryColors(colors);
      setCategoryIds(ids);
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

  // Derived: dates matching selected categories (client-side, per-month)
  const catFilteredDates = useMemo<Set<string> | null>(() => {
    if (selectedCatIds.size === 0) return null;
    return new Set(
      Object.entries(categoryIds)
        .filter(([, ids]) =>
          catMatchMode === "any"
            ? ids.some((id) => selectedCatIds.has(id))
            : [...selectedCatIds].every((id) => ids.includes(id))
        )
        .map(([date]) => date)
    );
  }, [selectedCatIds, catMatchMode, categoryIds]);

  // Derived: intersection of both active filters
  const activeDates = useMemo<Set<string> | null>(() => {
    if (!catFilteredDates && !filteredExDates) return null;
    if (catFilteredDates && !filteredExDates) return catFilteredDates;
    if (!catFilteredDates && filteredExDates) return filteredExDates;
    return new Set([...catFilteredDates!].filter((d) => filteredExDates!.has(d)));
  }, [catFilteredDates, filteredExDates]);

  async function applyExerciseFilter() {
    if (!filterExId) { setFilteredExDates(null); return; }
    setFilterExLoading(true);
    const minWeight = filterMinWeight ? parseFloat(filterMinWeight) : undefined;
    const minReps = filterMinReps ? parseInt(filterMinReps, 10) : undefined;
    const dates = await repo.getWorkoutDatesForExerciseWithConditions(filterExId, minWeight, minReps);
    setFilteredExDates(new Set(dates));
    setFilterExLoading(false);
  }

  function clearFilters() {
    setSelectedCatIds(new Set());
    setFilterExId("");
    setFilterMinWeight("");
    setFilterMinReps("");
    setFilteredExDates(null);
  }

  function toggleCategory(id: string) {
    setSelectedCatIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

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
  const activeFilterCount = (selectedCatIds.size > 0 ? 1 : 0) + (filteredExDates !== null ? 1 : 0);
  const isFiltered = activeDates !== null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight flex-1">Calendario</h1>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium ${showFilters || activeFilterCount > 0 ? "bg-primary text-primary-foreground border-primary" : "hover:bg-secondary"}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true"><path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clipRule="evenodd" /></svg>
          Filtros
          {activeFilterCount > 0 && (
            <span className="ml-0.5 rounded-full bg-white/25 px-1.5 text-xs font-bold">{activeFilterCount}</span>
          )}
        </button>
        {activeFilterCount > 0 && (
          <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground">
            Limpiar
          </button>
        )}
        <button
          onClick={() => setListView((v) => !v)}
          className={`rounded-md border px-3 py-1.5 text-sm ${listView ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
        >
          {listView ? "Mes" : "Lista"}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-lg border bg-card p-4 space-y-4">
          {/* Category filter */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categorías musculares</span>
              <div className="ml-auto flex rounded-md border bg-secondary/30 p-0.5 text-xs">
                {(["any", "all"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setCatMatchMode(mode)}
                    className={`rounded px-2.5 py-0.5 font-medium transition-colors ${catMatchMode === mode ? "bg-white shadow-sm dark:bg-secondary" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {mode === "any" ? "Cualquiera" : "Todas"}
                  </button>
                ))}
              </div>
            </div>
            {categories.length === 0 ? (
              <p className="text-xs text-muted-foreground">Cargando…</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const active = selectedCatIds.has(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${!active ? "border-border text-muted-foreground hover:bg-secondary" : ""}`}
                      style={active ? { borderColor: cat.color, color: cat.color, backgroundColor: `${cat.color}18` } : {}}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t" />

          {/* Exercise + conditions filter */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block mb-2">Por ejercicio</span>
            <div className="space-y-3">
              <select
                value={filterExId}
                onChange={(e) => { setFilterExId(e.target.value); setFilteredExDates(null); }}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Seleccionar ejercicio…</option>
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>

              {filterExId && (
                <div className="flex items-end gap-3 flex-wrap">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Peso mín. (kg)</label>
                    <input
                      type="number" min="0" step="0.5" value={filterMinWeight}
                      onChange={(e) => setFilterMinWeight(e.target.value)}
                      placeholder="—"
                      className="w-24 rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Reps mín.</label>
                    <input
                      type="number" min="0" value={filterMinReps}
                      onChange={(e) => setFilterMinReps(e.target.value)}
                      placeholder="—"
                      className="w-24 rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <button
                    onClick={applyExerciseFilter}
                    disabled={filterExLoading}
                    className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {filterExLoading ? "Buscando…" : "Aplicar"}
                  </button>
                  {filteredExDates !== null && (
                    <span className="text-xs text-muted-foreground self-center">
                      {filteredExDates.size} días
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {listView ? (
        /* List view */
        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin entrenamientos aún.</p>
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
            <h2 className="flex-1 text-center font-semibold capitalize">{monthName}</h2>
            <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); }} className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">Hoy</button>
            <button onClick={nextMonth} aria-label="Mes siguiente" className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"><span aria-hidden="true">→</span></button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-1">
            {DAY_HEADERS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
            ))}

            {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}

            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const hasWorkout = workoutDates.has(dateStr);
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              const matchesFilter = !isFiltered || activeDates!.has(dateStr);
              const dimmed = isFiltered && hasWorkout && !matchesFilter;
              const dots = categoryColors[dateStr] ?? (hasWorkout ? ["var(--primary)"] : []);
              const visibleDots = dots.slice(0, 4);
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-colors
                    ${isSelected ? "bg-primary text-primary-foreground" : isToday ? "border-2 border-primary text-primary" : "hover:bg-secondary"}
                    ${!hasWorkout && !isToday && !isSelected ? "text-muted-foreground" : ""}
                    ${dimmed ? "opacity-25" : ""}
                    ${isFiltered && matchesFilter && !isSelected && hasWorkout ? "ring-1 ring-primary/40" : ""}
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

          {isLoading && (
            <div className="text-center py-4 text-sm text-muted-foreground animate-pulse">Cargando…</div>
          )}

          {/* Selected day popup */}
          {selectedDate && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">{formatWorkoutDate(selectedDate)}</h3>
                {selectedWorkout && (
                  <Link href={`/workout/${selectedDate}`} className="text-xs text-primary hover:underline">Abrir entrenamiento →</Link>
                )}
              </div>
              {selectedWorkout ? (
                <p className="text-xs text-muted-foreground">{selectedWorkout.comment ?? "Entrenamiento registrado"}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Sin entrenamiento este día.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
