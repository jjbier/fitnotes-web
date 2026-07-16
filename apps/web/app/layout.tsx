/**
 * Layout raíz de la app Next.js. Define el documento HTML (idioma español), importa los estilos
 * globales y envuelve toda la aplicación en `ThemeProvider` (next-themes) para soportar tema
 * claro/oscuro/sistema con clase CSS en <html>.
 */
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";

/** Metadata global de Next.js: plantilla de título ("%s | FitNotes") y descripción por defecto. */
export const metadata: Metadata = {
  title: {
    template: "%s | FitNotes",
    default: "FitNotes",
  },
  description: "Tu seguimiento fitness personal",
};

/** Componente raíz del árbol de rutas: monta <html>/<body> y el proveedor de tema alrededor de children. */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
