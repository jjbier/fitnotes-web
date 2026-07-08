"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Star, Dumbbell, MoreVertical } from "lucide-react";
import { formatLastUsedLabel, EXERCISE_TYPE_LABELS } from "@fitnotes/core";
import type { Exercise } from "@fitnotes/core";

interface Props {
  exercise: Exercise;
  stats?: { workout_count: number; last_used: string | null };
  onEdit: (exercise: Exercise) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
}

export default function ExerciseCard({ exercise, stats, onEdit, onDelete, onToggleFavorite }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function handleMenuToggle() {
    if (menuOpen) {
      setMenuOpen(false);
      setMenuPos(null);
      return;
    }
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setMenuOpen(true);
  }

  function closeMenu() {
    setMenuOpen(false);
    setMenuPos(null);
  }

  // Focus first menu item when menu opens
  useEffect(() => {
    if (menuOpen) {
      const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
      first?.focus();
    }
  }, [menuOpen]);

  // Close on Escape, restore focus to trigger
  useEffect(() => {
    if (!menuOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeMenu();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [menuOpen]);

  // Close on scroll to prevent stale fixed position
  useEffect(() => {
    if (!menuOpen) return;
    function handleScroll() { closeMenu(); }
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", handleScroll, { capture: true });
  }, [menuOpen]);

  return (
    <div data-testid={`exercise-row-${exercise.name}`} className="relative flex items-center justify-between rounded-2xl border bg-card px-4 py-3 hover:bg-secondary/30 transition-colors group">
      {/* Left */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Dumbbell className="text-primary" size={18} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0 ml-3">
        <p className="font-medium text-sm truncate">{exercise.name}</p>
        <span className="inline-block mt-0.5 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {EXERCISE_TYPE_LABELS[exercise.type]}
        </span>
        {exercise.notes && (
          <p className="text-xs text-muted-foreground mt-1 truncate">{exercise.notes}</p>
        )}
        {stats && (
          <p className="text-xs text-muted-foreground mt-1">
            {stats.workout_count} {stats.workout_count === 1 ? "sesión" : "sesiones"}
            {stats.last_used ? ` · ${formatLastUsedLabel(stats.last_used)}` : ""}
          </p>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-1 ml-3">
        {/* Favorite */}
        <button
          onClick={() => onToggleFavorite(exercise.id, exercise.is_favorite)}
          className="p-1.5 rounded-xl hover:bg-secondary transition-colors"
          aria-label={exercise.is_favorite ? "Quitar de favoritos" : "Añadir a favoritos"}
        >
          {exercise.is_favorite ? (
            <Star className="text-primary" size={16} fill="currentColor" aria-hidden="true" />
          ) : (
            <Star className="text-muted-foreground" size={16} aria-hidden="true" />
          )}
        </button>

        {/* Menu */}
        <div>
          <button
            ref={triggerRef}
            onClick={handleMenuToggle}
            data-testid={`exercise-options-${exercise.name}`}
            className="p-1.5 rounded-xl hover:bg-secondary transition-colors text-muted-foreground"
            aria-label="Opciones"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <MoreVertical size={16} aria-hidden="true" />
          </button>

          {menuOpen && menuPos && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={closeMenu}
                aria-hidden="true"
              />
              <div
                ref={menuRef}
                role="menu"
                aria-label={`Opciones para ${exercise.name}`}
                style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 50 }}
                className="w-40 rounded-xl border bg-card shadow-lg py-1"
              >
                <Link
                  href={`/exercise/history/${exercise.id}`}
                  onClick={closeMenu}
                  role="menuitem"
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-secondary focus:bg-secondary focus:outline-none"
                >
                  Historial
                </Link>
                <button
                  onClick={() => { onEdit(exercise); closeMenu(); }}
                  role="menuitem"
                  className="w-full text-left px-4 py-2 text-sm hover:bg-secondary focus:bg-secondary focus:outline-none"
                >
                  Editar
                </button>
                <button
                  onClick={() => { onDelete(exercise.id); closeMenu(); }}
                  role="menuitem"
                  className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-secondary focus:bg-secondary focus:outline-none"
                >
                  Eliminar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
