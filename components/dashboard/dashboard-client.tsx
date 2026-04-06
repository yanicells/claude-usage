"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  CompanionDashboardResponse,
  PaceStatus,
  UsageSnapshot,
} from "@/lib/companion-types";

function toDatetimeLocal(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60_000;
  const local = new Date(date.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
}

function nowDatetimeLocal(): string {
  return toDatetimeLocal(new Date().toISOString());
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function formatPaceStatus(status: PaceStatus): string {
  if (status === "on-track") {
    return "on track";
  }

  return status;
}

function formatTimestamp(iso: string, timezone: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(parsed);
  } catch {
    return parsed.toLocaleString();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function paceToneClasses(status: PaceStatus): string {
  if (status === "ahead") {
    return "bg-amber-100 text-amber-900 border-amber-300";
  }

  if (status === "behind") {
    return "bg-emerald-100 text-emerald-900 border-emerald-300";
  }

  return "bg-sky-100 text-sky-900 border-sky-300";
}

function SnapshotRow({ snapshot, timezone }: { snapshot: UsageSnapshot; timezone: string }) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">{formatTimestamp(snapshot.timestamp, timezone)}</p>
      <p className="mt-1 text-sm text-slate-700">
        5-hour: <span className="font-medium">{formatPercent(snapshot.fiveHourUsagePercent)}</span>
        {" · "}
        weekly: <span className="font-medium">{formatPercent(snapshot.weeklyUsagePercent)}</span>
      </p>
      {snapshot.notes ? <p className="mt-1 text-xs text-slate-600">{snapshot.notes}</p> : null}
    </li>
  );
}

export function DashboardClient() {
  const [data, setData] = useState<CompanionDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [fiveHourUsageInput, setFiveHourUsageInput] = useState("");
  const [weeklyUsageInput, setWeeklyUsageInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [timestampInput, setTimestampInput] = useState(nowDatetimeLocal());
  const [startNewWindow, setStartNewWindow] = useState(false);

  const hydrateFormFromResponse = useCallback((payload: CompanionDashboardResponse) => {
    setFiveHourUsageInput(String(payload.state.currentFiveHourUsagePercent));
    setWeeklyUsageInput(String(payload.state.currentWeeklyUsagePercent));
    setNotesInput(payload.state.notes);
    setTimestampInput(toDatetimeLocal(payload.state.lastUpdatedAt));
    setStartNewWindow(false);
  }, []);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/companion", { cache: "no-store" });
      const json = (await response.json()) as CompanionDashboardResponse & { error?: string };

      if (!response.ok || json.error) {
        throw new Error(json.error || "Failed to load companion data");
      }

      setData(json);
      hydrateFormFromResponse(json);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to load dashboard data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [hydrateFormFromResponse]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const handleSaveSnapshot = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      const parsedTimestamp = timestampInput ? new Date(timestampInput) : null;
      const timestampIso = parsedTimestamp && !Number.isNaN(parsedTimestamp.getTime())
        ? parsedTimestamp.toISOString()
        : new Date().toISOString();

      const response = await fetch("/api/companion/snapshot", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          fiveHourUsageInput,
          weeklyUsagePercent: weeklyUsageInput,
          notes: notesInput,
          timestamp: timestampIso,
          startNewFiveHourWindow: startNewWindow,
        }),
      });

      const json = (await response.json()) as CompanionDashboardResponse & { error?: string };

      if (!response.ok || json.error) {
        throw new Error(json.error || "Failed to save snapshot");
      }

      setData(json);
      hydrateFormFromResponse(json);
      setSaveMessage("Snapshot saved.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to save snapshot";
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [
    fiveHourUsageInput,
    hydrateFormFromResponse,
    notesInput,
    startNewWindow,
    timestampInput,
    weeklyUsageInput,
  ]);

  const heavyUseAnswer = useMemo(() => {
    if (!data) {
      return "Loading your current usage status...";
    }

    const fiveRemaining = data.computed.fiveHourRemainingPercent;
    const weeklyRemaining = data.computed.weeklyRemainingPercent;
    const paceStatus = data.computed.paceStatus;

    if (fiveRemaining >= 45 && weeklyRemaining >= 30 && paceStatus !== "ahead") {
      return "Yes. You still have comfortable room right now.";
    }

    if (fiveRemaining <= 15 || weeklyRemaining <= 15) {
      return "Use Claude more lightly right now and save room for later.";
    }

    if (paceStatus === "ahead") {
      return "Use Claude, but keep the pace lighter until tomorrow.";
    }

    return "You still have room today, but keep an eye on your next reset.";
  }, [data]);

  if (loading && !data) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 pb-14 pt-7 sm:px-6">
        <section className="rounded-3xl border border-slate-200 bg-white/95 p-6 text-sm text-slate-700 shadow-sm">
          Loading your personal Claude companion...
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-14 pt-7 sm:px-6">
      <section className="rounded-3xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-sky-50 to-emerald-50 p-6 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Claude Usage Companion</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-700">
          One personal dashboard to quickly see your 5-hour window, weekly pace, and how hard to use Claude today.
        </p>
      </section>

      {error ? (
        <section className="mt-5 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      {saveMessage ? (
        <section className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {saveMessage}
        </section>
      ) : null}

      {data ? (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{data.settings.fiveHourLimitLabel}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{formatPercent(data.state.currentFiveHourUsagePercent)}</p>
              <p className="mt-1 text-sm text-slate-600">You have used this much in your current 5-hour window.</p>
            </article>

            <article className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">5-hour remaining</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-900">{formatPercent(data.computed.fiveHourRemainingPercent)}</p>
              <p className="mt-1 text-sm text-emerald-900/80">Room left before the current 5-hour reset.</p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{data.settings.weeklyLimitLabel}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{formatPercent(data.state.currentWeeklyUsagePercent)}</p>
              <p className="mt-1 text-sm text-slate-600">Your current weekly usage.</p>
            </article>

            <article className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-sky-800">Weekly remaining</p>
              <p className="mt-2 text-3xl font-semibold text-sky-900">{formatPercent(data.computed.weeklyRemainingPercent)}</p>
              <p className="mt-1 text-sm text-sky-900/80">Percent left for the rest of this cycle.</p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm sm:col-span-2 xl:col-span-1">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Weekly pace status</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{formatPaceStatus(data.computed.paceStatus)}</p>
              <p className="mt-1 text-sm text-slate-600">
                By now, ideal is {formatPercent(data.computed.expectedWeeklyPercentNow)}. Delta is
                {" "}
                <span className="font-medium">
                  {data.computed.deltaWeeklyPercent > 0 ? "+" : ""}
                  {formatPercent(data.computed.deltaWeeklyPercent)}
                </span>
                .
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm sm:col-span-2 xl:col-span-1">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Next 5-hour reset</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {formatTimestamp(data.computed.nextFiveHourResetAt, data.settings.timezone)}
              </p>
              <p className="mt-1 text-sm text-slate-600">Timezone: {data.settings.timezone}</p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm sm:col-span-2 xl:col-span-2">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Next weekly reset</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {formatTimestamp(data.computed.nextWeeklyResetAt, data.settings.timezone)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Reset anchor: {data.settings.weeklyResetDay}, {String(data.settings.weeklyResetHour).padStart(2, "0")}:00.
              </p>
            </article>
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-5">
            <article className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm xl:col-span-2">
              <h2 className="text-lg font-semibold text-slate-900">Quick update</h2>
              <p className="mt-1 text-sm text-slate-600">Save a manual snapshot in a few seconds.</p>

              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-800">5-hour usage (% or fraction)</span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-300 transition focus:ring"
                    placeholder="Examples: 62 or 3/5"
                    value={fiveHourUsageInput}
                    onChange={(event) => setFiveHourUsageInput(event.target.value)}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-800">Weekly usage percent</span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-300 transition focus:ring"
                    placeholder="Example: 37"
                    value={weeklyUsageInput}
                    onChange={(event) => setWeeklyUsageInput(event.target.value)}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-800">Timestamp</span>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-300 transition focus:ring"
                    value={timestampInput}
                    onChange={(event) => setTimestampInput(event.target.value)}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-800">Notes (optional)</span>
                  <textarea
                    className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-300 transition focus:ring"
                    placeholder="Example: Used Claude heavily for coding this morning"
                    value={notesInput}
                    onChange={(event) => setNotesInput(event.target.value)}
                  />
                </label>

                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600"
                    checked={startNewWindow}
                    onChange={(event) => setStartNewWindow(event.target.checked)}
                  />
                  Start a fresh 5-hour window from this timestamp
                </label>

                <button
                  type="button"
                  onClick={() => void handleSaveSnapshot()}
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-cyan-400"
                >
                  {saving ? "Saving..." : "Save snapshot"}
                </button>
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm xl:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Weekly pacing</h2>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${paceToneClasses(
                    data.computed.paceStatus,
                  )}`}
                >
                  {formatPaceStatus(data.computed.paceStatus)}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                By this point in the week, your ideal pace is {formatPercent(data.computed.expectedWeeklyPercentNow)}.
                Current weekly usage is {formatPercent(data.state.currentWeeklyUsagePercent)}.
              </p>

              <ul className="mt-4 space-y-2">
                {data.computed.progression.map((point) => {
                  const target = Math.max(1, data.settings.weeklyTargetPercent);
                  const expectedRatio = clamp(
                    Math.round((point.expectedCumulativePercent / target) * 100),
                    0,
                    100,
                  );
                  const actualRatio = clamp(
                    Math.round((data.state.currentWeeklyUsagePercent / target) * 100),
                    0,
                    100,
                  );

                  return (
                    <li
                      key={point.slot}
                      className={`rounded-2xl border px-3 py-2 ${
                        point.isToday
                          ? "border-cyan-300 bg-cyan-50/70"
                          : "border-slate-200 bg-slate-50/80"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {point.shortLabel}
                          {point.isToday ? " (today)" : ""}
                        </p>
                        <p className="text-sm text-slate-700">Ideal: {formatPercent(point.expectedCumulativePercent)}</p>
                      </div>
                      <div className="relative mt-2 h-2 rounded-full bg-slate-200">
                        <div
                          className="h-2 rounded-full bg-cyan-500"
                          style={{ width: `${expectedRatio}%` }}
                        />
                        {point.isToday ? (
                          <span
                            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-cyan-900 bg-emerald-300"
                            style={{ left: `calc(${actualRatio}% - 6px)` }}
                          />
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-3 text-sm text-slate-700">
                {data.computed.deltaWeeklyPercent === 0
                  ? "You are exactly on today’s checkpoint."
                  : `Delta vs today’s checkpoint: ${data.computed.deltaWeeklyPercent > 0 ? "+" : ""}${formatPercent(
                      data.computed.deltaWeeklyPercent,
                    )}.`}
              </p>
            </article>
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-2">
            <article className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Guidance</h2>
              <p className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800">
                Can I still use Claude a lot right now? {heavyUseAnswer}
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {data.computed.guidance.map((line, index) => (
                  <li key={`${line}-${index}`} className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                    {line}
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Recent snapshots</h2>
              <p className="mt-1 text-sm text-slate-600">Your latest manual updates from local history.</p>

              {data.recentSnapshots.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {data.recentSnapshots.map((snapshot) => (
                    <SnapshotRow
                      key={`${snapshot.timestamp}-${snapshot.fiveHourUsagePercent}-${snapshot.weeklyUsagePercent}`}
                      snapshot={snapshot}
                      timezone={data.settings.timezone}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
                  No snapshots yet. Save your first one from the quick update panel.
                </p>
              )}
            </article>
          </section>
        </>
      ) : null}
    </main>
  );
}
