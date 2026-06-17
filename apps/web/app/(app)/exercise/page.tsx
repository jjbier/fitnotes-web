"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useExerciseStore } from "@fitnotes/core";
import { createBrowserClient, createExerciseRepository } from "@fitnotes/database";
import CategoryForm from "@/components/exercises/CategoryForm";
import type { Category } from "@fitnotes/core";

export default function ExercisePage() {
  const categories = useExerciseStore((s) => s.categories);
  const isLoading = useExerciseStore((s) => s.isLoading);
  const loadCategories = useExerciseStore((s) => s.loadCategories);
  const addCategory = useExerciseStore((s) => s.addCategory);
  const updateCategory = useExerciseStore((s) => s.updateCategory);
  const deleteCategory = useExerciseStore((s) => s.deleteCategory);
  const setLoading = useExerciseStore((s) => s.setLoading);
  const setError = useExerciseStore((s) => s.setError);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
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

  async function handleCreate(data: { name: string; color: string }) {
    const { data: created, error } = await repo.createCategory(data, userId);
    if (error) throw new Error(error.message);
    addCategory({
      id: created.id,
      name: created.name,
      color: created.color,
      order_index: created.order_index,
    });
    setShowForm(false);
  }

  async function handleUpdate(data: { name: string; color: string }) {
    if (!editing) return;
    const { data: updated, error } = await repo.updateCategory(editing.id, data);
    if (error) throw new Error(error.message);
    updateCategory(editing.id, { name: updated.name, color: updated.color });
    setEditing(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this category and all its exercises?")) return;
    const { error } = await repo.deleteCategory(id);
    if (error) return;
    deleteCategory(id);
  }

  const favoritesCount = useExerciseStore((s) =>
    s.exercises.filter((e) => e.is_favorite).length
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Exercises</h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + New Category
        </button>
      </div>

      {/* New category form */}
      {showForm && (
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">New Category</h2>
          <CategoryForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Edit category form */}
      {editing && (
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Edit Category</h2>
          <CategoryForm
            initial={editing}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
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
            <p className="font-medium text-sm">Favorites</p>
            <p className="text-xs text-muted-foreground">{favoritesCount} exercise{favoritesCount !== 1 ? "s" : ""}</p>
          </div>
          <span className="text-muted-foreground">›</span>
        </Link>
      )}

      {/* Category list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg border bg-secondary/30 animate-pulse" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
          No categories yet. Create one to start adding exercises.
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => {
            const count = useExerciseStore
              .getState()
              .exercises.filter((e) => e.category_id === cat.id).length;
            return (
              <div
                key={cat.id}
                className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 group"
              >
                {/* Color dot */}
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />

                {/* Link to exercise list */}
                <Link
                  href={`/exercise/${cat.id}`}
                  className="flex-1 hover:underline"
                >
                  <p className="font-medium text-sm">{cat.name}</p>
                  {count > 0 && (
                    <p className="text-xs text-muted-foreground">{count} exercise{count !== 1 ? "s" : ""}</p>
                  )}
                </Link>

                {/* Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditing(cat)}
                    className="rounded px-2 py-1 text-xs hover:bg-secondary"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id)}
                    className="rounded px-2 py-1 text-xs text-destructive hover:bg-secondary"
                  >
                    Delete
                  </button>
                </div>

                <Link href={`/exercise/${cat.id}`} className="text-muted-foreground ml-1">›</Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
