"use client";

/** Error boundary de la sección Medidas corporales: muestra el mensaje y permite reintentar el render. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-destructive/50 bg-card p-8 text-center space-y-3">
      <h2 className="font-semibold text-destructive">Algo ha salido mal</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <button
        onClick={reset}
        className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Intentar de nuevo
      </button>
    </div>
  );
}
