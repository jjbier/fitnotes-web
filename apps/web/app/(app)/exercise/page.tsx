"use client";

import { useEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { History, Star, ChevronRight, GripVertical, Dumbbell } from "lucide-react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import EmptyState from "@/components/EmptyState";
import { useConfirm } from "@/components/ConfirmDialog";
import { useExerciseStore, ExerciseType, filterExercises } from "@fitnotes/core";
import { createBrowserClient, createExerciseRepository } from "@fitnotes/database";
import ExerciseForm from "@/components/exercises/ExerciseForm";
import CategoryForm from "@/components/exercises/CategoryForm";
import ExerciseCard from "@/components/exercises/ExerciseCard";
import type { Category } from "@fitnotes/core";

/**
 * Página raíz del catálogo de ejercicios (`/exercise`): lista las categorías (con
 * atajo a favoritos si hay alguno) y ofrece un buscador global que, al escribir,
 * sustituye la lista de categorías por resultados de ejercicios de todas ellas
 * (virtualizados con `useWindowVirtualizer`). Carga categorías, ejercicios y
 * estadísticas por ejercicio al montar. Soporta crear/editar/eliminar categorías
 * y ejercicios, reordenar categorías por drag&drop nativo (`draggable`/`onDrop`),
 * y marcar/desmarcar favoritos con rollback optimista si falla la persistencia.
 */
export default function ExercisePage() {
  const { t } = useTranslation();
  const categories = useExerciseStore((s) => s.categories);
  const exercises = useExerciseStore((s) => s.exercises);
  const isLoading = useExerciseStore((s) => s.isLoading);
  const loadExercises = useExerciseStore((s) => s.loadExercises);
  const addCategory = useExerciseStore((s) => s.addCategory);
  const addExercise = useExerciseStore((s) => s.addExercise);
  const deleteExercise = useExerciseStore((s) => s.deleteExercise);
  const toggleFavorite = useExerciseStore((s) => s.toggleFavorite);
  const updateCategory = useExerciseStore((s) => s.updateCategory);
  const deleteCategory = useExerciseStore((s) => s.deleteCategory);
  const reorderCategories = useExerciseStore((s) => s.reorderCategories);
  const setLoading = useExerciseStore((s) => s.setLoading);
  const setError = useExerciseStore((s) => s.setError);
  const confirmDelete = useConfirm();

  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [exerciseStats, setExerciseStats] = useState<Record<string, { workout_count: number; last_used: string | null }>>({});
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const client = createBrowserClient();
  const repo = createExerciseRepository(client);

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
      if (catRes.error) { setError(catRes.error.message); return; }
      loadExercises(
        catRes.data ?? [],
        (exRes.data ?? []).map((ex) => ({
          id: ex.id,
          name: ex.name,
          category_id: ex.category_id ?? "",
          type: ex.type as ExerciseType,
          weight_unit: ex.weight_unit as "kg" | "lb",
          notes: ex.notes ?? undefined,
          is_favorite: ex.is_favorite,
          created_at: ex.created_at,
        }))
      );
      if (statsRes.data) setExerciseStats(statsRes.data);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * userId se resuelve async al montar; si el usuario crea algo antes de que
   * termine esa llamada, hay que esperar a que resuelva en vez de insertar con "".
   */
  async function resolveUserId(): Promise<string> {
    if (userId) return userId;
    const { data: { user } } = await client.auth.getUser();
    if (user) setUserId(user.id);
    return user?.id ?? "";
  }

  /** Crea el ejercicio y lo añade al store, sin cerrar el formulario (usado también por `handleCreateExercise`). */
  async function doCreateExercise(data: {
    name: string; category_id: string; type: ExerciseType; weight_unit: "kg" | "lb"; notes: string;
  }) {
    const uid = await resolveUserId();
    const { data: created, error } = await repo.createExercise(data, uid);
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
  }

  async function handleCreateExercise(data: {
    name: string; category_id: string; type: ExerciseType; weight_unit: "kg" | "lb"; notes: string;
  }) {
    await doCreateExercise(data);
    setShowExerciseForm(false);
  }

  async function handleCreateCategory(data: { name: string; color: string }): Promise<Category> {
    const uid = await resolveUserId();
    const { data: created, error } = await repo.createCategory(data, uid);
    if (error) throw new Error(error.message);
    const cat: Category = {
      id: created.id,
      name: created.name,
      color: created.color,
      order_index: created.order_index,
    };
    addCategory(cat);
    return cat;
  }

  async function handleCreateStandaloneCategory(data: { name: string; color: string }) {
    await handleCreateCategory(data);
    setShowCategoryForm(false);
  }

  async function handleUpdateCategory(data: { name: string; color: string }) {
    if (!editingCategory) return;
    const { data: updated, error } = await repo.updateCategory(editingCategory.id, data);
    if (error) throw new Error(error.message);
    updateCategory(editingCategory.id, { name: updated.name, color: updated.color });
    setEditingCategory(null);
  }

  async function handleDeleteCategory(id: string) {
    if (!(await confirmDelete(t("exercises:deleteCategoryConfirmWeb")))) return;
    const { error } = await repo.deleteCategory(id);
    if (error) return;
    deleteCategory(id);
  }

  /** Alterna el favorito de forma optimista y revierte si la persistencia lanza error. */
  async function handleToggleFavorite(id: string, current: boolean) {
    toggleFavorite(id);
    try {
      await repo.toggleFavorite(id, !current);
    } catch {
      toggleFavorite(id); // rollback
    }
  }

  /** Elimina el ejercicio de forma optimista (tras confirmar); si la persistencia falla, lo restaura en el store. */
  async function handleDeleteExercise(id: string) {
    if (!(await confirmDelete(t("exercises:deleteExerciseConfirmWeb")))) return;
    const saved = exercises.find((e) => e.id === id);
    deleteExercise(id);
    const { error } = await repo.deleteExercise(id);
    if (error && saved) addExercise(saved);
  }

  /**
   * Handler del `onDrop` de drag&drop nativo sobre las filas de categoría: mueve
   * `draggedId` a la posición de `toId` dentro del array local, aplica el nuevo
   * orden al store de forma optimista y persiste los `order_index` recalculados.
   */
  async function handleCategoryDrop(toId: string) {
    if (!draggedId || draggedId === toId) { setDraggedId(null); setDragOverId(null); return; }
    const fromIdx = categories.findIndex((c) => c.id === draggedId);
    const toIdx = categories.findIndex((c) => c.id === toId);
    if (fromIdx === -1 || toIdx === -1) { setDraggedId(null); setDragOverId(null); return; }

    const reordered = [...categories];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved!);
    const orderedIds = reordered.map((c) => c.id);

    reorderCategories(orderedIds);
    setDraggedId(null);
    setDragOverId(null);

    await repo.reorderCategories(reordered.map((c, i) => ({ id: c.id, order_index: i })));
  }

  const favoritesCount = exercises.filter((e) => e.is_favorite).length;
  const searchResults = search.trim()
    ? filterExercises(exercises, search.trim())
    : [];

  const searchListRef = useRef<HTMLDivElement>(null);
  const searchVirtualizer = useWindowVirtualizer({
    count: searchResults.length,
    estimateSize: () => 80,
    overscan: 5,
    scrollMargin: searchListRef.current?.offsetTop ?? 0,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t("exercises:title")}</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/search"
            aria-label={t("exercises:searchHistoryLabel")}
            title={t("exercises:searchHistoryLabel")}
            className="rounded-xl border p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <History className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button
            onClick={() => { setShowExerciseForm(true); setShowCategoryForm(false); setEditingCategory(null); }}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t("exercises:newExerciseButton")}
          </button>
        </div>
      </div>

      {/* Global search */}
      <label htmlFor="exercise-search" className="sr-only">{t("exercises:searchLabelAll")}</label>
      <input
        id="exercise-search"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("exercises:searchPlaceholderAll")}
        className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {/* Search results */}
      {search.trim() && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("exercises:resultsCount", { count: searchResults.length })}
          </p>
          {searchResults.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground text-sm">
              {t("exercises:noSearchResults", { search })}
            </div>
          ) : (
            <div ref={searchListRef} style={{ height: `${searchVirtualizer.getTotalSize()}px`, position: "relative" }}>
              {searchVirtualizer.getVirtualItems().map((virtualItem) => {
                const ex = searchResults[virtualItem.index]!;
                return (
                  <div
                    key={ex.id}
                    data-index={virtualItem.index}
                    ref={searchVirtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualItem.start - (searchListRef.current?.offsetTop ?? 0)}px)`,
                    }}
                    className="pb-2"
                  >
                    <ExerciseCard
                      exercise={ex}
                      stats={exerciseStats[ex.id]}
                      onEdit={() => {}}
                      onDelete={handleDeleteExercise}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* New exercise form */}
      {!search.trim() && showExerciseForm && (
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">{t("exercises:newExerciseHeading")}</h2>
          <ExerciseForm
            categories={categories}
            onSubmit={handleCreateExercise}
            onCancel={() => setShowExerciseForm(false)}
            onCreateCategory={handleCreateCategory}
          />
        </div>
      )}

      {/* Edit category form */}
      {!search.trim() && editingCategory && (
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">{t("exercises:editCategoryHeading")}</h2>
          <CategoryForm
            initial={editingCategory}
            onSubmit={handleUpdateCategory}
            onCancel={() => setEditingCategory(null)}
          />
        </div>
      )}

      {/* Favorites shortcut + category list — hidden during search */}
      {!search.trim() && favoritesCount > 0 && (
        <Link
          href="/exercise/favorites"
          className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 hover:bg-secondary/50 transition-colors"
        >
          <Star className="text-primary" size={20} fill="currentColor" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-medium text-sm">{t("exercises:favoritesLabel")}</p>
            <p className="text-xs text-muted-foreground">{t("exercises:exerciseCount", { count: favoritesCount })}</p>
          </div>
          <ChevronRight className="text-muted-foreground" size={16} aria-hidden="true" />
        </Link>
      )}

      {/* Category list — hidden during search */}
      {!search.trim() && <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("exercises:categoriesLabel")}</p>
          <button
            onClick={() => { setShowCategoryForm((v) => !v); setShowExerciseForm(false); setEditingCategory(null); }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {showCategoryForm ? t("common:cancel") : t("exercises:newCategoryToggleOpen")}
          </button>
        </div>

        {showCategoryForm && (
          <div className="rounded-2xl border bg-card p-4">
            <CategoryForm
              onSubmit={handleCreateStandaloneCategory}
              onCancel={() => setShowCategoryForm(false)}
            />
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-2xl border bg-secondary/30 animate-pulse" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title={t("exercises:emptyCategoriesTitle")}
            description={t("exercises:emptyCategoriesDescriptionWeb")}
            action={{ label: t("exercises:newCategoryHeading"), onClick: () => setShowCategoryForm(true) }}
          />
        ) : (
          categories.map((cat) => {
            const count = exercises.filter((e) => e.category_id === cat.id).length;
            const isDragging = draggedId === cat.id;
            const isDragOver = dragOverId === cat.id && draggedId !== cat.id;
            return (
              <div
                key={cat.id}
                data-testid={`category-row-${cat.name}`}
                draggable
                onDragStart={() => setDraggedId(cat.id)}
                onDragOver={(e) => { e.preventDefault(); setDragOverId(cat.id); }}
                onDragLeave={() => setDragOverId(null)}
                onDrop={() => handleCategoryDrop(cat.id)}
                onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                className={[
                  "flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 group cursor-grab active:cursor-grabbing transition-colors",
                  isDragging ? "opacity-40" : "",
                  isDragOver ? "border-primary bg-primary/5" : "",
                ].join(" ")}
              >
                <span title={t("exercises:dragToReorder")}>
                  <GripVertical className="text-muted-foreground select-none opacity-30 group-hover:opacity-70 transition-opacity" size={16} aria-hidden="true" />
                </span>
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${cat.color}22` }}
                >
                  <Dumbbell size={18} aria-hidden="true" style={{ color: cat.color }} />
                </div>
                <Link href={`/exercise/${cat.id}`} className="flex-1 hover:underline" onClick={(e) => draggedId && e.preventDefault()}>
                  <p className="font-medium text-sm">{cat.name}</p>
                  {count > 0 && (
                    <p className="text-xs text-muted-foreground">{t("exercises:exerciseCount", { count })}</p>
                  )}
                </Link>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditingCategory(cat); setShowExerciseForm(false); setShowCategoryForm(false); }}
                    className="rounded px-2 py-1 text-xs hover:bg-secondary"
                  >
                    {t("exercises:edit")}
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="rounded px-2 py-1 text-xs text-destructive hover:bg-secondary"
                  >
                    {t("common:delete")}
                  </button>
                </div>
                <Link href={`/exercise/${cat.id}`} className="text-muted-foreground ml-1" onClick={(e) => draggedId && e.preventDefault()}><ChevronRight size={16} aria-hidden="true" /></Link>
              </div>
            );
          })
        )}
      </div>}
    </div>
  );
}
