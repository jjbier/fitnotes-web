/**
 * Login page
 *
 * Components: LoginForm (local), shadcn Card, Input, Button, Label
 * Stores: none (uses Supabase auth directly)
 * Actions: signInWithPassword, signInWithOtp (magic link)
 */

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground mt-2">Sign in to FitNotes App</p>
        </div>

        <div className="rounded-lg border bg-card p-8 shadow-sm space-y-4">
          {/* TODO: replace with shadcn Form + react-hook-form + zod validation */}
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <button className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Sign in
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <button className="w-full rounded-md border px-4 py-2 text-sm font-medium hover:bg-secondary">
            Send magic link
          </button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <a href="/register" className="font-medium text-primary hover:underline">
            Create one
          </a>
        </p>
      </div>
    </div>
  );
}
