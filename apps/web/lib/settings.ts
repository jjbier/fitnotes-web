/**
 * Helpers de lectura/escritura de ajustes de usuario en `localStorage` para
 * la web (equivalente a `UserPreferences`/`usePreferencesStore` en
 * `packages/core` para mobile, pero sin persistencia en SQLite ni
 * sincronización — la web sigue requiriendo cuenta y no tiene modo offline).
 * Todas las funciones de lectura son seguras en SSR (devuelven el valor por
 * defecto si `window` no existe).
 */

/** Claves de `localStorage` usadas para cada ajuste configurable de la web. */
export const SETTING_KEYS = {
  TRACK_PRS: "fitnotes_track_prs",
  AUTO_COMPLETE: "fitnotes_auto_complete",
  AUTO_NEXT_SET: "fitnotes_auto_next_set",
  KEEP_SCREEN_ON: "fitnotes_keep_screen_on",
  WEEK_START: "fitnotes_week_start",
  WEIGHT_UNIT: "fitnotes_weight_unit",
  AUTO_BACKUP_DRIVE: "fitnotes_auto_backup_drive",
  DEFAULT_WEIGHT_INCREMENT: "fitnotes_default_weight_increment",
  ESTIMATED_RECORDS_REP_LIMIT: "fitnotes_estimated_records_rep_limit",
  CALENDAR_SHOW_DAY_PANEL: "fitnotes_calendar_show_day_panel",
  CALENDAR_SHOW_CATEGORY_DOTS: "fitnotes_calendar_show_category_dots",
  SHOW_SET_COUNT_HOME: "fitnotes_show_set_count_home",
  HIDDEN_CATEGORIES: "fitnotes_hidden_categories",
  LANGUAGE: "fitnotes_language",
} as const;

/**
 * Lee un ajuste booleano genérico de `localStorage`. Devuelve
 * `defaultValue` tanto en SSR como si la clave no existe todavía.
 */
export function readBool(key: string, defaultValue = true): boolean {
  if (typeof window === "undefined") return defaultValue;
  const v = localStorage.getItem(key);
  return v === null ? defaultValue : v === "true";
}

/** Escribe un ajuste booleano genérico en `localStorage` (no comprueba SSR: llamar solo desde código de cliente). */
export function writeBool(key: string, value: boolean) {
  localStorage.setItem(key, String(value));
}

/** Día de inicio de semana configurado: `0` = domingo, `1` = lunes (por defecto). */
export function readWeekStart(): 0 | 1 {
  if (typeof window === "undefined") return 1;
  return localStorage.getItem(SETTING_KEYS.WEEK_START) === "0" ? 0 : 1;
}

/** Incremento de peso por defecto (kg) para series sin `weight_increment` propio en el ejercicio; `2.5` si no hay ajuste válido. */
export function readDefaultWeightIncrement(): number {
  if (typeof window === "undefined") return 2.5;
  const v = parseFloat(localStorage.getItem(SETTING_KEYS.DEFAULT_WEIGHT_INCREMENT) ?? "");
  return Number.isFinite(v) && v > 0 ? v : 2.5;
}

/** Límite de repeticiones para considerar un PR "estimado" (1RM calculado); `undefined` si no hay ajuste válido (sin límite). */
export function readEstimatedRecordsRepLimit(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const v = parseInt(localStorage.getItem(SETTING_KEYS.ESTIMATED_RECORDS_REP_LIMIT) ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

/**
 * Ids de categorías de ejercicio ocultas en la pantalla de inicio
 * (preferencia client-side, sin campo en la base de datos). Devuelve `[]`
 * ante cualquier error de parseo o valor inesperado en `localStorage`.
 */
export function readHiddenCategories(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SETTING_KEYS.HIDDEN_CATEGORIES);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Persiste la lista de ids de categorías ocultas como JSON en `localStorage`. */
export function writeHiddenCategories(ids: string[]) {
  localStorage.setItem(SETTING_KEYS.HIDDEN_CATEGORIES, JSON.stringify(ids));
}

/** Idioma de la interfaz configurado; `"es"` (por defecto) si no hay ajuste guardado o no es un idioma soportado. */
export function readLanguage(): "es" | "en" {
  if (typeof window === "undefined") return "es";
  return localStorage.getItem(SETTING_KEYS.LANGUAGE) === "en" ? "en" : "es";
}

/** Persiste el idioma de la interfaz elegido en `localStorage`. */
export function writeLanguage(lang: "es" | "en") {
  localStorage.setItem(SETTING_KEYS.LANGUAGE, lang);
}
