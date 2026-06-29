export const SETTING_KEYS = {
  TRACK_PRS: "fitnotes_track_prs",
  AUTO_COMPLETE: "fitnotes_auto_complete",
  AUTO_NEXT_SET: "fitnotes_auto_next_set",
  KEEP_SCREEN_ON: "fitnotes_keep_screen_on",
  WEEK_START: "fitnotes_week_start",
  WEIGHT_UNIT: "fitnotes_weight_unit",
  AUTO_BACKUP_DRIVE: "fitnotes_auto_backup_drive",
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
