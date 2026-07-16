/**
 * Hook de accesibilidad (WCAG AA) para atrapar el foco de teclado dentro de
 * un contenedor (típicamente un modal/diálogo) mientras esté activo, de modo
 * que Tab/Shift+Tab no se escape hacia el contenido de fondo.
 */

"use client";

import { useEffect } from "react";

/** Selector CSS de elementos considerados "enfocables" dentro del contenedor atrapado. */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Mientras `active` es `true`, enfoca automáticamente el primer elemento
 * enfocable dentro de `ref.current` y, en cada pulsación de Tab, hace que el
 * foco cicle dentro del contenedor: Tab desde el último elemento vuelve al
 * primero, y Shift+Tab desde el primero salta al último. Recalcula la lista
 * de enfocables en cada pulsación (en vez de cachearla) para tolerar
 * cambios dinámicos de contenido (p. ej. un elemento que aparece/desaparece
 * dentro del modal), filtrando los ocultos vía `[hidden]`/`offsetParent`.
 */
export function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;

    const first = el.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusables = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => !n.closest("[hidden]") && n.offsetParent !== null
      );
      if (!focusables.length) return;
      const firstEl = focusables[0]!;
      const lastEl = focusables[focusables.length - 1]!;
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [ref, active]);
}
