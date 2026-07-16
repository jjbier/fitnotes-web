/**
 * Endpoint que inicia el flujo OAuth de Google Drive: construye la URL de consentimiento de Google
 * (scope `drive.file`, `access_type=offline` + `prompt=consent` para forzar un refresh_token) y
 * redirige al usuario allí. El `state` anti-CSRF se genera aquí y se guarda en una cookie httpOnly
 * de corta duración para que `/api/google/callback` pueda validarlo al volver.
 */
import { type NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * GET /api/google/auth
 * Sin parámetros de query relevantes. Responde con un redirect 307/302 a la pantalla de
 * consentimiento de Google (o un 503 JSON si `GOOGLE_CLIENT_ID` no está configurado en el
 * servidor). Fija la cookie `google_oauth_state` (10 min) usada para validar el callback.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google Drive no configurado en el servidor" }, { status: 503 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const state = crypto.randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/google/callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.file",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
    sameSite: "lax",
  });
  return response;
}
