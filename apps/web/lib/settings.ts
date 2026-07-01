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
} as const;

export function readBool(key: string, defaultValue = true): boolean {
  if (typeof window === "undefined") return defaultValue;
  const v = localStorage.getItem(key);
  return v === null ? defaultValue : v === "true";
}

export function writeBool(key: string, value: boolean) {
  localStorage.setItem(key, String(value));
}

export function readWeekStart(): 0 | 1 {
  if (typeof window === "undefined") return 1;
  return localStorage.getItem(SETTING_KEYS.WEEK_START) === "0" ? 0 : 1;
}

export function readDefaultWeightIncrement(): number {
  if (typeof window === "undefined") return 2.5;
  const v = parseFloat(localStorage.getItem(SETTING_KEYS.DEFAULT_WEIGHT_INCREMENT) ?? "");
  return Number.isFinite(v) && v > 0 ? v : 2.5;
}

export function readEstimatedRecordsRepLimit(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const v = parseInt(localStorage.getItem(SETTING_KEYS.ESTIMATED_RECORDS_REP_LIMIT) ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

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

export function writeHiddenCategories(ids: string[]) {
  localStorage.setItem(SETTING_KEYS.HIDDEN_CATEGORIES, JSON.stringify(ids));
}
