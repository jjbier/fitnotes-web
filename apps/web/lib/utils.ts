/**
 * Utilidad genérica de composición de clases Tailwind, usada en todo
 * `apps/web` para combinar clases condicionales de forma segura.
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina clases CSS condicionales (`clsx`) y resuelve conflictos entre
 * utilidades de Tailwind del mismo grupo (`twMerge`) — p. ej.
 * `cn("px-2", condition && "px-4")` deja solo `px-4` si `condition` es
 * verdadero, en vez de aplicar ambas.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
