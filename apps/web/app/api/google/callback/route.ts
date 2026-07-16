/**
 * Callback OAuth de Google Drive: recibe el `code` de autorización, valida el `state` anti-CSRF
 * contra la cookie `google_oauth_state` fijada en /api/google/auth, intercambia el code por
 * tokens en el endpoint de token de Google, y guarda el `refresh_token` resultante en
 * `user_metadata.google_drive_refresh_token` del usuario de Supabase para poder subir backups a
 * Drive más adelante sin volver a pedir consentimiento.
 */
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@fitnotes/database";

/**
 * GET /api/google/callback
 * Query params esperados de Google: `code` (código de autorización), `state` (debe coincidir con
 * la cookie `google_oauth_state`), `error` (si el usuario denegó el consentimiento).
 * Siempre responde con un redirect a `/settings`, añadiendo `?drive=connected` en éxito o
 * `?drive_error=<motivo>` (`auth_failed` | `not_configured` | `token_failed` | `save_failed`) en
 * cualquier fallo del flujo.
 */
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
