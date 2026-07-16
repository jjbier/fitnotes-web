/**
 * Barra de navegación inferior para viewport móvil (oculta en `md:` y
 * superior, ver `Sidebar` para el equivalente de escritorio). Replica las
 * mismas 6 secciones que las tabs de la app mobile nativa, para mantener
 * paridad de navegación entre plataformas.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Mismas 6 tabs que la app mobile.
const TAB_ITEMS = [
  { href: "/dashboard", label: "Hoy", icon: "🏠" },
  { href: "/calendar", label: "Calendario", icon: "📅" },
  { href: "/exercise", label: "Ejercicios", icon: "💪" },
  { href: "/progress", label: "Progreso", icon: "📈" },
  { href: "/routines", label: "Rutinas", icon: "📋" },
  { href: "/settings", label: "Configuración", icon: "⚙️" },
] as const;

// Rutas que cuelgan de "Configuración" (Medidas corporales, Herramientas):
// no tienen tab propia pero deben mantener "Configuración" resaltada.
const SETTINGS_SUBROUTES = ["/body-tracker", "/tools"];

/**
 * Renderiza las 6 tabs fijas en la parte inferior de la pantalla. Una tab se
 * marca activa si la ruta actual coincide exactamente, es una subruta suya
 * (`/exercise/123`), o —caso especial de "Configuración"— si la ruta
 * pertenece a `SETTINGS_SUBROUTES`.
 */
export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t bg-card">
      {TAB_ITEMS.map(({ href, label, icon }) => {
        const active =
          pathname === href ||
          pathname.startsWith(href + "/") ||
          (href === "/settings" && SETTINGS_SUBROUTES.some((r) => pathname === r || pathname.startsWith(r + "/")));
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="text-xl">{icon}</span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
