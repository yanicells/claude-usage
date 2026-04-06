"use client";

import { useEffect, useState } from "react";

import type { AppSettings } from "@/lib/types";

interface SettingsEditorProps {
  settings: AppSettings;
  onSaved: (settings: AppSettings) => void;
}

const days = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const buckets = ["1m", "1h", "1d"] as const;

export function SettingsEditor({ settings, onSaved }: SettingsEditorProps) {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  async function handleSave() {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(draft),
      });

      const data = (await response.json()) as { settings?: AppSettings; error?: string };

      if (!response.ok || !data.settings) {
        throw new Error(data.error || "Unable to save settings");
      }

      setMessage("Settings saved.");
      onSaved(data.settings);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Unable to save settings";
      setMessage(text);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">Pacing Settings</h2>
      <p className="mt-1 text-sm text-slate-500">
        Saved to local JSON file on the server, merged over env defaults.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-slate-600">Timezone</span>
          <input
            value={draft.timezone}
            onChange={(event) => setDraft({ ...draft, timezone: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
          />
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-slate-600">Reset Day</span>
          <select
            value={draft.resetDay}
            onChange={(event) => setDraft({ ...draft, resetDay: event.target.value as AppSettings["resetDay"] })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
          >
            {days.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-slate-600">Reset Hour</span>
          <input
            type="number"
            min={0}
            max={23}
            value={draft.resetHour}
            onChange={(event) => setDraft({ ...draft, resetHour: Number(event.target.value) })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
          />
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-slate-600">Weekly Target</span>
          <input
            type="number"
            min={1}
            value={draft.weeklyTargetPercent}
            onChange={(event) =>
              setDraft({
                ...draft,
                weeklyTargetPercent: Number(event.target.value),
              })
            }
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
          />
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-slate-600">Simple Daily Increment</span>
          <input
            type="number"
            min={1}
            value={draft.simpleDailyIncrement}
            onChange={(event) =>
              setDraft({
                ...draft,
                simpleDailyIncrement: Number(event.target.value),
              })
            }
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
          />
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-slate-600">Bucket Width</span>
          <select
            value={draft.bucketWidth}
            onChange={(event) => setDraft({ ...draft, bucketWidth: event.target.value as AppSettings["bucketWidth"] })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
          >
            {buckets.map((bucket) => (
              <option key={bucket} value={bucket}>
                {bucket}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
        {message ? <span className="text-sm text-slate-600">{message}</span> : null}
      </div>
    </section>
  );
}
