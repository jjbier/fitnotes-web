/**
 * Utilidad de backup automático a Google Drive. Delega la subida real en el
 * endpoint de servidor `/api/google/backup` (que gestiona el token OAuth de
 * Google); este módulo solo decide, en base a un ajuste local, si dispara la
 * subida y qué hacer si el token dejó de ser válido.
 */

import { readBool, SETTING_KEYS } from "./settings";

/**
 * Llamado tras finalizar un entrenamiento. Si el ajuste
 * `SETTING_KEYS.AUTO_BACKUP_DRIVE` está activado, sube el backup a Drive en
 * segundo plano; si el endpoint responde `TOKEN_INVALID` (token de Google
 * caducado/revocado), desactiva el ajuste automáticamente para no seguir
 * reintentando en cada entrenamiento. Cualquier otro error (de red o
 * servidor) se ignora en silencio para no bloquear el flujo del usuario.
 */
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

/** Escribe un booleano en `localStorage` como string (`"true"`/`"false"`); no-op en SSR. */
function writeBool(key: string, value: boolean) {
  if (typeof window !== "undefined") localStorage.setItem(key, String(value));
}
