import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-md w-full">
        <h1 className="text-5xl font-bold tracking-tight text-foreground">404</h1>
        <p className="text-lg text-muted-foreground">
          No hemos encontrado la página que buscas.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
