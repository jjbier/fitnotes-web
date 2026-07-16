import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Ejercicios" };

/** Layout de la ruta `/exercise` y sub-rutas: solo fija el título de pestaña ("Ejercicios") y renderiza `children` sin envoltorio visual propio. */
export default function Layout({ children }: { children: ReactNode }) { return <>{children}</>; }
