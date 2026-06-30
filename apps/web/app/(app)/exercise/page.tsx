"use client";

import { useEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { useExerciseStore, ExerciseType, filterExercises } from "@fitnotes/core";
import { createBrowserClient, createExerciseRepository } from "@fitnotes/database";
import ExerciseForm from "@/components/exercises/ExerciseForm";
import CategoryForm from "@/components/exercises/CategoryForm";
import ExerciseCard from "@/components/exercises/ExerciseCard";
import type { Category } from "@fitnotes/core";

export default function ExercisePage() {
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

  async function doCreateExercise(data: {
    name: string; category_id: string; type: ExerciseType; weight_unit: "kg" | "lb"; notes: string;
  }) {
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
  }

  async function handleCreateExercise(data: {
    name: string; category_id: string; type: ExerciseType; weight_unit: "kg" | "lb"; notes: string;
  }) {
    await doCreateExercise(data);
    setShowExerciseForm(false);
  }

  async function handleCreateExerciseAndNew(data: {
    name: string; category_id: string; type: ExerciseType; weight_unit: "kg" | "lb"; notes: string;
  }) {
    await doCreateExercise(data);
    // form stays open — ExerciseForm resets itself
  }

  async function handleCreateCategory(data: { name: string; color: string }): Promise<Category> {
    const { data: created, error } = await repo.createCategory(data, userId);
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
    if (!confirm("¿Eliminar esta categoría y todos sus ejercicios?")) return;
    const { error } = await repo.deleteCategory(id);
    if (error) return;
    deleteCategory(id);
  }

  async function handleToggleFavorite(id: string, current: boolean) {
    toggleFavorite(id);
    try {
      await repo.toggleFavorite(id, !current);
    } catch {
      toggleFavorite(id); // rollback
    }
  }

  async function handleDeleteExercise(id: string) {
    if (!confirm("¿Eliminar este ejercicio y todo su historial?")) return;
    const saved = exercises.find((e) => e.id === id);
    deleteExercise(id);
    const { error } = await repo.deleteExercise(id);
    if (error && saved) addExercise(saved);
  }

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
        <h1 className="text-3xl font-bold tracking-tight">Ejercicios</h1>
        <button
          onClick={() => { setShowExerciseForm(true); setShowCategoryForm(false); setEditingCategory(null); }}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + Nuevo ejercicio
        </button>
      </div>

      {/* Global search */}
      <label htmlFor="exercise-search" className="sr-only">Buscar ejercicios</label>
      <input
        id="exercise-search"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder='Buscar en todos los ejercicios… (p. ej. "press manc")'
        className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {/* Search results */}
      {search.trim() && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {searchResults.length} resultado{searchResults.length !== 1 ? "s" : ""}
          </p>
          {searchResults.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
              Sin ejercicios que coincidan con &ldquo;{search}&rdquo;
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
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Nuevo ejercicio</h2>
          <ExerciseForm
            categories={categories}
            onSubmit={handleCreateExercise}
            onSaveAndNew={handleCreateExerciseAndNew}
            onCancel={() => setShowExerciseForm(false)}
            onCreateCategory={handleCreateCategory}
          />
        </div>
      )}

      {/* Edit category form */}
      {!search.trim() && editingCategory && (
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Editar categoría</h2>
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
          className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-secondary/50 transition-colors"
        >
          <span className="text-xl">★</span>
          <div className="flex-1">
            <p className="font-medium text-sm">Favoritos</p>
            <p className="text-xs text-muted-foreground">{favoritesCount} ejercicio{favoritesCount !== 1 ? "s" : ""}</p>
          </div>
          <span className="text-muted-foreground">›</span>
        </Link>
      )}

      {/* Category list — hidden during search */}
      {!search.trim() && <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categorías</p>
          <button
            onClick={() => { setShowCategoryForm((v) => !v); setShowExerciseForm(false); setEditingCategory(null); }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {showCategoryForm ? "Cancelar" : "+ Nueva categoría"}
          </button>
        </div>

        {showCategoryForm && (
          <div className="rounded-lg border bg-card p-4">
            <CategoryForm
              onSubmit={handleCreateStandaloneCategory}
              onCancel={() => setShowCategoryForm(false)}
            />
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg border bg-secondary/30 animate-pulse" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
            Sin categorías aún.{" "}
            <button
              onClick={() => setShowCategoryForm(true)}
              className="underline hover:text-foreground"
            >
              Crear una
            </button>{" "}
            o añade un ejercicio y crea la categoría desde ahí.
          </div>
        ) : (
          categories.map((cat) => {
            const count = exercises.filter((e) => e.category_id === cat.id).length;
            const isDragging = draggedId === cat.id;
            const isDragOver = dragOverId === cat.id && draggedId !== cat.id;
            return (
              <div
                key={cat.id}
                draggable
                onDragStart={() => setDraggedId(cat.id)}
                onDragOver={(e) => { e.preventDefault(); setDragOverId(cat.id); }}
                onDragLeave={() => setDragOverId(null)}
                onDrop={() => handleCategoryDrop(cat.id)}
                onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                className={[
                  "flex items-center gap-3 rounded-lg border bg-card px-4 py-3 group cursor-grab active:cursor-grabbing transition-colors",
                  isDragging ? "opacity-40" : "",
                  isDragOver ? "border-primary bg-primary/5" : "",
                ].join(" ")}
              >
                <span className="text-muted-foreground select-none opacity-30 group-hover:opacity-70 transition-opacity" title="Arrastrar para reordenar">⠿</span>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                <Link href={`/exercise/${cat.id}`} className="flex-1 hover:underline" onClick={(e) => draggedId && e.preventDefault()}>
                  <p className="font-medium text-sm">{cat.name}</p>
                  {count > 0 && (
                    <p className="text-xs text-muted-foreground">{count} ejercicio{count !== 1 ? "s" : ""}</p>
                  )}
                </Link>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditingCategory(cat); setShowExerciseForm(false); setShowCategoryForm(false); }}
                    className="rounded px-2 py-1 text-xs hover:bg-secondary"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="rounded px-2 py-1 text-xs text-destructive hover:bg-secondary"
                  >
                    Eliminar
                  </button>
                </div>
                <Link href={`/exercise/${cat.id}`} className="text-muted-foreground ml-1" onClick={(e) => draggedId && e.preventDefault()}>›</Link>
              </div>
            );
          })
        )}
      </div>}
    </div>
  );
}
