/** Layout de segmento para /tools: solo fija el título de página, no añade estructura visual propia. */
import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Metadata de Next.js para la sección: título de pestaña "Herramientas". */
export const metadata: Metadata = { title: "Herramientas" };

/** Layout pass-through: renderiza los children sin envoltorio adicional (el shell viene de app/(app)/layout.tsx). */
export default function Layout({ children }: { children: ReactNode }) { return <>{children}</>; }
