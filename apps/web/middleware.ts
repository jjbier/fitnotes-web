/**
 * Middleware de Next.js que actúa como guard de sesión global: exige una
 * sesión Supabase válida para acceder a cualquier ruta salvo las públicas
 * (portada, login, registro), assets de Next.js, rutas de API y archivos
 * estáticos. Se ejecuta en el edge runtime antes de renderizar la página.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/** Rutas accesibles sin sesión iniciada. */
const PUBLIC_PATHS = ["/", "/login", "/register"];

/**
 * Comprueba la sesión Supabase (vía cookies) para cada request que matchea
 * `config.matcher` y redirige a `/login` si no hay usuario autenticado.
 * Si las variables de entorno de Supabase no están configuradas, deja pasar
 * la request sin comprobar (permite arrancar el proyecto sin credenciales
 * aún configuradas). Usa el patrón de `@supabase/ssr` de reconstruir la
 * `NextResponse` dentro de `setAll` para poder propagar cookies renovadas
 * tanto a la request entrante como a la respuesta.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pass through public routes and Next.js internals
  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const supabaseAnonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

  // Skip auth check if Supabase is not configured yet
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[]
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
