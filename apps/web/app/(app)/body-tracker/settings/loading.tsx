export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse max-w-2xl">
      <div className="h-8 w-64 rounded-md bg-muted" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-16 rounded-lg bg-muted" />
      ))}
    </div>
  );
}
