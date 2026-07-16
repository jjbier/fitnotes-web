import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Título de pestaña ("Medidas corporales") para todas las rutas bajo `/body-tracker`. */
export const metadata: Metadata = { title: "Medidas corporales" };

/** Layout pasthrough de la sección Medidas corporales: solo aplica el `metadata` de arriba. */
export default function Layout({ children }: { children: ReactNode }) { return <>{children}</>; }
