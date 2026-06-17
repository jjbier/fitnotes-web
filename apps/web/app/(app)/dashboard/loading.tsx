export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-md bg-muted" />
      <div className="h-4 w-full rounded-md bg-muted" />
      <div className="h-4 w-3/4 rounded-md bg-muted" />
      <div className="h-64 rounded-lg bg-muted" />
    </div>
  );
}
