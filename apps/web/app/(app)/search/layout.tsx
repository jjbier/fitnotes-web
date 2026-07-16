import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Título de pestaña ("Buscar ejercicio") para todas las rutas bajo `/search`. */
export const metadata: Metadata = { title: "Buscar ejercicio" };

/** Layout pasthrough de la sección Buscar: solo aplica el `metadata` de arriba. */
export default function Layout({ children }: { children: ReactNode }) { return <>{children}</>; }
