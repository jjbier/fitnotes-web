/**
 * Body measurements tracker
 *
 * Components: MeasurementChart (local stub), AddEntryForm (local stub)
 * Stores: none (direct Supabase calls for now)
 * Data: loads BodyMeasurement list and latest BodyMeasurementEntry per measurement
 * Schema: bodyMeasurementEntrySchema from @fitnotes/core for validation
 */

export default function BodyTrackerPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Body Tracker</h1>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Add Measurement
        </button>
      </div>

      {/* TODO: render from Supabase body_measurements + body_measurement_entries */}
      <div className="grid gap-4 md:grid-cols-2">
        {[
          { name: "Body Weight", unit: "kg", value: "—" },
          { name: "Body Fat %", unit: "%", value: "—" },
          { name: "Chest", unit: "cm", value: "—" },
          { name: "Waist", unit: "cm", value: "—" },
        ].map((m) => (
          <div key={m.name} className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">{m.name}</h2>
              <span className="text-xs text-muted-foreground">{m.unit}</span>
            </div>
            <p className="text-3xl font-bold">{m.value}</p>
            <p className="text-xs text-muted-foreground mt-1">No entries yet</p>
            {/* TODO: render mini trend chart per measurement */}
          </div>
        ))}
      </div>

      {/* Log entry form */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-4">Log New Entry</h2>
        {/* TODO: implement with shadcn Form + bodyMeasurementEntrySchema validation */}
        <p className="text-sm text-muted-foreground">Entry form placeholder</p>
      </div>
    </div>
  );
}
