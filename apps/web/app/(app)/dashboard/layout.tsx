import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Hoy" };

/** Layout de la ruta `/dashboard`: solo fija el título de pestaña ("Hoy") y renderiza `children` sin envoltorio visual propio. */
export default function Layout({ children }: { children: ReactNode }) { return <>{children}</>; }
