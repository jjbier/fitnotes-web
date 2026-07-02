"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserClient } from "@fitnotes/database";

// Mismas 6 secciones que las tabs de la app mobile (Hoy/Calendario/Ejercicios/
// Progreso/Rutinas/Configuración) — Medidas corporales y Herramientas se
// acceden desde Configuración, igual que en mobile.
const NAV_ITEMS = [
  { href: "/dashboard", label: "Hoy", icon: "🏠" },
  { href: "/calendar", label: "Calendario", icon: "📅" },
  { href: "/exercise", label: "Ejercicios", icon: "💪" },
  { href: "/progress", label: "Progreso", icon: "📈" },
  { href: "/routines", label: "Rutinas", icon: "📋" },
  { href: "/settings", label: "Configuración", icon: "⚙️" },
] as const;

// Rutas que cuelgan de Configuración (no son ítems propios del nav, pero
// deben mantener "Configuración" resaltado, igual que en mobile donde son
// pantallas empujadas desde la tab Configuración).
const SETTINGS_SUBROUTES = ["/body-tracker", "/tools"];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="hidden md:flex w-60 flex-col border-r bg-card min-h-screen">
      {/* Brand */}
      <Link href="/dashboard" className="flex items-center gap-2 px-6 py-5 border-b hover:bg-secondary/50 transition-colors">
        <span className="text-2xl">🏋️</span>
        <span className="font-bold text-lg">FitNotes</span>
      </Link>

      {/* Nav links */}
      <nav aria-label="Navegación principal" className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active =
            pathname === href ||
            pathname.startsWith(href + "/") ||
            (href === "/settings" && SETTINGS_SUBROUTES.some((r) => pathname === r || pathname.startsWith(r + "/")));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-secondary"
              }`}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
            U
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Cuenta</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-muted-foreground hover:text-foreground"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            ↩
          </button>
        </div>
      </div>
    </aside>
  );
}
