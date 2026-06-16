/**
 * Settings page
 *
 * Components: ThemeToggle (local stub), ProfileForm (local stub)
 * Stores: none (direct Supabase auth for profile updates)
 * Sections: Profile, Preferences (weight unit, theme), Account, Danger Zone
 */

export default function SettingsPage() {
  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      {/* Profile */}
      <section className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Profile</h2>
        <div className="space-y-2">
          <label className="text-sm font-medium">Display name</label>
          {/* TODO: load from Supabase auth.user.user_metadata */}
          <input
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Your name"
          />
        </div>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Save changes
        </button>
      </section>

      {/* Preferences */}
      <section className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Preferences</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Default weight unit</p>
            <p className="text-xs text-muted-foreground">Used for new exercises</p>
          </div>
          {/* TODO: toggle between kg / lb */}
          <div className="flex rounded-md border overflow-hidden">
            <button className="px-3 py-1.5 text-sm bg-primary text-primary-foreground">kg</button>
            <button className="px-3 py-1.5 text-sm hover:bg-secondary">lb</button>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="rounded-lg border border-destructive/50 bg-card p-6 space-y-4">
        <h2 className="font-semibold text-destructive">Danger Zone</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Delete account</p>
            <p className="text-xs text-muted-foreground">Permanently removes all your data</p>
          </div>
          <button className="rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground">
            Delete account
          </button>
        </div>
      </section>
    </div>
  );
}
