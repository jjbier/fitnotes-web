"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { createBrowserClient } from "@fitnotes/database";

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [exportingWorkouts, setExportingWorkouts] = useState(false);
  const [exportingBody, setExportingBody] = useState(false);
  const [deleteHistoryConfirm, setDeleteHistoryConfirm] = useState(false);
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState(false);

  const client = createBrowserClient();

  useEffect(() => {
    setMounted(true);
    client.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setEmail(user.email ?? "");
      setDisplayName((user.user_metadata?.display_name as string | undefined) ?? "");
    });
    const stored = localStorage.getItem("fitnotes_weight_unit");
    if (stored === "lb" || stored === "kg") setWeightUnit(stored);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaveStatus("saving");
    const { error } = await client.auth.updateUser({
      data: { display_name: displayName },
    });
    setSaveStatus(error ? "error" : "saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  }

  function handleWeightUnit(unit: "kg" | "lb") {
    setWeightUnit(unit);
    localStorage.setItem("fitnotes_weight_unit", unit);
  }

  async function handleSignOut() {
    setSignOutLoading(true);
    await client.auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function handleSignOutAll() {
    setSignOutLoading(true);
    await client.auth.signOut({ scope: "global" });
    router.push("/");
    router.refresh();
  }

  async function handleExportWorkouts() {
    setExportingWorkouts(true);
    try {
      const { data: workouts } = await client.from("workouts").select("*").order("date");
      if (!workouts?.length) { alert("No workouts to export."); return; }

      const weIds: string[] = [];
      const weByWorkout: Record<string, { id: string; exercise_id: string; order_index: number }[]> = {};
      for (const w of workouts) {
        const { data: wes } = await client
          .from("workout_exercises")
          .select("id, exercise_id, order_index")
          .eq("workout_id", w.id);
        if (wes) {
          weByWorkout[w.id] = wes as { id: string; exercise_id: string; order_index: number }[];
          weIds.push(...wes.map((we) => we.id));
        }
      }

      const { data: sets } = weIds.length
        ? await client.from("sets").select("*").in("workout_exercise_id", weIds)
        : { data: [] };

      const { data: exercises } = await client.from("exercises").select("id, name");
      const exMap: Record<string, string> = {};
      for (const ex of exercises ?? []) exMap[ex.id] = ex.name;

      const rows = ["date,exercise,set_number,weight,reps,distance,time_seconds,is_complete,comment"];
      for (const w of workouts) {
        const wes = weByWorkout[w.id] ?? [];
        for (const we of wes) {
          const exSets = (sets ?? []).filter((s) => s.workout_exercise_id === we.id);
          exSets.forEach((s, i) => {
            rows.push(
              [
                w.date,
                `"${exMap[we.exercise_id] ?? we.exercise_id}"`,
                i + 1,
                s.weight ?? "",
                s.reps ?? "",
                s.distance ?? "",
                s.time_seconds ?? "",
                s.is_complete,
                `"${(s.comment ?? "").replace(/"/g, '""')}"`,
              ].join(",")
            );
          });
        }
      }

      downloadCSV(rows.join("\n"), "fitnotes-workouts.csv");
    } finally {
      setExportingWorkouts(false);
    }
  }

  async function handleExportBodyTracker() {
    setExportingBody(true);
    try {
      const { data: measurements } = await client.from("body_measurements").select("id, name, unit");
      const mMap: Record<string, { name: string; unit: string }> = {};
      for (const m of measurements ?? []) mMap[m.id] = { name: m.name, unit: m.unit };

      const { data: entries } = await client
        .from("body_measurement_entries")
        .select("*")
        .order("recorded_at");

      const rows = ["measurement,value,unit,recorded_at,comment"];
      for (const e of entries ?? []) {
        const m = mMap[e.measurement_id] ?? { name: e.measurement_id, unit: "" };
        rows.push(
          [
            `"${m.name}"`,
            e.value,
            `"${m.unit}"`,
            e.recorded_at,
            `"${(e.comment ?? "").replace(/"/g, '""')}"`,
          ].join(",")
        );
      }

      downloadCSV(rows.join("\n"), "fitnotes-body-tracker.csv");
    } finally {
      setExportingBody(false);
    }
  }

  async function handleDeleteHistory() {
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;
    await client.from("workouts").delete().eq("user_id", user.id);
    setDeleteHistoryConfirm(false);
    alert("Workout history deleted.");
  }

  const themeOptions = [
    { value: "light", label: "Light" },
    { value: "system", label: "System" },
    { value: "dark", label: "Dark" },
  ] as const;

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      {/* Profile */}
      <section className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Profile</h2>
        {email && <p className="text-sm text-muted-foreground">{email}</p>}
        <form onSubmit={handleSaveProfile} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Display name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
            />
          </div>
          <button
            type="submit"
            disabled={saveStatus === "saving"}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved!" : saveStatus === "error" ? "Error — try again" : "Save changes"}
          </button>
        </form>
      </section>

      {/* Preferences */}
      <section className="rounded-lg border bg-card p-6 space-y-5">
        <h2 className="font-semibold">Preferences</h2>

        {/* Weight unit */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Default weight unit</p>
            <p className="text-xs text-muted-foreground">Used across the app for weight display</p>
          </div>
          <div className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => handleWeightUnit("kg")}
              className={`px-3 py-1.5 text-sm font-medium ${weightUnit === "kg" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              kg
            </button>
            <button
              onClick={() => handleWeightUnit("lb")}
              className={`px-3 py-1.5 text-sm font-medium ${weightUnit === "lb" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              lb
            </button>
          </div>
        </div>

        {/* Theme */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="text-xs text-muted-foreground">Light, dark, or follow system preference</p>
          </div>
          {mounted && (
            <div className="flex rounded-md border overflow-hidden">
              {themeOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`px-3 py-1.5 text-sm font-medium ${theme === value ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Data */}
      <section className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Data</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Export workouts</p>
            <p className="text-xs text-muted-foreground">Download all workouts as CSV</p>
          </div>
          <button
            onClick={handleExportWorkouts}
            disabled={exportingWorkouts}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            {exportingWorkouts ? "Exporting…" : "Export CSV"}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Export body tracker</p>
            <p className="text-xs text-muted-foreground">Download all measurements as CSV</p>
          </div>
          <button
            onClick={handleExportBodyTracker}
            disabled={exportingBody}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            {exportingBody ? "Exporting…" : "Export CSV"}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Sign out from all devices</p>
            <p className="text-xs text-muted-foreground">Invalidates all active sessions</p>
          </div>
          <button
            onClick={handleSignOutAll}
            disabled={signOutLoading}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            Sign out all
          </button>
        </div>
      </section>

      {/* Account */}
      <section className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Account</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Sign out</p>
            <p className="text-xs text-muted-foreground">Sign out of your account on this device</p>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signOutLoading}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            {signOutLoading ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="rounded-lg border border-destructive/50 bg-card p-6 space-y-4">
        <h2 className="font-semibold text-destructive">Danger Zone</h2>

        {/* Delete workout history */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Delete workout history</p>
            <p className="text-xs text-muted-foreground">Permanently removes all workout data. Cannot be undone.</p>
          </div>
          {deleteHistoryConfirm ? (
            <div className="flex gap-2">
              <button onClick={() => setDeleteHistoryConfirm(false)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">Cancel</button>
              <button onClick={handleDeleteHistory} className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground">Confirm</button>
            </div>
          ) : (
            <button onClick={() => setDeleteHistoryConfirm(true)} className="rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground">
              Delete history
            </button>
          )}
        </div>

        {/* Delete account */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Delete account</p>
            <p className="text-xs text-muted-foreground">Permanently removes all your data. Cannot be undone.</p>
          </div>
          {deleteAccountConfirm ? (
            <div className="flex gap-2">
              <button onClick={() => setDeleteAccountConfirm(false)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">Cancel</button>
              <button className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground">Confirm delete</button>
            </div>
          ) : (
            <button onClick={() => setDeleteAccountConfirm(true)} className="rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground">
              Delete account
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
