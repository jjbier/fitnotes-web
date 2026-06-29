"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { createBrowserClient } from "@fitnotes/database";
import { SETTING_KEYS, readBool, writeBool, readWeekStart } from "@/lib/settings";

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

  // Advanced workout settings
  const [trackPRs, setTrackPRs] = useState(true);
  const [autoComplete, setAutoComplete] = useState(false);
  const [autoNextSet, setAutoNextSet] = useState(false);
  const [keepScreenOn, setKeepScreenOn] = useState(false);
  const [weekStart, setWeekStart] = useState<0 | 1>(1);

  const client = createBrowserClient();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    client.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setEmail(user.email ?? "");
      setDisplayName((user.user_metadata?.display_name as string | undefined) ?? "");
    });
    const stored = localStorage.getItem("fitnotes_weight_unit");
    if (stored === "lb" || stored === "kg") setWeightUnit(stored);

    setTrackPRs(readBool(SETTING_KEYS.TRACK_PRS, true));
    setAutoComplete(readBool(SETTING_KEYS.AUTO_COMPLETE, false));
    setAutoNextSet(readBool(SETTING_KEYS.AUTO_NEXT_SET, false));
    setKeepScreenOn(readBool(SETTING_KEYS.KEEP_SCREEN_ON, false));
    setWeekStart(readWeekStart());
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

  function handleToggle(key: string, current: boolean, setter: (v: boolean) => void) {
    const next = !current;
    setter(next);
    writeBool(key, next);
  }

  function handleWeekStart(value: 0 | 1) {
    setWeekStart(value);
    localStorage.setItem(SETTING_KEYS.WEEK_START, String(value));
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
      if (!workouts?.length) { alert("No hay entrenamientos para exportar."); return; }

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

  async function handleDeleteAccount() {
    const { error } = await client.rpc("delete_user");
    if (error) { alert(`Error al eliminar la cuenta: ${error.message}`); return; }
    await client.auth.signOut();
    window.location.href = "/login";
  }

  async function handleDeleteHistory() {
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;
    await client.from("workouts").delete().eq("user_id", user.id);
    setDeleteHistoryConfirm(false);
    alert("Historial de entrenamientos eliminado.");
  }

  function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: () => void }) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <button
          role="switch"
          aria-checked={checked}
          onClick={onChange}
          className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${checked ? "bg-primary" : "bg-secondary border"}`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-1"}`} />
        </button>
      </div>
    );
  }

  const themeOptions = [
    { value: "light", label: "Claro" },
    { value: "system", label: "Sistema" },
    { value: "dark", label: "Oscuro" },
  ] as const;

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>

      {/* Profile */}
      <section className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Perfil</h2>
        {email && <p className="text-sm text-muted-foreground">{email}</p>}
        <form onSubmit={handleSaveProfile} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nombre de usuario</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Tu nombre"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
            />
          </div>
          <button
            type="submit"
            disabled={saveStatus === "saving"}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saveStatus === "saving" ? "Guardando…" : saveStatus === "saved" ? "¡Guardado!" : saveStatus === "error" ? "Error — intentar de nuevo" : "Guardar cambios"}
          </button>
        </form>
      </section>

      {/* Preferences */}
      <section className="rounded-lg border bg-card p-6 space-y-5">
        <h2 className="font-semibold">Preferencias</h2>

        {/* Weight unit */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Unidad de peso predeterminada</p>
            <p className="text-xs text-muted-foreground">Usada en toda la app para mostrar el peso</p>
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
            <p className="text-sm font-medium">Tema</p>
            <p className="text-xs text-muted-foreground">Claro, oscuro o seguir preferencia del sistema</p>
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

      {/* Workout behaviour */}
      <section className="rounded-lg border bg-card p-6 space-y-5">
        <h2 className="font-semibold">Comportamiento del entrenamiento</h2>

        {/* Track PRs */}
        <ToggleRow
          label="Registrar récords personales"
          description="Muestra 🏆 cuando una serie iguala o supera tu récord personal"
          checked={trackPRs}
          onChange={() => handleToggle(SETTING_KEYS.TRACK_PRS, trackPRs, setTrackPRs)}
        />

        {/* Auto-complete set */}
        <ToggleRow
          label="Marcar series como completadas automáticamente"
          description="Al añadir una nueva serie, la anterior se marca como completada"
          checked={autoComplete}
          onChange={() => handleToggle(SETTING_KEYS.AUTO_COMPLETE, autoComplete, setAutoComplete)}
        />

        {/* Auto-next set */}
        <ToggleRow
          label="Seleccionar siguiente serie automáticamente"
          description="Tras completar una serie, el foco salta a la siguiente"
          checked={autoNextSet}
          onChange={() => handleToggle(SETTING_KEYS.AUTO_NEXT_SET, autoNextSet, setAutoNextSet)}
        />

        {/* Keep screen on */}
        <ToggleRow
          label="Mantener pantalla encendida"
          description="Evita que la pantalla se apague durante el entrenamiento (requiere permiso del navegador)"
          checked={keepScreenOn}
          onChange={() => handleToggle(SETTING_KEYS.KEEP_SCREEN_ON, keepScreenOn, setKeepScreenOn)}
        />

        {/* Week start */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Inicio de semana</p>
            <p className="text-xs text-muted-foreground">Primer día mostrado en el calendario</p>
          </div>
          <div className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => handleWeekStart(1)}
              className={`px-3 py-1.5 text-sm font-medium ${weekStart === 1 ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              Lunes
            </button>
            <button
              onClick={() => handleWeekStart(0)}
              className={`px-3 py-1.5 text-sm font-medium ${weekStart === 0 ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              Domingo
            </button>
          </div>
        </div>
      </section>

      {/* Data */}
      <section className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Datos</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Exportar entrenamientos</p>
            <p className="text-xs text-muted-foreground">Descargar todos los entrenamientos en CSV</p>
          </div>
          <button
            onClick={handleExportWorkouts}
            disabled={exportingWorkouts}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            {exportingWorkouts ? "Exportando…" : "Exportar CSV"}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Exportar medidas corporales</p>
            <p className="text-xs text-muted-foreground">Descargar todas las medidas en CSV</p>
          </div>
          <button
            onClick={handleExportBodyTracker}
            disabled={exportingBody}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            {exportingBody ? "Exportando…" : "Exportar CSV"}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Cerrar sesión en todos los dispositivos</p>
            <p className="text-xs text-muted-foreground">Invalida todas las sesiones activas</p>
          </div>
          <button
            onClick={handleSignOutAll}
            disabled={signOutLoading}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            Cerrar todas las sesiones
          </button>
        </div>
      </section>

      {/* Account */}
      <section className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Cuenta</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Cerrar sesión</p>
            <p className="text-xs text-muted-foreground">Cerrar sesión en este dispositivo</p>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signOutLoading}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            {signOutLoading ? "Cerrando sesión…" : "Cerrar sesión"}
          </button>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="rounded-lg border border-destructive/50 bg-card p-6 space-y-4">
        <h2 className="font-semibold text-destructive">Zona de peligro</h2>

        {/* Delete workout history */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Eliminar historial de entrenamientos</p>
            <p className="text-xs text-muted-foreground">Elimina permanentemente todos los datos de entrenamiento. No se puede deshacer.</p>
          </div>
          {deleteHistoryConfirm ? (
            <div className="flex gap-2">
              <button onClick={() => setDeleteHistoryConfirm(false)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">Cancelar</button>
              <button onClick={handleDeleteHistory} className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground">Confirmar</button>
            </div>
          ) : (
            <button onClick={() => setDeleteHistoryConfirm(true)} className="rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground">
              Eliminar historial
            </button>
          )}
        </div>

        {/* Delete account */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Eliminar cuenta</p>
            <p className="text-xs text-muted-foreground">Elimina permanentemente todos tus datos. No se puede deshacer.</p>
          </div>
          {deleteAccountConfirm ? (
            <div className="flex gap-2">
              <button onClick={() => setDeleteAccountConfirm(false)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">Cancelar</button>
              <button onClick={handleDeleteAccount} className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground">Confirmar eliminación</button>
            </div>
          ) : (
            <button onClick={() => setDeleteAccountConfirm(true)} className="rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground">
              Eliminar cuenta
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
