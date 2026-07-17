"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { useExerciseStore, filterExercises, ExerciseType } from "@fitnotes/core";
import { createBrowserClient, createExerciseRepository } from "@fitnotes/database";
import { Dumbbell } from "lucide-react";
import ExerciseCard from "@/components/exercises/ExerciseCard";
import ExerciseForm from "@/components/exercises/ExerciseForm";
import EmptyState from "@/components/EmptyState";
import { useConfirm } from "@/components/ConfirmDialog";
import type { Exercise, Category } from "@fitnotes/core";

/** Devuelve `value` retrasado `delay` ms; usado para no filtrar en cada pulsación del buscador. */
function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * Página de listado de ejercicios de una categoría (`/exercise/[id]`), o de favoritos
 * cuando `id === "favorites"`. Carga categorías, ejercicios y estadísticas por ejercicio
 * (`workout_count`/`last_used`) al montar, y permite crear/editar/eliminar ejercicios
 * (con la posibilidad de crear una categoría nueva desde el propio formulario),
 * marcar/desmarcar favoritos (con rollback si falla la persistencia) y convertir
 * unidades de peso del ejercicio en edición. La lista, ya filtrada por búsqueda
 * (debounced) y con favoritos primero, se virtualiza con `useWindowVirtualizer`
 * (scroll de ventana) para soportar catálogos grandes sin degradar el rendimiento.
 */
export default function ExerciseCategoryPage() {
  const { t } = useTranslation();
  const { id: categoryId } = useParams<{ id: string }>();

  const categories = useExerciseStore((s) => s.categories);
  const exercises = useExerciseStore((s) => s.exercises);
  const isLoading = useExerciseStore((s) => s.isLoading);
  const loadExercises = useExerciseStore((s) => s.loadExercises);
  const addExercise = useExerciseStore((s) => s.addExercise);
  const addCategory = useExerciseStore((s) => s.addCategory);
  const updateExercise = useExerciseStore((s) => s.updateExercise);
  const deleteExercise = useExerciseStore((s) => s.deleteExercise);
  const toggleFavorite = useExerciseStore((s) => s.toggleFavorite);
  const setLoading = useExerciseStore((s) => s.setLoading);
  const confirmDelete = useConfirm();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [exerciseStats, setExerciseStats] = useState<Record<string, { workout_count: number; last_used: string | null }>>({});
  const debouncedSearch = useDebounce(search);

  const client = createBrowserClient();
  const repo = createExerciseRepository(client);

  const isFavoritesView = categoryId === "favorites";
  const category = categories.find((c) => c.id === categoryId);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await client.auth.getUser();
      if (user) setUserId(user.id);
      const [catRes, exRes, statsRes] = await Promise.all([
        repo.getCategories(),
        repo.getExercises(),
        repo.getExerciseStats(),
      ]);
      if (catRes.data && exRes.data) {
        loadExercises(
          catRes.data,
          exRes.data.map((ex) => ({
            id: ex.id,
            name: ex.name,
            category_id: ex.category_id ?? "",
            type: ex.type as ExerciseType,
            weight_unit: (ex.weight_unit as "kg" | "lb"),
            notes: ex.notes ?? undefined,
            is_favorite: ex.is_favorite,
            created_at: ex.created_at,
          }))
        );
      }
      if (statsRes.data) setExerciseStats(statsRes.data);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  const categoryExercises = isFavoritesView
    ? exercises.filter((e) => e.is_favorite)
    : exercises.filter((e) => e.category_id === categoryId);

  const filtered = filterExercises(categoryExercises, debouncedSearch);
  const sorted = [
    ...filtered.filter((e) => e.is_favorite),
    ...filtered.filter((e) => !e.is_favorite),
  ];

  const listRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useWindowVirtualizer({
    count: sorted.length,
    estimateSize: () => 80,
    overscan: 5,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });

  /**
   * Crea el ejercicio y lo añade al store, sin cerrar el formulario — separado de
   * `handleCreate` para que `ExerciseForm` pueda reutilizarlo (p. ej. "crear y añadir otro").
   */
  const doCreate = useCallback(async (data: {
    name: string; category_id: string; type: ExerciseType; weight_unit: "kg" | "lb"; notes: string;
  }) => {
    const { data: created, error } = await repo.createExercise(data, userId);
    if (error) throw new Error(error.message);
    addExercise({
      id: created.id,
      name: created.name,
      category_id: created.category_id ?? "",
      type: created.type as ExerciseType,
      weight_unit: created.weight_unit as "kg" | "lb",
      notes: created.notes ?? undefined,
      is_favorite: created.is_favorite,
      created_at: created.created_at,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleCreate = useCallback(async (data: {
    name: string; category_id: string; type: ExerciseType; weight_unit: "kg" | "lb"; notes: string;
  }) => {
    await doCreate(data);
    setShowForm(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doCreate]);

  const handleCreateCategory = useCallback(async (data: { name: string; color: string }): Promise<Category> => {
    const { data: created, error } = await repo.createCategory(data, userId);
    if (error) throw new Error(error.message);
    const cat: Category = { id: created.id, name: created.name, color: created.color, order_index: created.order_index };
    addCategory(cat);
    return cat;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleUpdate = useCallback(async (data: {
    name: string; category_id: string; type: ExerciseType; weight_unit: "kg" | "lb"; notes: string;
  }) => {
    if (!editing) return;
    const { data: updated, error } = await repo.updateExercise(editing.id, data);
    if (error) throw new Error(error.message);
    updateExercise(editing.id, {
      name: updated.name,
      category_id: updated.category_id ?? "",
      type: updated.type as ExerciseType,
      weight_unit: updated.weight_unit as "kg" | "lb",
      notes: updated.notes ?? undefined,
    });
    setEditing(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const handleConvertWeights = useCallback(async (factor: number) => {
    if (!editing) return;
    await repo.convertExerciseWeights(editing.id, factor);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  /** Elimina el ejercicio de forma optimista (tras confirmar); si la persistencia falla, lo restaura en el store. */
  async function handleDelete(id: string) {
    if (!(await confirmDelete(t("exercises:deleteExerciseConfirmWeb")))) return;
    const saved = exercises.find((e) => e.id === id);
    deleteExercise(id);
    const { error } = await repo.deleteExercise(id);
    if (error && saved) addExercise(saved);
  }

  /** Alterna el favorito de forma optimista y revierte si la persistencia lanza error. */
  async function handleToggleFavorite(id: string, current: boolean) {
    toggleFavorite(id);
    try {
      await repo.toggleFavorite(id, !current);
    } catch {
      toggleFavorite(id);
    }
  }

  const pageTitle = isFavoritesView ? t("exercises:favoritesTitleWeb") : (category?.name ?? t("exercises:title"));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/exercise" className="text-muted-foreground hover:text-foreground text-sm">{t("exercises:backToCategories")}</Link>
        <span className="text-muted-foreground">/</span>
        <div className="flex items-center gap-2 flex-1">
          {category?.color && (
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
          )}
          <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
        </div>
        {!isFavoritesView && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t("exercises:newExerciseButton")}
          </button>
        )}
      </div>

      {/* Search */}
      <label htmlFor="category-search" className="sr-only">{t("exercises:searchLabelCategory")}</label>
      <input
        id="category-search"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("exercises:searchPlaceholderCategory")}
        className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {/* New form */}
      {showForm && (
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">{t("exercises:newExerciseHeading")}</h2>
          <ExerciseForm
            categories={categories}
            initial={{ category_id: isFavoritesView ? undefined : categoryId }}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            onCreateCategory={handleCreateCategory}
          />
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">{t("exercises:editExerciseHeading")}</h2>
          <ExerciseForm
            categories={categories}
            initial={editing}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
            onCreateCategory={handleCreateCategory}
            onConvertWeights={handleConvertWeights}
          />
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-2xl border bg-secondary/30 animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        search ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground text-sm">
            {t("exercises:noSearchResults", { search })}
          </div>
        ) : (
          <EmptyState
            icon={Dumbbell}
            title={t("exercises:emptyExercisesTitle")}
            description={t("exercises:emptyExercisesDescriptionWeb")}
            action={{ label: t("exercises:emptyExercisesActionWeb"), onClick: () => setShowForm(true) }}
          />
        )
      ) : (
        <div ref={listRef} style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const ex = sorted[virtualItem.index]!;
            return (
              <div
                key={ex.id}
                data-index={virtualItem.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start - (listRef.current?.offsetTop ?? 0)}px)`,
                }}
                className="pb-2"
              >
                <ExerciseCard
                  exercise={ex}
                  stats={exerciseStats[ex.id]}
                  onEdit={setEditing}
                  onDelete={handleDelete}
                  onToggleFavorite={handleToggleFavorite}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
