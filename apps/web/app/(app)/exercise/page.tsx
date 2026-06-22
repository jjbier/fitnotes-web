"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useExerciseStore, ExerciseType } from "@fitnotes/core";
import { createBrowserClient, createExerciseRepository } from "@fitnotes/database";
import ExerciseForm from "@/components/exercises/ExerciseForm";
import CategoryForm from "@/components/exercises/CategoryForm";
import type { Category } from "@fitnotes/core";

export default function ExercisePage() {
  const categories = useExerciseStore((s) => s.categories);
  const isLoading = useExerciseStore((s) => s.isLoading);
  const loadCategories = useExerciseStore((s) => s.loadCategories);
  const addCategory = useExerciseStore((s) => s.addCategory);
  const addExercise = useExerciseStore((s) => s.addExercise);
  const updateCategory = useExerciseStore((s) => s.updateCategory);
  const deleteCategory = useExerciseStore((s) => s.deleteCategory);
  const setLoading = useExerciseStore((s) => s.setLoading);
  const setError = useExerciseStore((s) => s.setError);
  const exercises = useExerciseStore((s) => s.exercises);

  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [userId, setUserId] = useState<string>("");

  const client = createBrowserClient();
  const repo = createExerciseRepository(client);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await client.auth.getUser();
      if (user) setUserId(user.id);
      const { data, error } = await repo.getCategories();
      if (error) { setError(error.message); return; }
      loadCategories(data ?? []);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateExercise(data: {
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
    setShowExerciseForm(false);
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

  const favoritesCount = exercises.filter((e) => e.is_favorite).length;

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

      {/* New exercise form */}
      {showExerciseForm && (
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Nuevo ejercicio</h2>
          <ExerciseForm
            categories={categories}
            onSubmit={handleCreateExercise}
            onCancel={() => setShowExerciseForm(false)}
            onCreateCategory={handleCreateCategory}
          />
        </div>
      )}

      {/* Edit category form */}
      {editingCategory && (
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Editar categoría</h2>
          <CategoryForm
            initial={editingCategory}
            onSubmit={handleUpdateCategory}
            onCancel={() => setEditingCategory(null)}
          />
        </div>
      )}

      {/* Favorites shortcut */}
      {favoritesCount > 0 && (
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

      {/* Category list */}
      <div className="space-y-2">
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
            return (
              <div
                key={cat.id}
                className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 group"
              >
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                <Link href={`/exercise/${cat.id}`} className="flex-1 hover:underline">
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
                <Link href={`/exercise/${cat.id}`} className="text-muted-foreground ml-1">›</Link>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
