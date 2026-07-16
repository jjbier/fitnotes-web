import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Título de pestaña ("Rutinas") para todas las rutas bajo `/routines`. */
export const metadata: Metadata = { title: "Rutinas" };

/** Layout pasthrough de la sección Rutinas: solo aplica el `metadata` de arriba. */
export default function Layout({ children }: { children: ReactNode }) { return <>{children}</>; }
