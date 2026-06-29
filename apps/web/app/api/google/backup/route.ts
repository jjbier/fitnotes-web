import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@fitnotes/database";

type BackupEntry = Record<string, unknown>;

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

    await supabase.auth.updateUser({
      data: { google_drive_last_backup: exportedAt, google_drive_last_backup_url: fileUrl },
    });

    return NextResponse.json({ success: true, fileUrl, exportedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
