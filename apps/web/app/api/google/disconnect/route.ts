/**
 * Endpoint para desconectar Google Drive: intenta revocar el refresh token en Google
 * (best-effort, ignora errores) y borra los campos de Drive (`google_drive_refresh_token`,
 * `google_drive_last_backup`, `google_drive_last_backup_url`) de `user_metadata` en Supabase.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@fitnotes/database";

/**
 * POST /api/google/disconnect
 * Sin body. Requiere sesión de Supabase (401 si no hay usuario autenticado). Revoca el token en
 * Google si existe uno guardado y limpia los metadatos de Drive del usuario.
 * Devuelve `{ success: true }` en éxito.
 */
export async function POST() {
  const cookieStore = await cookies();
  const supabase = createServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cs) =>
      cs.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, (options ?? {}) as Parameters<typeof cookieStore.set>[2])
      ),
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const refreshToken = user.user_metadata?.google_drive_refresh_token as string | undefined;
  if (refreshToken) {
    // Best-effort revoke — ignore errors
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
      method: "POST",
    }).catch(() => {});
  }

  await supabase.auth.updateUser({
    data: {
      google_drive_refresh_token: null,
      google_drive_last_backup: null,
      google_drive_last_backup_url: null,
    },
  });

  return NextResponse.json({ success: true });
}
