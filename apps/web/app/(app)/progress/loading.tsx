/** Esqueleto de carga (`Suspense` fallback) mostrado mientras se resuelve `/progress`. */
export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-xl bg-muted" />
      <div className="h-4 w-full rounded-xl bg-muted" />
      <div className="h-4 w-3/4 rounded-xl bg-muted" />
      <div className="h-64 rounded-2xl bg-muted" />
    </div>
  );
}
