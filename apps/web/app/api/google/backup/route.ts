/**
 * Endpoint que ejecuta una copia de seguridad completa a Google Drive: refresca el access token
 * con el refresh_token guardado, exporta todas las tablas del usuario a un único JSON, lo sube a
 * Drive como archivo multipart, rota backups antiguos (se conservan como máximo
 * `MAX_DRIVE_BACKUPS`) y anota la fecha/URL del último backup en `user_metadata`.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@fitnotes/database";

type BackupEntry = Record<string, unknown>;

/**
 * Intercambia un refresh_token de Google por un access_token nuevo usando el endpoint OAuth
 * `token` con `grant_type=refresh_token`. Lanza si Google no devuelve `access_token` (token
 * revocado o inválido).
 */
async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!res.ok || !data.access_token) throw new Error("token_invalid");
  return data.access_token;
}

const MAX_DRIVE_BACKUPS = 5;

/**
 * Busca en Drive los archivos cuyo nombre contiene "fitnotes-backup-" (más recientes primero) y
 * elimina los que sobrepasan `MAX_DRIVE_BACKUPS`, para no acumular backups indefinidamente.
 */
async function rotateOldBackups(accessToken: string): Promise<void> {
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files?" +
      new URLSearchParams({
        q: "name contains 'fitnotes-backup-' and trashed = false",
        fields: "files(id,createdTime)",
        orderBy: "createdTime desc",
        spaces: "drive",
      }),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return;
  const data = (await res.json()) as { files?: { id: string; createdTime: string }[] };
  const files = data.files ?? [];
  const toDelete = files.slice(MAX_DRIVE_BACKUPS);
  await Promise.all(
    toDelete.map((f) =>
      fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    )
  );
}

/**
 * Sube un archivo JSON a Google Drive usando un request `multipart/related` (metadata + contenido
 * en un mismo body con boundary manual). Devuelve la `webViewLink` del archivo creado, o una URL
 * construida a partir del `id` si Drive no la incluye en la respuesta.
 */
async function uploadToDrive(accessToken: string, filename: string, content: string): Promise<string> {
  const boundary = `fitnotes_${Date.now()}`;
  const metadata = JSON.stringify({ name: filename, mimeType: "application/json" });
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadata,
    `--${boundary}`,
    "Content-Type: application/json",
    "",
    content,
    `--${boundary}--`,
  ].join("\r\n");

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  const data = (await res.json()) as { id?: string; webViewLink?: string; error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message ?? "Drive upload failed");
  return data.webViewLink ?? `https://drive.google.com/file/d/${data.id}`;
}

/**
 * POST /api/google/backup
 * Sin body. Requiere sesión de Supabase (401 si no hay usuario) y una cuenta de Google Drive ya
 * conectada (400 si no hay `google_drive_refresh_token` guardado; 503 si el servidor no tiene
 * configuradas las credenciales OAuth de Google).
 * Exporta todas las tablas del usuario, sube el JSON resultante a Drive y devuelve
 * `{ success: true, fileUrl, exportedAt }`. Si el refresh_token es inválido, lo limpia de
 * `user_metadata` y responde 401 con `code: "TOKEN_INVALID"` para que la UI pida reconectar.
 * En cualquier otro fallo responde 500 con el mensaje de error.
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

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const refreshToken = user.user_metadata?.google_drive_refresh_token as string | undefined;
  if (!refreshToken) {
    return NextResponse.json({ error: "Google Drive no conectado" }, { status: 400 });
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({ error: "Google Drive no configurado en el servidor" }, { status: 503 });
  }

  const uid = user.id;

  try {
    // Fetch all user tables in parallel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = (table: string) => (supabase.from(table as never) as any).select("*").eq("user_id", uid);
    const [
      { data: cats }, { data: exs }, { data: rts }, { data: rds }, { data: rdes },
      { data: ps }, { data: bms }, { data: bmes }, { data: wos }, { data: wes }, { data: sets }, { data: prs },
    ] = await Promise.all([
      q("categories"), q("exercises"), q("routines"), q("routine_days"), q("routine_day_exercises"),
      q("predefined_sets"), q("body_measurements"), q("body_measurement_entries"),
      q("workouts"), q("workout_exercises"), q("sets"), q("personal_records"),
    ]);
    const { data: egs } = await q("exercise_goals");

    const exportedAt = new Date().toISOString();
    const backup = {
      version: 1, exported_at: exportedAt,
      categories: (cats ?? []) as BackupEntry[], exercises: (exs ?? []) as BackupEntry[],
      routines: (rts ?? []) as BackupEntry[], routine_days: (rds ?? []) as BackupEntry[],
      routine_day_exercises: (rdes ?? []) as BackupEntry[], predefined_sets: (ps ?? []) as BackupEntry[],
      body_measurements: (bms ?? []) as BackupEntry[], body_measurement_entries: (bmes ?? []) as BackupEntry[],
      workouts: (wos ?? []) as BackupEntry[], workout_exercises: (wes ?? []) as BackupEntry[],
      sets: (sets ?? []) as BackupEntry[], personal_records: (prs ?? []) as BackupEntry[],
      exercise_goals: (egs ?? []) as BackupEntry[],
    };

    // Get fresh access token, upload
    let accessToken: string;
    try {
      accessToken = await refreshAccessToken(refreshToken);
    } catch {
      // Refresh token is invalid — clear it so the UI shows "not connected"
      await supabase.auth.updateUser({ data: { google_drive_refresh_token: null } });
      return NextResponse.json({ error: "Token de Google Drive inválido. Reconecta tu cuenta.", code: "TOKEN_INVALID" }, { status: 401 });
    }

    const filename = `fitnotes-backup-${exportedAt.split("T")[0]}.fitnotes`;
    const fileUrl = await uploadToDrive(accessToken, filename, JSON.stringify(backup, null, 2));
    await rotateOldBackups(accessToken);

    await supabase.auth.updateUser({
      data: { google_drive_last_backup: exportedAt, google_drive_last_backup_url: fileUrl },
    });

    return NextResponse.json({ success: true, fileUrl, exportedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
