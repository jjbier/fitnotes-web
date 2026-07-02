import Link from "next/link";

export default function RootPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-md w-full">
        {/* Logo / Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6.5 6.5h11M6.5 17.5h11M12 2v20" />
              <circle cx="6.5" cy="12" r="2.5" fill="white" stroke="none" />
              <circle cx="17.5" cy="12" r="2.5" fill="white" stroke="none" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            FitNotes App
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Track your workouts, PRs and progress — all in one place.
          </p>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-2xl border border-input bg-background px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
          >
            Registrarse
          </Link>
        </div>

        {/* Feature bullets */}
        <ul className="text-sm text-muted-foreground space-y-1 pt-2">
          <li>Workout logging with sets, reps and weight</li>
          <li>Personal records tracked automatically</li>
          <li>Progress charts and body tracker</li>
        </ul>
      </div>
    </main>
  );
}
