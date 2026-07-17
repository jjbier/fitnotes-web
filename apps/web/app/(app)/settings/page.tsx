"use client";

/**
 * Página de configuración ("/settings"): perfil de usuario, preferencias (unidad de peso, tema),
 * comportamiento del entrenamiento (PRs, autocompletar series, inicio de semana, etc.), ajustes de
 * pantalla de inicio (categorías visibles), gestión de datos (backup/restauración .fitnotes,
 * integración con Google Drive, exportación a CSV) y zona de peligro (eliminar historial de
 * entrenamientos / eliminar cuenta). Todas las preferencias no ligadas a Supabase se persisten en
 * `localStorage` a través de `@/lib/settings`.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useTranslation, Trans } from "react-i18next";
import "@/lib/i18n";
import { createBrowserClient, createWorkoutRepository, createExerciseRepository } from "@fitnotes/database";
import { computeDefaultCatalogSeedPlan, resolveDefaultExerciseCatalog, type DefaultCatalogSeedPlan } from "@fitnotes/core";
import { SETTING_KEYS, readBool, writeBool, readWeekStart, readDefaultWeightIncrement, readEstimatedRecordsRepLimit, readHiddenCategories, writeHiddenCategories, readLanguage, writeLanguage } from "@/lib/settings";

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

/**
 * Type guard para validar que un JSON parseado desde un archivo `.fitnotes` tiene el shape mínimo
 * esperado de un backup (versión 1, `exported_at` string, `workouts` array) antes de intentar
 * restaurarlo.
 */
function isBackupData(v: unknown): v is BackupData {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return o.version === 1 && typeof o.exported_at === "string" && Array.isArray(o.workouts);
}

/** Dispara la descarga de `content` como archivo CSV con el nombre `filename`, vía un Blob y un enlace temporal. */
function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Componente de página de configuración. Carga el perfil y las preferencias al montar, y expone
 * un conjunto de handlers (documentados individualmente más abajo) para cada sección: perfil,
 * preferencias generales, comportamiento del entrenamiento, pantalla de inicio, backup/restore
 * local, integración con Google Drive, exportación CSV, cierre de sesión y zona de peligro.
 */
export default function SettingsPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
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
  const [deleteHistoryFrom, setDeleteHistoryFrom] = useState("");
  const [deleteHistoryTo, setDeleteHistoryTo] = useState("");
  const [deleteHistoryExerciseId, setDeleteHistoryExerciseId] = useState("");
  const [deleteHistoryLoading, setDeleteHistoryLoading] = useState(false);
  const [exerciseOptions, setExerciseOptions] = useState<{ id: string; name: string }[]>([]);
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

  // Default exercise catalog import
  const [catalogChecking, setCatalogChecking] = useState(false);
  const [catalogPlan, setCatalogPlan] = useState<DefaultCatalogSeedPlan | null>(null);
  const [catalogImporting, setCatalogImporting] = useState(false);
  const [catalogStep, setCatalogStep] = useState("");
  const [catalogDone, setCatalogDone] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Advanced workout settings
  const [trackPRs, setTrackPRs] = useState(true);
  const [autoComplete, setAutoComplete] = useState(false);
  const [autoNextSet, setAutoNextSet] = useState(false);
  const [keepScreenOn, setKeepScreenOn] = useState(false);
  const [weekStart, setWeekStart] = useState<0 | 1>(1);
  const [defaultWeightIncrement, setDefaultWeightIncrement] = useState("2.5");
  const [estimatedRecordsRepLimit, setEstimatedRecordsRepLimit] = useState("");
  const [recalcPRs, setRecalcPRs] = useState<"idle" | "running" | "done" | "error">("idle");

  // Home screen settings
  const [showSetCountHome, setShowSetCountHome] = useState(true);
  const [categories, setCategories] = useState<{ id: string; name: string; color: string }[]>([]);
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<string[]>([]);

  const client = createBrowserClient();

  /**
   * Efecto de montaje: hidrata todo el estado de la página de una sola vez — perfil y metadatos
   * de Google Drive desde Supabase Auth, resultado del callback OAuth de Drive vía query params
   * (`?drive=connected` / `?drive_error=...`), unidad de peso desde localStorage, todas las
   * preferencias de comportamiento/entrenamiento vía `@/lib/settings`, la lista de ejercicios (para
   * el selector de "eliminar historial") y las categorías (para el toggle de visibilidad en Inicio).
   */
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
        alert(t("settings:googleDrive.errorConnecting", { message: params.get("drive_error") }));
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
    setDefaultWeightIncrement(String(readDefaultWeightIncrement()));
    setEstimatedRecordsRepLimit(String(readEstimatedRecordsRepLimit() ?? ""));
    client.from("exercises").select("id, name").order("name").then(({ data }) => {
      setExerciseOptions(data ?? []);
    });
    setShowSetCountHome(readBool(SETTING_KEYS.SHOW_SET_COUNT_HOME, true));
    setHiddenCategoryIds(readHiddenCategories());
    createExerciseRepository(client).getCategories().then(({ data }) => {
      setCategories(data ?? []);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Activa/desactiva mostrar el contador de series completadas/totales en Inicio; persiste en localStorage. */
  function handleShowSetCountHome(next: boolean) {
    setShowSetCountHome(next);
    writeBool(SETTING_KEYS.SHOW_SET_COUNT_HOME, next);
  }

  /** Alterna si `categoryId` aparece en la lista de categorías ocultas y persiste el resultado en localStorage. */
  function handleToggleCategoryVisible(categoryId: string) {
    setHiddenCategoryIds((prev) => {
      const next = prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId];
      writeHiddenCategories(next);
      return next;
    });
  }

  /** Guarda el nombre de usuario (`displayName`) en `user_metadata.display_name` vía Supabase Auth y refleja el resultado en `saveStatus` (se resetea a "idle" tras 2s). */
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaveStatus("saving");
    const { error } = await client.auth.updateUser({
      data: { display_name: displayName },
    });
    setSaveStatus(error ? "error" : "saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  }

  /** Cambia la unidad de peso predeterminada de la app y la persiste en localStorage (`fitnotes_weight_unit`). */
  function handleWeightUnit(unit: "kg" | "lb") {
    setWeightUnit(unit);
    localStorage.setItem("fitnotes_weight_unit", unit);
  }

  /** Cambia el idioma de la interfaz (i18next) y lo persiste en localStorage. */
  function handleLanguageChange(lang: "es" | "en") {
    void i18n.changeLanguage(lang);
    writeLanguage(lang);
  }

  /** Helper genérico para toggles booleanos: invierte `current`, actualiza el estado local vía `setter` y persiste bajo `key` (uno de `SETTING_KEYS`). */
  function handleToggle(key: string, current: boolean, setter: (v: boolean) => void) {
    const next = !current;
    setter(next);
    writeBool(key, next);
  }

  /** Cambia el primer día de la semana mostrado en el calendario (0 = domingo, 1 = lunes) y lo persiste en localStorage. */
  function handleWeekStart(value: 0 | 1) {
    setWeekStart(value);
    localStorage.setItem(SETTING_KEYS.WEEK_START, String(value));
  }

  /** Actualiza el incremento de peso predeterminado para los botones +/- del entrenamiento; solo persiste en localStorage si `value` es un número finito y positivo. */
  function handleDefaultWeightIncrement(value: string) {
    setDefaultWeightIncrement(value);
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      localStorage.setItem(SETTING_KEYS.DEFAULT_WEIGHT_INCREMENT, String(parsed));
    }
  }

  /** Actualiza el límite de repeticiones para considerar una serie en el cálculo de récords estimados; persiste el valor si es un entero positivo válido, o lo elimina de localStorage si el campo se vacía/es inválido (sin límite). */
  function handleEstimatedRecordsRepLimit(value: string) {
    setEstimatedRecordsRepLimit(value);
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      localStorage.setItem(SETTING_KEYS.ESTIMATED_RECORDS_REP_LIMIT, String(parsed));
    } else {
      localStorage.removeItem(SETTING_KEYS.ESTIMATED_RECORDS_REP_LIMIT);
    }
  }

  /**
   * Recalcula desde cero todos los récords personales (PRs) del usuario: borra todas las filas de
   * `personal_records`, recorre el historial completo de series completadas (no calentamiento,
   * con peso y reps) agrupando por ejercicio+reps para quedarse con el peso máximo de cada
   * combinación, e inserta las filas resultantes. Usado como herramienta de recuperación cuando
   * los PRs remotos pueden haber quedado desincronizados del historial real. Estado reflejado en
   * `recalcPRs` ("running" → "done"/"error", vuelve a "idle" tras 3s).
   */
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

  /** Cierra la sesión de Supabase solo en este dispositivo/navegador y redirige a la home. */
  async function handleSignOut() {
    setSignOutLoading(true);
    await client.auth.signOut();
    router.push("/");
    router.refresh();
  }

  /** Cierra la sesión de Supabase en todos los dispositivos (`scope: "global"`), invalidando todos los refresh tokens activos, y redirige a la home. */
  async function handleSignOutAll() {
    setSignOutLoading(true);
    await client.auth.signOut({ scope: "global" });
    router.push("/");
    router.refresh();
  }

  /**
   * Exporta todos los entrenamientos del usuario a CSV: recorre cada workout, sus
   * workout_exercises y sets asociados, resuelve nombres de ejercicio y arma una fila por serie
   * (fecha, ejercicio, número de serie, peso, reps, distancia, tiempo, completada, comentario).
   * Descarga el resultado como `fitnotes-workouts.csv`. Avisa con un `alert` si no hay entrenamientos.
   */
  async function handleExportWorkouts() {
    setExportingWorkouts(true);
    try {
      const { data: workouts } = await client.from("workouts").select("*").order("date");
      if (!workouts?.length) { alert(t("settings:exportWorkouts.noDataMessage")); return; }

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

  /**
   * Exporta todas las entradas del body tracker a CSV: une cada `body_measurement_entry` con el
   * nombre/unidad de su medida y genera una fila por entrada (medida, valor, unidad, fecha,
   * comentario). Descarga el resultado como `fitnotes-body-tracker.csv`.
   */
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

  /**
   * Elimina permanentemente la cuenta del usuario invocando el RPC `delete_user` de Supabase
   * (borra la cuenta y, vía cascada en la base de datos, todos sus datos), cierra la sesión y
   * redirige a /login. Muestra un `alert` con el mensaje de error si el RPC falla, sin cerrar sesión.
   */
  async function handleDeleteAccount() {
    const { error } = await client.rpc("delete_user");
    if (error) { alert(t("settings:dangerZone.deleteAccountErrorMessage", { message: error.message })); return; }
    await client.auth.signOut();
    window.location.href = "/login";
  }

  /**
   * Dispara una copia de seguridad inmediata a Google Drive llamando a `POST /api/google/backup`.
   * Actualiza la fecha/URL del último backup en el estado local en éxito. Si el endpoint responde
   * con `code: "TOKEN_INVALID"`, marca Drive como desconectado en la UI; en cualquier error
   * muestra un `alert` con el mensaje.
   */
  async function handleDriveBackup() {
    setDriveBacking(true);
    try {
      const res = await fetch("/api/google/backup", { method: "POST" });
      const data = (await res.json()) as { success?: boolean; fileUrl?: string; exportedAt?: string; error?: string; code?: string };
      if (!res.ok) {
        if (data.code === "TOKEN_INVALID") setDriveConnected(false);
        alert(data.error ?? t("settings:googleDrive.errorBackup"));
        return;
      }
      setDriveLastBackup(data.exportedAt ?? null);
      setDriveLastBackupUrl(data.fileUrl ?? null);
    } finally {
      setDriveBacking(false);
    }
  }

  /**
   * Desconecta Google Drive llamando a `POST /api/google/disconnect`, limpia el estado local
   * relacionado (conectado, último backup) y desactiva el toggle de backup automático.
   */
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

  /**
   * Genera una copia de seguridad local completa: consulta en paralelo todas las tablas del
   * usuario (categorías, ejercicios, rutinas, entrenamientos, series, PRs, medidas corporales,
   * goals…), arma un único objeto `BackupData` versionado y lo descarga como archivo
   * `fitnotes-backup-<fecha>.fitnotes` (JSON) directamente en el navegador, sin pasar por Drive.
   */
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

  /**
   * Handler del `<input type="file">` de restauración: lee el archivo `.fitnotes`/`.json`
   * seleccionado, lo parsea como JSON y lo valida con `isBackupData`. Si es válido, guarda el
   * resultado en `restoreData` (lo que abre el modal de confirmación); si no, avisa con un `alert`.
   */
  function handleRestoreFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!isBackupData(parsed)) { alert(t("settings:restoreModal.invalidFile")); return; }
        setRestoreData(parsed);
        setRestoreError(null);
        setRestoreDone(false);
      } catch {
        alert(t("settings:restoreModal.readError"));
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  /**
   * Ejecuta la restauración confirmada por el usuario a partir de `restoreData`: borra todas las
   * tablas del usuario en orden seguro respecto a las foreign keys, y vuelve a insertar los datos
   * del backup en orden de dependencia (categorías → ejercicios → rutinas → … → sets → goals),
   * reasignando `user_id` al usuario actual y en lotes de 500 filas. No inserta `personal_records`
   * explícitamente porque el trigger SQL los reconstruye al insertar en `sets`. Actualiza
   * `restoreStep` para mostrar progreso y `restoreError`/`restoreDone` según el resultado.
   */
  async function executeRestore() {
    if (!restoreData) return;
    setRestoring(true);
    setRestoreError(null);
    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error(t("settings:restoreModal.sessionInvalid"));
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

  /**
   * Consulta las categorías/ejercicios actuales y calcula (vía
   * `computeDefaultCatalogSeedPlan`) qué falta por crear del catálogo por
   * defecto. Si no falta nada, avisa con un `alert` en vez de abrir el modal
   * de confirmación; si falta algo, guarda el plan en `catalogPlan` (lo que
   * abre el modal).
   */
  async function handleCheckCatalogImport() {
    setCatalogChecking(true);
    setCatalogError(null);
    try {
      const repo = createExerciseRepository(client);
      const [{ data: cats }, { data: exs }] = await Promise.all([repo.getCategories(), repo.getExercises()]);
      const catalog = resolveDefaultExerciseCatalog(
        t("exerciseCatalog:categories", { returnObjects: true }) as Record<string, string>,
        t("exerciseCatalog:exercises", { returnObjects: true }) as Record<string, string>
      );
      const plan = computeDefaultCatalogSeedPlan(cats ?? [], exs ?? [], catalog);
      if (plan.categoriesToCreateCount === 0 && plan.exercisesToCreateCount === 0) {
        alert(t("settings:catalogImport.alreadyDoneMessage"));
        return;
      }
      setCatalogDone(false);
      setCatalogPlan(plan);
    } finally {
      setCatalogChecking(false);
    }
  }

  /**
   * Ejecuta el plan calculado por `handleCheckCatalogImport`: crea las categorías que faltan
   * (una a una, para poder asignarles el `id` real a sus ejercicios) y luego sus ejercicios,
   * saltando lo que ya exista según el plan. Actualiza `catalogStep` para mostrar progreso y
   * refresca la lista de categorías de "Pantalla de inicio" al terminar.
   */
  async function executeCatalogImport() {
    if (!catalogPlan) return;
    setCatalogImporting(true);
    setCatalogError(null);
    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error(t("settings:restoreModal.sessionInvalid"));
      const repo = createExerciseRepository(client);
      const categoryIdByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));
      let createdCategories = 0;

      for (const catPlan of catalogPlan.categories) {
        const key = catPlan.name.trim().toLowerCase();
        let categoryId = categoryIdByName.get(key);
        if (!categoryId) {
          setCatalogStep(t("settings:catalogImport.creatingCategory", { name: catPlan.name }));
          const { data, error } = await repo.createCategory(
            { name: catPlan.name, order_index: categories.length + createdCategories },
            user.id
          );
          if (error || !data) throw new Error(`Error creando categoría "${catPlan.name}": ${error?.message ?? "desconocido"}`);
          categoryId = data.id;
          categoryIdByName.set(key, categoryId);
          createdCategories++;
        }
        for (const ex of catPlan.exercisesToCreate) {
          setCatalogStep(t("settings:catalogImport.creatingExercise", { name: ex.name }));
          const { error } = await repo.createExercise(
            { name: ex.name, category_id: categoryId, type: ex.type, weight_unit: "kg", is_favorite: false },
            user.id
          );
          if (error) throw new Error(`Error creando ejercicio "${ex.name}": ${error.message}`);
        }
      }

      setCatalogDone(true);
      setCatalogStep(t("settings:catalogImport.done"));
      const { data: refreshedCats } = await repo.getCategories();
      setCategories(refreshedCats ?? []);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCatalogImporting(false);
    }
  }

  /**
   * Elimina el historial de entrenamientos del usuario según los filtros opcionales de fecha
   * (`deleteHistoryFrom`/`deleteHistoryTo`) y ejercicio (`deleteHistoryExerciseId`) — si no se
   * indica ninguno, elimina todo el historial. Delegado en
   * `workoutRepository.deleteWorkoutHistory`. Muestra un `alert` con el número de elementos
   * eliminados al terminar.
   */
  async function handleDeleteHistory() {
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;
    setDeleteHistoryLoading(true);
    try {
      const repo = createWorkoutRepository(client);
      const count = await repo.deleteWorkoutHistory(user.id, {
        dateFrom: deleteHistoryFrom || undefined,
        dateTo: deleteHistoryTo || undefined,
        exerciseId: deleteHistoryExerciseId || undefined,
      });
      setDeleteHistoryConfirm(false);
      setDeleteHistoryFrom("");
      setDeleteHistoryTo("");
      setDeleteHistoryExerciseId("");
      alert(t("settings:dangerZone.deleteHistoryDeletedMessage", { count }));
    } finally {
      setDeleteHistoryLoading(false);
    }
  }

  /**
   * Fila reutilizable de preferencia on/off: etiqueta + descripción a la izquierda, switch
   * accesible (`role="switch"`) a la derecha. El `data-testid` se deriva del `label` normalizado
   * (slug ASCII en minúsculas) para poder seleccionarlo en tests E2E.
   */
  function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: () => void }) {
    const slug = label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
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
          data-testid={`toggle-${slug}`}
          className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${checked ? "bg-primary" : "bg-secondary border"}`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-1"}`} />
        </button>
      </div>
    );
  }

  const themeOptions = [
    { value: "light", label: t("common:light") },
    { value: "system", label: t("common:system") },
    { value: "dark", label: t("common:dark") },
  ] as const;

  const languageOptions = [
    { value: "es", label: t("settings:language.es") },
    { value: "en", label: t("settings:language.en") },
  ] as const;

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">{t("settings:title")}</h1>

      {/* Profile */}
      <section className="rounded-2xl border bg-card p-6 space-y-4">
        <h2 className="font-semibold">{t("settings:sections.profile")}</h2>
        {email && <p className="text-sm text-muted-foreground">{email}</p>}
        <form onSubmit={handleSaveProfile} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="display-name" className="text-xs font-medium text-muted-foreground">{t("settings:profile.displayNameLabelWeb")}</label>
            <input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("settings:profile.displayNamePlaceholder")}
              className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
            />
          </div>
          <button
            type="submit"
            disabled={saveStatus === "saving"}
            aria-live="polite"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saveStatus === "saving" ? t("settings:profile.saving") : saveStatus === "saved" ? t("settings:profile.saved") : saveStatus === "error" ? t("settings:profile.saveError") : t("settings:profile.saveButton")}
          </button>
        </form>
      </section>

      {/* Preferences */}
      <section className="rounded-2xl border bg-card p-6 space-y-5">
        <h2 className="font-semibold">{t("settings:sections.preferences")}</h2>

        {/* Weight unit */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t("settings:weightUnit.label")}</p>
            <p className="text-xs text-muted-foreground">{t("settings:weightUnit.descriptionWeb")}</p>
          </div>
          <div role="group" aria-label={t("settings:weightUnit.label")} className="flex rounded-xl border overflow-hidden">
            <button
              onClick={() => handleWeightUnit("kg")}
              aria-pressed={weightUnit === "kg"}
              className={`px-3 py-1.5 text-sm font-medium ${weightUnit === "kg" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              {t("common:kg")}
            </button>
            <button
              onClick={() => handleWeightUnit("lb")}
              aria-pressed={weightUnit === "lb"}
              className={`px-3 py-1.5 text-sm font-medium ${weightUnit === "lb" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              {t("common:lb")}
            </button>
          </div>
        </div>

        {/* Theme */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t("settings:theme.label")}</p>
            <p className="text-xs text-muted-foreground">{t("settings:theme.description")}</p>
          </div>
          {mounted && (
            <div role="group" aria-label={t("settings:theme.label")} className="flex rounded-xl border overflow-hidden">
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

        {/* Language */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t("settings:language.label")}</p>
            <p className="text-xs text-muted-foreground">{t("settings:language.description")}</p>
          </div>
          <div role="group" aria-label={t("settings:language.label")} className="flex rounded-xl border overflow-hidden">
            {languageOptions.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleLanguageChange(value)}
                aria-pressed={i18n.language === value}
                className={`px-3 py-1.5 text-sm font-medium ${i18n.language === value ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Workout behaviour */}
      <section className="rounded-2xl border bg-card p-6 space-y-5">
        <h2 className="font-semibold">{t("settings:sections.workoutBehaviour")}</h2>

        {/* Track PRs */}
        <ToggleRow
          label={t("settings:trackPRs.label")}
          description={t("settings:trackPRs.descriptionWeb")}
          checked={trackPRs}
          onChange={() => handleToggle(SETTING_KEYS.TRACK_PRS, trackPRs, setTrackPRs)}
        />

        {/* Auto-complete set */}
        <ToggleRow
          label={t("settings:autoComplete.label")}
          description={t("settings:autoComplete.description")}
          checked={autoComplete}
          onChange={() => handleToggle(SETTING_KEYS.AUTO_COMPLETE, autoComplete, setAutoComplete)}
        />

        {/* Auto-next set */}
        <ToggleRow
          label={t("settings:autoNextSet.labelWeb")}
          description={t("settings:autoNextSet.descriptionWeb")}
          checked={autoNextSet}
          onChange={() => handleToggle(SETTING_KEYS.AUTO_NEXT_SET, autoNextSet, setAutoNextSet)}
        />

        {/* Keep screen on */}
        <ToggleRow
          label={t("settings:keepScreenOn.label")}
          description={t("settings:keepScreenOn.description")}
          checked={keepScreenOn}
          onChange={() => handleToggle(SETTING_KEYS.KEEP_SCREEN_ON, keepScreenOn, setKeepScreenOn)}
        />

        {/* Week start */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t("settings:weekStart.labelWeb")}</p>
            <p className="text-xs text-muted-foreground">{t("settings:weekStart.descriptionWeb")}</p>
          </div>
          <div className="flex rounded-xl border overflow-hidden">
            <button
              onClick={() => handleWeekStart(1)}
              className={`px-3 py-1.5 text-sm font-medium ${weekStart === 1 ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              {t("common:monday")}
            </button>
            <button
              onClick={() => handleWeekStart(0)}
              className={`px-3 py-1.5 text-sm font-medium ${weekStart === 0 ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              {t("common:sunday")}
            </button>
          </div>
        </div>

        {/* Default weight increment */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t("settings:defaultWeightIncrement.labelWeb")}</p>
            <p className="text-xs text-muted-foreground">{t("settings:defaultWeightIncrement.descriptionWeb")}</p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="default-weight-increment" className="sr-only">{t("settings:defaultWeightIncrement.labelWeb")}</label>
            <input
              id="default-weight-increment"
              type="number"
              step="0.5"
              min="0.5"
              value={defaultWeightIncrement}
              onChange={(e) => handleDefaultWeightIncrement(e.target.value)}
              className="w-20 rounded-xl border px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring bg-background"
            />
            <span className="text-sm text-muted-foreground">{weightUnit}</span>
          </div>
        </div>

        {/* Estimated records rep limit */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t("settings:estimatedRecordsRepLimit.label")}</p>
            <p className="text-xs text-muted-foreground">{t("settings:estimatedRecordsRepLimit.descriptionWeb")}</p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="est-records-rep-limit" className="sr-only">{t("settings:estimatedRecordsRepLimit.label")}</label>
            <input
              id="est-records-rep-limit"
              type="number"
              step="1"
              min="1"
              placeholder={t("settings:estimatedRecordsRepLimit.placeholder")}
              value={estimatedRecordsRepLimit}
              onChange={(e) => handleEstimatedRecordsRepLimit(e.target.value)}
              className="w-24 rounded-xl border px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring bg-background"
            />
            <span className="text-sm text-muted-foreground">{t("settings:estimatedRecordsRepLimit.unit")}</span>
          </div>
        </div>
        {/* Recalculate PRs */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div>
            <p className="text-sm font-medium">{t("settings:recalcPRs.label")}</p>
            <p className="text-xs text-muted-foreground">{t("settings:recalcPRs.description")}</p>
          </div>
          <button
            onClick={handleRecalcPRs}
            disabled={recalcPRs === "running"}
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            {recalcPRs === "running" ? t("settings:recalcPRs.running") : recalcPRs === "done" ? t("settings:recalcPRs.doneWeb") : recalcPRs === "error" ? t("settings:recalcPRs.error") : t("settings:recalcPRs.buttonWeb")}
          </button>
        </div>
      </section>

      {/* Home screen */}
      <section className="rounded-2xl border bg-card p-6 space-y-4">
        <h2 className="font-semibold">{t("settings:sections.homeScreen")}</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t("settings:showSetCount.label")}</p>
            <p className="text-xs text-muted-foreground">{t("settings:showSetCount.descriptionWeb")}</p>
          </div>
          <button
            role="switch"
            aria-checked={showSetCountHome}
            onClick={() => handleShowSetCountHome(!showSetCountHome)}
            data-testid="toggle-show-set-count-home"
            className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${showSetCountHome ? "bg-primary" : "bg-secondary border"}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${showSetCountHome ? "translate-x-5" : "translate-x-1"}`} />
          </button>
        </div>

        <div className="border-t pt-3">
          <p className="text-sm font-medium mb-1">{t("settings:visibleCategories.label")}</p>
          <p className="text-xs text-muted-foreground mb-2">{t("settings:visibleCategories.descriptionWeb")}</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const visible = !hiddenCategoryIds.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => handleToggleCategoryVisible(cat.id)}
                  aria-pressed={visible}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${visible ? "bg-secondary/50" : "opacity-40"}`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Data */}
      <section className="rounded-2xl border bg-card p-6 space-y-4">
        <h2 className="font-semibold">{t("settings:sections.data")}</h2>

        {/* Backup */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t("settings:fullBackup.label")}</p>
            <p className="text-xs text-muted-foreground">
              <Trans i18nKey="settings:fullBackup.descriptionWeb" components={[<code key="0" className="text-xs" />]} />
            </p>
          </div>
          <button
            onClick={handleBackup}
            disabled={backingUp}
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            {backingUp ? t("settings:fullBackup.exporting") : t("settings:fullBackup.buttonWeb")}
          </button>
        </div>

        {/* Restore */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t("settings:restoreBackup.label")}</p>
            <p className="text-xs text-muted-foreground">
              <Trans i18nKey="settings:restoreBackup.descriptionWeb" components={[<code key="0" className="text-xs" />]} />
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            {t("settings:restoreBackup.buttonWeb")}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".fitnotes,.json"
            onChange={handleRestoreFileSelect}
            className="hidden"
          />
        </div>

        {/* Default catalog import */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t("settings:catalogImport.label")}</p>
            <p className="text-xs text-muted-foreground">{t("settings:catalogImport.descriptionWeb")}</p>
          </div>
          <button
            onClick={handleCheckCatalogImport}
            disabled={catalogChecking}
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            {catalogChecking ? t("settings:catalogImport.buttonChecking") : t("settings:catalogImport.button")}
          </button>
        </div>

        <div className="border-t" />

        {/* Google Drive */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" aria-hidden="true">
              <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0a15.92 15.92 0 0 0 2.1 8zm24.1-23.85-13.75-23.8a16.03 16.03 0 0 0-2.1 8v3.65L28.7 53h2zm32.9-3.65-13.75-23.8-13.75 23.8zm-8.05-27.45c-1.35-.8-2.9-1.25-4.5-1.25s-3.15.45-4.5 1.25L32.85 35.35h21.6l13.1-22.7zM73.05 53H56.3L70.05 76.8a16.42 16.42 0 0 0 3.3-3.3L87.3 45a15.96 15.96 0 0 0-2.1-8L73.05 53zm6.85 20.5-3.85-6.65a15.92 15.92 0 0 1-2.1 8l-13.75 23.8a15.92 15.92 0 0 0 3.3-3.3l13.75-23.85h2.65z" fill="#4285f4"/>
            </svg>
            <p className="text-sm font-medium">{t("settings:googleDrive.title")}</p>
            {driveConnected && (
              <span className="ml-auto text-xs text-green-600 font-medium">{t("settings:googleDrive.connected")}</span>
            )}
          </div>

          {!driveConnected ? (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{t("settings:googleDrive.connectDescription")}</p>
              <a
                href="/api/google/auth"
                className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                {t("settings:googleDrive.connectButton")}
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {driveLastBackup && (
                <p className="text-xs text-muted-foreground">
                  {t("settings:googleDrive.lastBackup")}{" "}
                  {new Date(driveLastBackup).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}
                  {driveLastBackupUrl && (
                    <a href={driveLastBackupUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-primary hover:underline">
                      {t("settings:googleDrive.viewInDrive")}
                    </a>
                  )}
                </p>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">{t("settings:googleDrive.autoBackupLabel")}</p>
                  <p className="text-xs text-muted-foreground">{t("settings:googleDrive.autoBackupDescription")}</p>
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
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {driveBacking ? t("settings:googleDrive.backingUp") : t("settings:googleDrive.backupNow")}
                </button>
                <button
                  onClick={handleDriveDisconnect}
                  disabled={driveDisconnecting}
                  className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                >
                  {driveDisconnecting ? t("settings:googleDrive.disconnecting") : t("settings:googleDrive.disconnect")}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t" />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t("settings:exportWorkouts.label")}</p>
            <p className="text-xs text-muted-foreground">{t("settings:exportWorkouts.description")}</p>
          </div>
          <button
            onClick={handleExportWorkouts}
            disabled={exportingWorkouts}
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            {exportingWorkouts ? t("settings:fullBackup.exporting") : t("settings:bodyExport.button")}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t("settings:bodyExport.label")}</p>
            <p className="text-xs text-muted-foreground">{t("settings:bodyExport.descriptionWeb")}</p>
          </div>
          <button
            onClick={handleExportBodyTracker}
            disabled={exportingBody}
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            {exportingBody ? t("settings:bodyExport.exporting") : t("settings:bodyExport.button")}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t("settings:signOutAll.label")}</p>
            <p className="text-xs text-muted-foreground">{t("settings:signOutAll.description")}</p>
          </div>
          <button
            onClick={handleSignOutAll}
            disabled={signOutLoading}
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            {t("settings:signOutAll.button")}
          </button>
        </div>
      </section>

      {/* Tools — mismo patrón que la app mobile (Herramientas ya no es una
          sección de primer nivel, se accede desde aquí) */}
      <section className="rounded-2xl border bg-card p-6 space-y-4">
        <h2 className="font-semibold">{t("settings:sections.tools")}</h2>
        <Link
          href="/tools"
          className="flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium hover:bg-secondary"
        >
          {t("settings:tools.calculators")}
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </section>

      {/* Health — igual que la sección "Salud" de mobile */}
      <section className="rounded-2xl border bg-card p-6 space-y-4">
        <h2 className="font-semibold">{t("settings:sections.health")}</h2>
        <Link
          href="/body-tracker"
          className="flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium hover:bg-secondary"
        >
          {t("settings:health.bodyMeasurements")}
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </section>

      {/* Account */}
      <section className="rounded-2xl border bg-card p-6 space-y-4">
        <h2 className="font-semibold">{t("settings:sections.account")}</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t("settings:account.signOut")}</p>
            <p className="text-xs text-muted-foreground">{t("settings:account.signOutDescription")}</p>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signOutLoading}
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            {signOutLoading ? t("settings:account.signingOut") : t("settings:account.signOut")}
          </button>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="rounded-2xl border border-destructive/50 bg-card p-6 space-y-4">
        <h2 className="font-semibold text-destructive">{t("settings:sections.dangerZone")}</h2>

        {/* Delete workout history */}
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">{t("settings:dangerZone.deleteHistoryLabel")}</p>
            <p className="text-xs text-muted-foreground">{t("settings:dangerZone.deleteHistoryDescriptionWeb")}</p>
          </div>
          {deleteHistoryConfirm && (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="del-hist-from" className="block text-xs text-muted-foreground mb-1">{t("settings:dangerZone.deleteHistoryFrom")}</label>
                <input
                  id="del-hist-from"
                  type="date"
                  value={deleteHistoryFrom}
                  onChange={(e) => setDeleteHistoryFrom(e.target.value)}
                  className="rounded-xl border px-2 py-1.5 text-sm bg-background"
                />
              </div>
              <div>
                <label htmlFor="del-hist-to" className="block text-xs text-muted-foreground mb-1">{t("settings:dangerZone.deleteHistoryTo")}</label>
                <input
                  id="del-hist-to"
                  type="date"
                  value={deleteHistoryTo}
                  onChange={(e) => setDeleteHistoryTo(e.target.value)}
                  className="rounded-xl border px-2 py-1.5 text-sm bg-background"
                />
              </div>
              <div>
                <label htmlFor="del-hist-ex" className="block text-xs text-muted-foreground mb-1">{t("settings:dangerZone.deleteHistoryExercise")}</label>
                <select
                  id="del-hist-ex"
                  value={deleteHistoryExerciseId}
                  onChange={(e) => setDeleteHistoryExerciseId(e.target.value)}
                  className="rounded-xl border px-2 py-1.5 text-sm bg-background"
                >
                  <option value="">{t("settings:dangerZone.deleteHistoryAll")}</option>
                  {exerciseOptions.map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            {deleteHistoryConfirm ? (
              <>
                <button onClick={() => setDeleteHistoryConfirm(false)} className="rounded-xl border px-3 py-1.5 text-sm hover:bg-secondary">{t("common:cancel")}</button>
                <button
                  onClick={handleDeleteHistory}
                  disabled={deleteHistoryLoading}
                  className="rounded-xl bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground disabled:opacity-50"
                >
                  {deleteHistoryLoading ? t("settings:dangerZone.deleteHistoryDeleting") : t("common:confirm")}
                </button>
              </>
            ) : (
              <button onClick={() => setDeleteHistoryConfirm(true)} className="rounded-xl border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground">
                Eliminar historial
              </button>
            )}
          </div>
        </div>

        {/* Delete account */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t("settings:dangerZone.deleteAccountLabel")}</p>
            <p className="text-xs text-muted-foreground">{t("settings:dangerZone.deleteAccountDescription")}</p>
          </div>
          {deleteAccountConfirm ? (
            <div className="flex gap-2">
              <button onClick={() => setDeleteAccountConfirm(false)} className="rounded-xl border px-3 py-1.5 text-sm hover:bg-secondary">{t("common:cancel")}</button>
              <button onClick={handleDeleteAccount} className="rounded-xl bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground">{t("settings:dangerZone.deleteAccountConfirmButton")}</button>
            </div>
          ) : (
            <button onClick={() => setDeleteAccountConfirm(true)} className="rounded-xl border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground">
              {t("settings:dangerZone.deleteAccountLabel")}
            </button>
          )}
        </div>
      </section>

      {/* Default catalog import confirmation modal */}
      {catalogPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border bg-card shadow-xl p-6 space-y-5">
            <h3 className="text-lg font-semibold">{t("settings:catalogImport.confirmTitle")}</h3>

            <div className="rounded-2xl bg-secondary/50 p-4 space-y-2 text-sm">
              <p>
                <Trans
                  i18nKey="settings:catalogImport.confirmMessage"
                  values={{ categories: catalogPlan.categoriesToCreateCount, exercises: catalogPlan.exercisesToCreateCount }}
                  components={[<span key="0" className="font-semibold tabular-nums" />, <span key="1" className="font-semibold tabular-nums" />]}
                />
              </p>
              {(catalogPlan.categoriesSkippedCount > 0 || catalogPlan.exercisesSkippedCount > 0) && (
                <p className="text-xs text-muted-foreground">
                  {t("settings:catalogImport.skippedNote", { categories: catalogPlan.categoriesSkippedCount, exercises: catalogPlan.exercisesSkippedCount })}
                </p>
              )}
            </div>

            {catalogError && (
              <p className="text-sm text-destructive rounded-xl bg-destructive/10 px-3 py-2">{catalogError}</p>
            )}

            {catalogImporting ? (
              <div className="flex items-center gap-3 py-1">
                <div className="h-4 w-4 shrink-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground">{catalogStep}</p>
              </div>
            ) : catalogDone ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-green-600">{t("settings:catalogImport.done")}</p>
                <button
                  onClick={() => setCatalogPlan(null)}
                  className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {t("common:close")}
                </button>
              </div>
            ) : (
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setCatalogPlan(null); setCatalogError(null); }}
                  className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-secondary"
                >
                  Cancelar
                </button>
                <button
                  onClick={executeCatalogImport}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Importar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Restore confirmation modal */}
      {restoreData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border bg-card shadow-xl p-6 space-y-5">
            <h3 className="text-lg font-semibold">{t("settings:restoreModal.title")}</h3>

            <div className="rounded-2xl bg-secondary/50 p-4 space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("settings:restoreModal.exportedAt", { date: new Date(restoreData.exported_at).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" }) })}
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-1 text-sm">
                {([
                  [t("settings:restoreModal.categories"), restoreData.categories.length],
                  [t("settings:restoreModal.exercises"), restoreData.exercises.length],
                  [t("settings:restoreModal.routines"), restoreData.routines.length],
                  [t("settings:restoreModal.workouts"), restoreData.workouts.length],
                  [t("settings:restoreModal.sets"), restoreData.sets.length],
                  [t("settings:restoreModal.bodyMeasurements"), restoreData.body_measurements.length],
                ] as [string, number][]).map(([label, count]) => (
                  <div key={label} className="flex items-baseline gap-1.5">
                    <span className="font-semibold tabular-nums">{count}</span>
                    <span className="text-muted-foreground text-xs">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm space-y-1">
              <p className="font-medium text-destructive">{t("settings:restoreModal.warningTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {t("settings:restoreModal.warningText")}
              </p>
            </div>

            {restoreError && (
              <p className="text-sm text-destructive rounded-xl bg-destructive/10 px-3 py-2">{restoreError}</p>
            )}

            {restoring ? (
              <div className="flex items-center gap-3 py-1">
                <div className="h-4 w-4 shrink-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground">{restoreStep}</p>
              </div>
            ) : restoreDone ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-green-600">{t("settings:restoreModal.doneMessage")}</p>
                <button
                  onClick={() => { setRestoreData(null); setRestoreDone(false); router.refresh(); }}
                  className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {t("settings:restoreModal.closeAndReload")}
                </button>
              </div>
            ) : (
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setRestoreData(null); setRestoreError(null); }}
                  className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-secondary"
                >
                  {t("common:cancel")}
                </button>
                <button
                  onClick={executeRestore}
                  className="rounded-xl bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
                >
                  {t("settings:restoreModal.confirmButton")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
