import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@fitnotes/database";

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
