import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@fitnotes/database";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const settingsUrl = `${appUrl}/settings`;

  const expectedState = request.cookies.get("google_oauth_state")?.value;

  if (oauthError || !code || !state || state !== expectedState) {
    return NextResponse.redirect(`${settingsUrl}?drive_error=auth_failed`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${settingsUrl}?drive_error=not_configured`);
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${appUrl}/api/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  const tokens = (await tokenRes.json()) as { refresh_token?: string; error?: string };
  if (!tokenRes.ok || !tokens.refresh_token) {
    return NextResponse.redirect(`${settingsUrl}?drive_error=token_failed`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cs) =>
      cs.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, (options ?? {}) as Parameters<typeof cookieStore.set>[2])
      ),
  });

  const { error: updateError } = await supabase.auth.updateUser({
    data: { google_drive_refresh_token: tokens.refresh_token },
  });

  if (updateError) {
    return NextResponse.redirect(`${settingsUrl}?drive_error=save_failed`);
  }

  const response = NextResponse.redirect(`${settingsUrl}?drive=connected`);
  response.cookies.set("google_oauth_state", "", { maxAge: 0, path: "/" });
  return response;
}
