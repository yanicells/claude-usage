"use client";

import { DateTime } from "luxon";
import { useEffect, useState } from "react";

import {
  LOCAL_STORAGE_KEY,
  PH_TIMEZONE,
  buildWeeklyProjection,
  compareWeeklyPace,
  createEmptyCompanionState,
  formatCountdown,
  getCurrentExpectedCheckpoint,
  getCurrentWeeklyAnchorFromResetText,
  getFasterLimitsStatusPH,
  getNextFasterLimitsSwitchPH,
  parseClaudeUsageBlock,
  parseStoredCompanionState,
  type CompanionState,
  type ParsedStatus,
  type WeeklyProjectionPoint,
} from "@/lib/local-companion";

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatIsoInPh(iso: string): string {
  const date = DateTime.fromISO(iso).setZone(PH_TIMEZONE);
  if (!date.isValid) {
    return "-";
  }

  return date.toFormat("ccc, LLL d, h:mm a");
}

function statusTone(status: "ahead" | "on-track" | "behind"): string {
  if (status === "ahead") {
    return "border-amber-300 bg-amber-50 text-amber-900";
  }

  if (status === "behind") {
    return "border-emerald-300 bg-emerald-50 text-emerald-900";
  }

  return "border-cyan-300 bg-cyan-50 text-cyan-900";
}

function buildGuidance(params: {
  hasWeeklyData: boolean;
  weeklyComparisonStatus: "ahead" | "on-track" | "behind" | null;
  sessionUsedPercent: number | null;
  sessionUnavailable: boolean;
  fasterMode: "faster" | "normal";
}): string {
  const notes: string[] = [];

  if (!params.hasWeeklyData || !params.weeklyComparisonStatus) {
    notes.push("Paste your latest Plan usage limits block so pace guidance can start.");
  } else if (params.weeklyComparisonStatus === "ahead") {
    notes.push("You're ahead of weekly pace. Use Claude more lightly until the next checkpoint.");
  } else if (params.weeklyComparisonStatus === "behind") {
    notes.push("You're behind weekly pace, so you still have room today.");
  } else {
    notes.push("You're on track with weekly pace. Keep usage steady.");
  }

  if (params.sessionUnavailable) {
    notes.push("Manual weekly override is active, so current session values are hidden.");
  } else if (params.sessionUsedPercent !== null && params.sessionUsedPercent >= 75) {
    notes.push("Your weekly usage is okay, but your current 5-hour session is getting high.");
  }

  if (params.fasterMode === "faster") {
    notes.push("Faster limits are active right now, so your 5-hour session may drain more quickly.");
  } else {
    notes.push("Normal limits are active right now.");
  }

  return notes.join(" ");
}

interface BootstrapState {
  companionState: CompanionState | null;
  inputText: string;
  manualWeeklyInput: string;
  statusNotice: string;
}

function loadBootstrapState(): BootstrapState {
  const fallback: BootstrapState = {
    companionState: null,
    inputText: "",
    manualWeeklyInput: "",
    statusNotice: "Paste your Plan usage limits block to start parsing.",
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  const parsed = parseStoredCompanionState(window.localStorage.getItem(LOCAL_STORAGE_KEY));
  if (!parsed) {
    return fallback;
  }

  return {
    companionState: parsed,
    inputText: parsed.rawText,
    manualWeeklyInput:
      parsed.weeklyManuallyEdited && parsed.manualWeeklyUsedPercent !== null
        ? String(parsed.manualWeeklyUsedPercent)
        : "",
    statusNotice: "Restored latest parsed state from localStorage.",
  };
}

function Card({
  label,
  value,
  hint,
  toneClassName,
}: {
  label: string;
  value: string;
  hint: string;
  toneClassName?: string;
}) {
  return (
    <article
      className={`rounded-2xl border bg-white/95 p-4 shadow-sm ${toneClassName ?? "border-slate-200"}`}
    >
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-2 text-xs text-slate-600">{hint}</p>
    </article>
  );
}

function PacingMiniChart({
  points,
  currentIndex,
  actual,
}: {
  points: WeeklyProjectionPoint[];
  currentIndex: number | null;
  actual: number | null;
}) {
  if (points.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
        Weekly projection needs a valid parsed weekly reset (example: &quot;Resets Thu 2:00 PM&quot;).
      </div>
    );
  }

  const normalizedActual = actual === null ? null : clampPercent(actual);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
          Expected checkpoint
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3 bg-rose-500" />
          Actual now marker
        </span>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {points.map((point) => {
          const expectedHeight = Math.max(6, point.expectedCumulativePercent);
          const actualHeight = normalizedActual === null ? null : Math.max(2, normalizedActual);
          const isCurrent = point.index === currentIndex;

          return (
            <div key={point.checkpointIso} className="flex flex-col items-center gap-2">
              <div
                className={`relative h-28 w-full max-w-11 rounded-xl border bg-slate-50 ${
                  isCurrent ? "border-cyan-300" : "border-slate-200"
                }`}
              >
                <div
                  className="absolute inset-x-1 bottom-1 rounded-md bg-cyan-500/85"
                  style={{ height: `${expectedHeight}%` }}
                />
                {isCurrent && actualHeight !== null ? (
                  <div
                    className="absolute inset-x-0 border-t-2 border-rose-500"
                    style={{ bottom: `${actualHeight}%` }}
                  />
                ) : null}
              </div>
              <span className="text-[11px] font-medium text-slate-600">{point.dayLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DashboardClient() {
  const [bootstrapState] = useState<BootstrapState>(() => loadBootstrapState());
  const [inputText, setInputText] = useState(bootstrapState.inputText);
  const [companionState, setCompanionState] = useState<CompanionState | null>(
    bootstrapState.companionState,
  );
  const [parseStatus, setParseStatus] = useState<ParsedStatus | null>(null);
  const [statusNotice, setStatusNotice] = useState<string>(bootstrapState.statusNotice);
  const [manualEditorOpen, setManualEditorOpen] = useState(false);
  const [manualWeeklyInput, setManualWeeklyInput] = useState(bootstrapState.manualWeeklyInput);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  function persistState(next: CompanionState): void {
    setCompanionState(next);
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
  }

  function parseAndSave(rawText: string): void {
    const { parsed, status } = parseClaudeUsageBlock(rawText);
    const nowIso = DateTime.now().setZone(PH_TIMEZONE).toISO() ?? new Date().toISOString();

    const nextState: CompanionState = {
      rawText,
      plan: parsed.plan,
      sessionUsedPercent: parsed.sessionUsedPercent,
      sessionResetText: parsed.sessionResetText,
      weeklyUsedPercent: parsed.weeklyUsedPercent,
      weeklyResetText: parsed.weeklyResetText,
      parsedAt: nowIso,
      weeklyManuallyEdited: false,
      manualWeeklyUsedPercent: null,
    };

    persistState(nextState);
    setManualWeeklyInput("");
    setParseStatus(status);
    setStatusNotice(status.message);
  }

  async function handlePasteFromClipboard(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setStatusNotice("Clipboard is empty. Paste the usage block into the textarea instead.");
        return;
      }

      setInputText(text);
      parseAndSave(text);
    } catch {
      setStatusNotice("Clipboard access was blocked. Paste text manually in the textarea.");
    }
  }

  function handleParseButton(): void {
    if (!inputText.trim()) {
      setStatusNotice("Paste your Plan usage limits block before parsing.");
      return;
    }

    parseAndSave(inputText);
  }

  function handleClearAll(): void {
    setInputText("");
    setCompanionState(null);
    setParseStatus(null);
    setManualEditorOpen(false);
    setManualWeeklyInput("");
    setStatusNotice("All local data cleared.");
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
  }

  function handleManualWeeklySave(): void {
    const parsedValue = Number.parseInt(manualWeeklyInput, 10);
    if (!Number.isFinite(parsedValue)) {
      setStatusNotice("Enter a valid weekly percent (0 to 100).");
      return;
    }

    const base = companionState ?? createEmptyCompanionState();
    const nowIso = DateTime.now().setZone(PH_TIMEZONE).toISO() ?? new Date().toISOString();

    const nextState: CompanionState = {
      ...base,
      rawText: inputText,
      parsedAt: nowIso,
      weeklyManuallyEdited: true,
      manualWeeklyUsedPercent: clampPercent(parsedValue),
    };

    persistState(nextState);
    setStatusNotice("Weekly usage manually overridden. Session values are now hidden.");
  }

  function clearManualOverride(): void {
    if (!companionState) {
      return;
    }

    const nowIso = DateTime.now().setZone(PH_TIMEZONE).toISO() ?? new Date().toISOString();
    const nextState: CompanionState = {
      ...companionState,
      parsedAt: nowIso,
      weeklyManuallyEdited: false,
      manualWeeklyUsedPercent: null,
    };

    persistState(nextState);
    setStatusNotice("Manual weekly override removed. Parsed values are active again.");
  }

  const nowPh = DateTime.fromMillis(nowMs).setZone(PH_TIMEZONE);
  const fasterStatus = getFasterLimitsStatusPH(nowPh);
  const nextSwitch = getNextFasterLimitsSwitchPH(nowPh);
  const countdown = formatCountdown(nextSwitch.toMillis() - nowPh.toMillis());

  const manualOverrideActive = Boolean(companionState?.weeklyManuallyEdited);
  const sessionUnavailable = manualOverrideActive;
  const sessionUsedDisplay = sessionUnavailable
    ? "—"
    : companionState?.sessionUsedPercent !== null && companionState?.sessionUsedPercent !== undefined
      ? `${companionState.sessionUsedPercent}%`
      : "—";
  const sessionResetDisplay = sessionUnavailable
    ? "—"
    : companionState?.sessionResetText ?? "—";

  const activeWeeklyValue = manualOverrideActive
    ? companionState?.manualWeeklyUsedPercent ?? null
    : companionState?.weeklyUsedPercent ?? null;

  const weeklyAnchor = companionState?.weeklyResetText
    ? getCurrentWeeklyAnchorFromResetText(companionState.weeklyResetText, nowPh)
    : null;

  const weeklyProjection = weeklyAnchor ? buildWeeklyProjection(weeklyAnchor) : [];
  const currentCheckpoint = getCurrentExpectedCheckpoint(weeklyProjection, nowPh);
  const weeklyComparison =
    activeWeeklyValue !== null && currentCheckpoint
      ? compareWeeklyPace(activeWeeklyValue, currentCheckpoint.expectedCumulativePercent)
      : null;

  const guidanceText = buildGuidance({
    hasWeeklyData: activeWeeklyValue !== null && currentCheckpoint !== null,
    weeklyComparisonStatus: weeklyComparison?.status ?? null,
    sessionUsedPercent: companionState?.sessionUsedPercent ?? null,
    sessionUnavailable,
    fasterMode: fasterStatus.mode,
  });

  const parsedSessionSummary =
    companionState?.sessionUsedPercent === null || companionState?.sessionUsedPercent === undefined
      ? "—"
      : `${companionState.sessionUsedPercent}%`;
  const parsedWeeklySummary =
    companionState?.weeklyUsedPercent === null || companionState?.weeklyUsedPercent === undefined
      ? "—"
      : `${companionState.weeklyUsedPercent}%`;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-7 sm:px-6">
      <section className="rounded-3xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-teal-50 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.16em] text-cyan-700">Personal local companion</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Claude Usage Companion</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-700">
          Paste your Claude &quot;Plan usage limits&quot; block and get immediate weekly pace guidance without mental math.
        </p>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Paste and parse</h2>
        <p className="mt-1 text-sm text-slate-600">
          Main source of truth is the latest parsed block. Weekly can be manually overridden when needed.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handlePasteFromClipboard()}
            className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
          >
            Paste from clipboard
          </button>
          <button
            type="button"
            onClick={handleParseButton}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            Parse
          </button>
          <button
            type="button"
            onClick={() => setManualEditorOpen((value) => !value)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            Edit weekly manually
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
          >
            Clear all
          </button>
        </div>

        <textarea
          className="mt-4 min-h-40 w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-3 font-mono text-sm text-slate-900 outline-none ring-cyan-300 transition focus:ring"
          placeholder="Paste Plan usage limits text here..."
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
        />

        {manualEditorOpen ? (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Manual weekly override</p>
            <p className="mt-1 text-xs text-amber-800">
              Weekly pace will use this value. Session cards will show &quot;—&quot; until you parse again or clear override.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                value={manualWeeklyInput}
                onChange={(event) => setManualWeeklyInput(event.target.value)}
                className="w-28 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-amber-300 focus:ring"
                placeholder="0-100"
              />
              <button
                type="button"
                onClick={handleManualWeeklySave}
                className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
              >
                Save manual weekly
              </button>
              <button
                type="button"
                onClick={clearManualOverride}
                disabled={!manualOverrideActive}
                className="rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Use parsed weekly again
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Parsed summary preview</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <p>Plan: {companionState?.plan ?? "—"}</p>
            <p>Session used: {parsedSessionSummary}</p>
            <p>Session reset: {companionState?.sessionResetText ?? "—"}</p>
            <p>Weekly used (parsed): {parsedWeeklySummary}</p>
            <p>Weekly reset: {companionState?.weeklyResetText ?? "—"}</p>
            <p>Parsed at: {companionState?.parsedAt ? formatIsoInPh(companionState.parsedAt) : "—"}</p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          label="Current session used"
          value={sessionUsedDisplay}
          hint={sessionUnavailable ? "Unavailable during manual weekly override." : "Parsed from current session block."}
        />
        <Card
          label="Current session resets in"
          value={sessionResetDisplay}
          hint={sessionUnavailable ? "Unavailable during manual weekly override." : "Shown exactly as parsed."}
        />
        <Card
          label="Weekly used"
          value={activeWeeklyValue !== null ? `${activeWeeklyValue}%` : "—"}
          hint={manualOverrideActive ? "Manual override active." : "Parsed from weekly section."}
          toneClassName={manualOverrideActive ? "border-amber-300 bg-amber-50" : undefined}
        />
        <Card
          label="Weekly reset"
          value={companionState?.weeklyResetText ?? "—"}
          hint="Anchor for 7-step weekly checkpoints."
        />
        <Card
          label="Weekly pace status"
          value={weeklyComparison ? weeklyComparison.status.replace("-", " ") : "—"}
          hint={
            weeklyComparison
              ? `Expected now ${weeklyComparison.expected}%, actual ${weeklyComparison.actual}%, delta ${weeklyComparison.delta > 0 ? "+" : ""}${weeklyComparison.delta}%.`
              : "Needs weekly value and valid weekly reset text."
          }
          toneClassName={weeklyComparison ? statusTone(weeklyComparison.status) : undefined}
        />
        <Card
          label="Faster limits status"
          value={fasterStatus.mode}
          hint="Hardcoded PH rule: Mon-Fri, 8:00 PM to 2:00 AM."
          toneClassName={
            fasterStatus.mode === "faster"
              ? "border-rose-300 bg-rose-50"
              : "border-slate-200"
          }
        />
        <Card
          label="Countdown to mode switch"
          value={countdown}
          hint={`Next switch: ${nextSwitch.toFormat("ccc, LLL d, h:mm a")} PH`}
        />
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Weekly pacing</h2>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
            Simple pacing estimate (14, 28, 42, 56, 70, 84, 98)
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
          {weeklyProjection.map((point) => {
            const active = currentCheckpoint?.index === point.index;

            return (
              <article
                key={point.checkpointIso}
                className={`rounded-2xl border px-3 py-3 text-sm ${
                  active
                    ? "border-cyan-300 bg-cyan-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <p className="font-semibold text-slate-900">{point.dayLabel}</p>
                <p className="mt-1 text-xs text-slate-600">{point.dateLabel}</p>
                <p className="text-xs text-slate-600">{point.timeLabel}</p>
                <p className="mt-2 text-sm font-medium text-slate-800">{point.expectedCumulativePercent}% expected</p>
              </article>
            );
          })}
        </div>

        <div className="mt-5">
          <PacingMiniChart
            points={weeklyProjection}
            currentIndex={currentCheckpoint?.index ?? null}
            actual={activeWeeklyValue}
          />
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p>Expected now: {weeklyComparison ? `${weeklyComparison.expected}%` : "—"}</p>
          <p>Actual now: {activeWeeklyValue !== null ? `${activeWeeklyValue}%` : "—"}</p>
          <p>
            Delta: {weeklyComparison ? `${weeklyComparison.delta > 0 ? "+" : ""}${weeklyComparison.delta}%` : "—"}
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Guidance</h2>
        <p className="mt-2 text-sm text-slate-700">{guidanceText}</p>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Parse status</h2>
        <p className="mt-2 text-sm text-slate-700">{statusNotice}</p>

        {parseStatus ? (
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <p>
              Session parse: {parseStatus.sessionParsed ? "success" : parseStatus.sessionPartial ? "partial" : "missing"}
            </p>
            <p>
              Weekly parse: {parseStatus.weeklyParsed ? "success" : parseStatus.weeklyPartial ? "partial" : "missing"}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No parse attempt yet in this session.</p>
        )}

        {manualOverrideActive ? (
          <span className="mt-4 inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
            Weekly manual override active
          </span>
        ) : null}
      </section>
    </main>
  );
}
