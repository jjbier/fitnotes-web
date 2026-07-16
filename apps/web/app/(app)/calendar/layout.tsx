import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Calendario" };

/** Layout de la ruta `/calendar`: solo fija el título de pestaña ("Calendario") y renderiza `children` sin envoltorio visual propio. */
export default function Layout({ children }: { children: ReactNode }) { return <>{children}</>; }
