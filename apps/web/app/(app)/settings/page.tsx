"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { createBrowserClient } from "@fitnotes/database";
import { SETTING_KEYS, readBool, writeBool, readWeekStart } from "@/lib/settings";

type BackupEntry = Record<string, unknown>;
type BackupData = {
  version: number;
  exported_at: string;
  categories: BackupEntry[];
  exercises: BackupEntry[];
  routines: BackupEntry[];
  routine_days: BackupEntry[];
  routine_day_exercises: BackupEntry[];
  predefined_sets: BackupEntry[];
  body_measurements: BackupEntry[];
  body_measurement_entries: BackupEntry[];
  workouts: BackupEntry[];
  workout_exercises: BackupEntry[];
  sets: BackupEntry[];
  personal_records: BackupEntry[];
  exercise_goals: BackupEntry[];
};

function isBackupData(v: unknown): v is BackupData {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return o.version === 1 && typeof o.exported_at === "string" && Array.isArray(o.workouts);
}

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
  // Google Drive
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveLastBackup, setDriveLastBackup] = useState<string | null>(null);
  const [driveLastBackupUrl, setDriveLastBackupUrl] = useState<string | null>(null);
  const [driveBacking, setDriveBacking] = useState(false);
  const [driveDisconnecting, setDriveDisconnecting] = useState(false);
  const [autoBackupDrive, setAutoBackupDrive] = useState(false);

  const [backingUp, setBackingUp] = useState(false);
  const [restoreData, setRestoreData] = useState<BackupData | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreStep, setRestoreStep] = useState("");
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreDone, setRestoreDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Advanced workout settings
  const [trackPRs, setTrackPRs] = useState(true);
  const [autoComplete, setAutoComplete] = useState(false);
  const [autoNextSet, setAutoNextSet] = useState(false);
  const [keepScreenOn, setKeepScreenOn] = useState(false);
  const [weekStart, setWeekStart] = useState<0 | 1>(1);
  const [recalcPRs, setRecalcPRs] = useState<"idle" | "running" | "done" | "error">("idle");

  const client = createBrowserClient();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    client.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setEmail(user.email ?? "");
      setDisplayName((user.user_metadata?.display_name as string | undefined) ?? "");
      const meta = user.user_metadata ?? {};
      setDriveConnected(!!meta.google_drive_refresh_token);
      setDriveLastBackup((meta.google_drive_last_backup as string | undefined) ?? null);
      setDriveLastBackupUrl((meta.google_drive_last_backup_url as string | undefined) ?? null);
    });
    setAutoBackupDrive(readBool(SETTING_KEYS.AUTO_BACKUP_DRIVE, false));
    // Handle OAuth callback params
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("drive") === "connected") {
        setDriveConnected(true);
        window.history.replaceState({}, "", "/settings");
      } else if (params.get("drive_error")) {
        alert(`Error conectando Google Drive: ${params.get("drive_error")}`);
        window.history.replaceState({}, "", "/settings");
      }
    }
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

  async function handleRecalcPRs() {
    setRecalcPRs("running");
    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user) { setRecalcPRs("error"); return; }

      await client.from("personal_records").delete().eq("user_id", user.id);

      const { data: weRows } = await client
        .from("workout_exercises")
        .select("id, exercise_id");
      if (!weRows?.length) { setRecalcPRs("done"); return; }

      const weIds = weRows.map((we) => we.id);
      const exerciseById = Object.fromEntries(weRows.map((we) => [we.id, we.exercise_id]));

      const { data: setRows } = await client
        .from("sets")
        .select("workout_exercise_id, weight, reps")
        .in("workout_exercise_id", weIds)
        .eq("is_complete", true)
        .eq("is_warmup", false)
        .not("weight", "is", null)
        .not("reps", "is", null);

      const prMap: Record<string, Record<number, number>> = {};
      for (const s of setRows ?? []) {
        const exId = exerciseById[s.workout_exercise_id];
        if (!exId || s.weight == null || s.reps == null) continue;
        if (!prMap[exId]) prMap[exId] = {};
        if (!prMap[exId][s.reps] || s.weight > prMap[exId][s.reps]!) {
          prMap[exId][s.reps] = s.weight;
        }
      }

      const records: { exercise_id: string; reps: number; weight: number; user_id: string }[] = [];
      for (const [exerciseId, repMap] of Object.entries(prMap)) {
        for (const [reps, weight] of Object.entries(repMap)) {
          records.push({ exercise_id: exerciseId, reps: Number(reps), weight, user_id: user.id });
        }
      }
      if (records.length > 0) {
        await client.from("personal_records").insert(records);
      }
      setRecalcPRs("done");
      setTimeout(() => setRecalcPRs("idle"), 3000);
    } catch {
      setRecalcPRs("error");
      setTimeout(() => setRecalcPRs("idle"), 3000);
    }
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

  async function handleDriveBackup() {
    setDriveBacking(true);
    try {
      const res = await fetch("/api/google/backup", { method: "POST" });
      const data = (await res.json()) as { success?: boolean; fileUrl?: string; exportedAt?: string; error?: string; code?: string };
      if (!res.ok) {
        if (data.code === "TOKEN_INVALID") setDriveConnected(false);
        alert(data.error ?? "Error al hacer la copia en Drive");
        return;
      }
      setDriveLastBackup(data.exportedAt ?? null);
      setDriveLastBackupUrl(data.fileUrl ?? null);
    } finally {
      setDriveBacking(false);
    }
  }

  async function handleDriveDisconnect() {
    setDriveDisconnecting(true);
    try {
      await fetch("/api/google/disconnect", { method: "POST" });
      setDriveConnected(false);
      setDriveLastBackup(null);
      setDriveLastBackupUrl(null);
      writeBool(SETTING_KEYS.AUTO_BACKUP_DRIVE, false);
      setAutoBackupDrive(false);
    } finally {
      setDriveDisconnecting(false);
    }
  }

  async function handleBackup() {
    setBackingUp(true);
    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;
      const uid = user.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = (table: string) => (client.from(table as never) as any).select("*").eq("user_id", uid);
      const [
        { data: cats }, { data: exs }, { data: rts }, { data: rds }, { data: rdes },
        { data: ps }, { data: bms }, { data: bmes }, { data: wos }, { data: wes }, { data: sets }, { data: prs },
      ] = await Promise.all([
        q("categories"), q("exercises"), q("routines"), q("routine_days"), q("routine_day_exercises"),
        q("predefined_sets"), q("body_measurements"), q("body_measurement_entries"),
        q("workouts"), q("workout_exercises"), q("sets"), q("personal_records"),
      ]);
      const { data: egs } = await q("exercise_goals");
      const backup: BackupData = {
        version: 1, exported_at: new Date().toISOString(),
        categories: cats ?? [], exercises: exs ?? [], routines: rts ?? [],
        routine_days: rds ?? [], routine_day_exercises: rdes ?? [], predefined_sets: ps ?? [],
        body_measurements: bms ?? [], body_measurement_entries: bmes ?? [],
        workouts: wos ?? [], workout_exercises: wes ?? [], sets: sets ?? [],
        personal_records: prs ?? [], exercise_goals: egs ?? [],
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitnotes-backup-${new Date().toISOString().split("T")[0]}.fitnotes`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBackingUp(false);
    }
  }

  function handleRestoreFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!isBackupData(parsed)) { alert("Archivo inválido o formato no reconocido."); return; }
        setRestoreData(parsed);
        setRestoreError(null);
        setRestoreDone(false);
      } catch {
        alert("No se pudo leer el archivo. Asegúrate de que es un archivo .fitnotes válido.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function executeRestore() {
    if (!restoreData) return;
    setRestoring(true);
    setRestoreError(null);
    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error("Sesión no válida");
      const uid = user.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tbl = (table: string) => client.from(table as never) as any;

      // Delete in FK-safe order
      const deleteTables = [
        "sets", "workout_exercises", "workouts", "personal_records",
        "predefined_sets", "routine_day_exercises", "routine_days", "routines",
        "body_measurement_entries", "body_measurements",
        "exercise_goals", "exercises", "categories",
      ];
      for (const table of deleteTables) {
        setRestoreStep(`Eliminando ${table}…`);
        const { error } = await tbl(table).delete().eq("user_id", uid);
        if (error) throw new Error(`Error eliminando ${table}: ${error.message}`);
      }

      // Insert in dependency order (no personal_records — rebuilt by SQL trigger on sets INSERT)
      const insertSteps: [string, BackupEntry[]][] = [
        ["categories", restoreData.categories],
        ["exercises", restoreData.exercises],
        ["routines", restoreData.routines],
        ["routine_days", restoreData.routine_days],
        ["routine_day_exercises", restoreData.routine_day_exercises],
        ["predefined_sets", restoreData.predefined_sets],
        ["body_measurements", restoreData.body_measurements],
        ["body_measurement_entries", restoreData.body_measurement_entries],
        ["workouts", restoreData.workouts],
        ["workout_exercises", restoreData.workout_exercises],
        ["sets", restoreData.sets],
        ["exercise_goals", restoreData.exercise_goals],
      ];
      const CHUNK = 500;
      for (const [table, rows] of insertSteps) {
        if (!rows.length) continue;
        setRestoreStep(`Restaurando ${table} (${rows.length})…`);
        const patched = rows.map((r) => ({ ...r, user_id: uid }));
        for (let i = 0; i < patched.length; i += CHUNK) {
          const { error } = await tbl(table).insert(patched.slice(i, i + CHUNK));
          if (error) throw new Error(`Error en ${table}: ${error.message}`);
        }
      }

      setRestoreDone(true);
      setRestoreStep("¡Restauración completada!");
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setRestoring(false);
    }
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
            <label htmlFor="display-name" className="text-xs font-medium text-muted-foreground">Nombre de usuario</label>
            <input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Tu nombre"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
            />
          </div>
          <button
            type="submit"
            disabled={saveStatus === "saving"}
            aria-live="polite"
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
          <div role="group" aria-label="Unidad de peso" className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => handleWeightUnit("kg")}
              aria-pressed={weightUnit === "kg"}
              className={`px-3 py-1.5 text-sm font-medium ${weightUnit === "kg" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              kg
            </button>
            <button
              onClick={() => handleWeightUnit("lb")}
              aria-pressed={weightUnit === "lb"}
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
            <div role="group" aria-label="Tema de la aplicación" className="flex rounded-md border overflow-hidden">
              {themeOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  aria-pressed={theme === value}
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
        {/* Recalculate PRs */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div>
            <p className="text-sm font-medium">Recalcular récords personales</p>
            <p className="text-xs text-muted-foreground">Escanea todo el historial de series y recalcula tus PRs desde cero</p>
          </div>
          <button
            onClick={handleRecalcPRs}
            disabled={recalcPRs === "running"}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            {recalcPRs === "running" ? "Calculando…" : recalcPRs === "done" ? "¡Listo!" : recalcPRs === "error" ? "Error — reintentar" : "Recalcular PRs"}
          </button>
        </div>
      </section>

      {/* Data */}
      <section className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Datos</h2>

        {/* Backup */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Copia de seguridad completa</p>
            <p className="text-xs text-muted-foreground">Descarga todos tus datos en un archivo <code className="text-xs">.fitnotes</code></p>
          </div>
          <button
            onClick={handleBackup}
            disabled={backingUp}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            {backingUp ? "Exportando…" : "Exportar .fitnotes"}
          </button>
        </div>

        {/* Restore */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Restaurar copia de seguridad</p>
            <p className="text-xs text-muted-foreground">Reemplaza todos tus datos con los de un archivo <code className="text-xs">.fitnotes</code></p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            Seleccionar archivo…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".fitnotes,.json"
            onChange={handleRestoreFileSelect}
            className="hidden"
          />
        </div>

        <div className="border-t" />

        {/* Google Drive */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" aria-hidden="true">
              <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0a15.92 15.92 0 0 0 2.1 8zm24.1-23.85-13.75-23.8a16.03 16.03 0 0 0-2.1 8v3.65L28.7 53h2zm32.9-3.65-13.75-23.8-13.75 23.8zm-8.05-27.45c-1.35-.8-2.9-1.25-4.5-1.25s-3.15.45-4.5 1.25L32.85 35.35h21.6l13.1-22.7zM73.05 53H56.3L70.05 76.8a16.42 16.42 0 0 0 3.3-3.3L87.3 45a15.96 15.96 0 0 0-2.1-8L73.05 53zm6.85 20.5-3.85-6.65a15.92 15.92 0 0 1-2.1 8l-13.75 23.8a15.92 15.92 0 0 0 3.3-3.3l13.75-23.85h2.65z" fill="#4285f4"/>
            </svg>
            <p className="text-sm font-medium">Google Drive</p>
            {driveConnected && (
              <span className="ml-auto text-xs text-green-600 font-medium">● Conectado</span>
            )}
          </div>

          {!driveConnected ? (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Conecta tu Google Drive para hacer copias automáticas</p>
              <a
                href="/api/google/auth"
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                Conectar Google Drive
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {driveLastBackup && (
                <p className="text-xs text-muted-foreground">
                  Última copia:{" "}
                  {new Date(driveLastBackup).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}
                  {driveLastBackupUrl && (
                    <a href={driveLastBackupUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-primary hover:underline">
                      Ver en Drive →
                    </a>
                  )}
                </p>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">Backup automático al finalizar entrenamiento</p>
                  <p className="text-xs text-muted-foreground">Sube una copia a Drive cada vez que termines</p>
                </div>
                <button
                  role="switch"
                  aria-checked={autoBackupDrive}
                  onClick={() => {
                    const next = !autoBackupDrive;
                    setAutoBackupDrive(next);
                    writeBool(SETTING_KEYS.AUTO_BACKUP_DRIVE, next);
                  }}
                  className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${autoBackupDrive ? "bg-primary" : "bg-secondary border"}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoBackupDrive ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleDriveBackup}
                  disabled={driveBacking}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {driveBacking ? "Subiendo…" : "Hacer copia ahora"}
                </button>
                <button
                  onClick={handleDriveDisconnect}
                  disabled={driveDisconnecting}
                  className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                >
                  {driveDisconnecting ? "Desconectando…" : "Desconectar"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t" />

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

      {/* Restore confirmation modal */}
      {restoreData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border bg-card shadow-xl p-6 space-y-5">
            <h3 className="text-lg font-semibold">Restaurar copia de seguridad</h3>

            <div className="rounded-lg bg-secondary/50 p-4 space-y-2">
              <p className="text-xs text-muted-foreground">
                Exportada: {new Date(restoreData.exported_at).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })}
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-1 text-sm">
                {([
                  ["Categorías", restoreData.categories.length],
                  ["Ejercicios", restoreData.exercises.length],
                  ["Rutinas", restoreData.routines.length],
                  ["Entrenamientos", restoreData.workouts.length],
                  ["Series", restoreData.sets.length],
                  ["Medidas corporales", restoreData.body_measurements.length],
                ] as [string, number][]).map(([label, count]) => (
                  <div key={label} className="flex items-baseline gap-1.5">
                    <span className="font-semibold tabular-nums">{count}</span>
                    <span className="text-muted-foreground text-xs">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm space-y-1">
              <p className="font-medium text-destructive">Atención</p>
              <p className="text-xs text-muted-foreground">
                Esta acción eliminará todos tus datos actuales y los reemplazará con los del archivo. No se puede deshacer.
              </p>
            </div>

            {restoreError && (
              <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{restoreError}</p>
            )}

            {restoring ? (
              <div className="flex items-center gap-3 py-1">
                <div className="h-4 w-4 shrink-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground">{restoreStep}</p>
              </div>
            ) : restoreDone ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-green-600">¡Restauración completada con éxito!</p>
                <button
                  onClick={() => { setRestoreData(null); setRestoreDone(false); router.refresh(); }}
                  className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Cerrar y recargar
                </button>
              </div>
            ) : (
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setRestoreData(null); setRestoreError(null); }}
                  className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-secondary"
                >
                  Cancelar
                </button>
                <button
                  onClick={executeRestore}
                  className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
                >
                  Restaurar datos
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
