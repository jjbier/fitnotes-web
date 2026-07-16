import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Título de pestaña ("Progreso") para todas las rutas bajo `/progress`. */
export const metadata: Metadata = { title: "Progreso" };

/** Layout pasthrough de la sección Progreso: solo aplica el `metadata` de arriba. */
export default function Layout({ children }: { children: ReactNode }) { return <>{children}</>; }
