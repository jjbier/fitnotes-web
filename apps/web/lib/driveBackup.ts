import { readBool, SETTING_KEYS } from "./settings";

/** Called after finishing a workout. Silently uploads to Drive if the setting is on. */
export async function autoBackupToDriveIfEnabled(): Promise<void> {
  if (!readBool(SETTING_KEYS.AUTO_BACKUP_DRIVE, false)) return;
  try {
    const res = await fetch("/api/google/backup", { method: "POST" });
    if (!res.ok) {
      const data = (await res.json()) as { code?: string };
      // If token became invalid, nothing we can do silently — user needs to reconnect
      if (data.code === "TOKEN_INVALID") writeBool(SETTING_KEYS.AUTO_BACKUP_DRIVE, false);
    }
  } catch {
    // Network error — silent fail, don't block the user
  }
}

function writeBool(key: string, value: boolean) {
  if (typeof window !== "undefined") localStorage.setItem(key, String(value));
}
