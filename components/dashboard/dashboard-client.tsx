"use client";

import { DateTime } from "luxon";
import { useEffect, useState } from "react";

import {
  LOCAL_STORAGE_KEY,
  PH_TIMEZONE,
  buildWeeklyProjection,
  compareWeeklyPace,
  formatCountdown,
  getCurrentExpectedCheckpoint,
  getCurrentWeeklyAnchorFromResetText,
  getFasterLimitsStatusPH,
  getNextFasterLimitsSwitchPH,
  parseClaudeUsageBlock,
  parseStoredCompanionState,
  type CompanionState,
  type WeeklyProjectionPoint,
} from "@/lib/local-companion";

// ─── helpers ────────────────────────────────────────────────────────────────

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function feedbackLine(delta: number | null): string {
  if (delta === null) return "Paste your usage block to begin tracking.";
  const abs = Math.abs(delta);
  const sessions = Math.round((abs / 14) * 2) / 2;
  const label = sessions === 1 ? "session" : "sessions";
  if (delta < 0) return `Under pace by ${abs}% — ~${sessions} ${label} of room left.`;
  if (delta > 0) return `Over pace by ${delta}% — ease back (~${sessions} ${label} over).`;
  return "On pace — keep it steady.";
}

// ─── progress bar ────────────────────────────────────────────────────────────

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-[3px] rounded-full bg-ctp-surface1 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${clamp(pct)}%` }}
      />
    </div>
  );
}

// ─── session card ────────────────────────────────────────────────────────────

function SessionCard({
  used,
  resetText,
}: {
  used: number | null;
  resetText: string | null;
}) {
  const pct = used ?? 0;
  const barColor =
    pct >= 80 ? "bg-ctp-red" : pct >= 60 ? "bg-ctp-yellow" : "bg-ctp-blue";

  return (
    <div className="rounded-xl border border-ctp-surface1 bg-ctp-surface0 px-4 py-3 flex flex-col gap-2">
      <p className="text-[9px] uppercase tracking-[0.18em] text-ctp-overlay0">5h session</p>
      <p className="text-[30px] font-bold text-ctp-text tabular-nums leading-none">
        {used !== null ? `${used}%` : "—"}
      </p>
      <ProgressBar pct={pct} color={barColor} />
      <p className="text-[11px] text-ctp-subtext0 leading-none truncate">
        {resetText ?? "no data"}
      </p>
    </div>
  );
}

// ─── weekly card ─────────────────────────────────────────────────────────────

function WeeklyCard({
  used,
  resetText,
  status,
}: {
  used: number | null;
  resetText: string | null;
  status: "ahead" | "on-track" | "behind" | null;
}) {
  const pct = used ?? 0;
  const barColor =
    status === "ahead"
      ? "bg-ctp-red"
      : status === "behind"
        ? "bg-ctp-green"
        : "bg-ctp-blue";

  // extract just the day from "Resets Thu 2:00 PM" → "Thu"
  const dayMatch = resetText?.match(/^resets\s+(sun|mon|tue|wed|thu|fri|sat)/i);
  const resetDay = dayMatch ? dayMatch[1] : null;

  return (
    <div className="rounded-xl border border-ctp-surface1 bg-ctp-surface0 px-4 py-3 flex flex-col gap-2">
      <p className="text-[9px] uppercase tracking-[0.18em] text-ctp-overlay0">weekly</p>
      <p className="text-[30px] font-bold text-ctp-text tabular-nums leading-none">
        {used !== null ? `${used}%` : "—"}
      </p>
      <ProgressBar pct={pct} color={barColor} />
      <p className="text-[11px] text-ctp-subtext0 leading-none">
        {resetDay ? `resets ${resetDay}` : "no data"}
      </p>
    </div>
  );
}

// ─── mode panel ──────────────────────────────────────────────────────────────

function ModePanel({
  mode,
  countdown,
  nextSwitch,
}: {
  mode: "faster" | "normal";
  countdown: string;
  nextSwitch: DateTime | null;
}) {
  const isFaster = mode === "faster";

  return (
    <div className="rounded-xl border border-ctp-surface1 bg-ctp-surface0 px-4 py-3 flex flex-col gap-2">
      <p className="text-[9px] uppercase tracking-[0.18em] text-ctp-overlay0">limits</p>
      <div className="flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${
            isFaster ? "bg-ctp-yellow animate-pulse" : "bg-ctp-overlay0"
          }`}
        />
        <span
          className={`text-[11px] uppercase tracking-wider font-semibold ${
            isFaster ? "text-ctp-yellow" : "text-ctp-overlay0"
          }`}
        >
          {mode}
        </span>
      </div>
      <p className="text-[22px] font-bold text-ctp-text tabular-nums leading-none">{countdown}</p>
      {nextSwitch ? (
        <p className="text-[10px] text-ctp-overlay0 leading-none">
          → {nextSwitch.toFormat("ccc h:mm a")} PH
        </p>
      ) : null}
    </div>
  );
}

// ─── pacing chart ─────────────────────────────────────────────────────────────

function PacingChart({
  points,
  currentIndex,
  actual,
  status,
}: {
  points: WeeklyProjectionPoint[];
  currentIndex: number | null;
  actual: number | null;
  status: "ahead" | "on-track" | "behind" | null;
}) {
  if (points.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-ctp-surface1">
        <p className="text-xs text-ctp-overlay0">weekly reset text needed to generate chart</p>
      </div>
    );
  }

  const normalizedActual = actual !== null ? clamp(actual) : null;
  const fillColor =
    status === "ahead"
      ? "bg-ctp-red/50"
      : status === "behind"
        ? "bg-ctp-green/50"
        : "bg-ctp-blue/50";

  return (
    <div className="flex-1 grid grid-cols-7 gap-2 min-h-0">
      {points.map((point) => {
        const isCurrent = point.index === currentIndex;
        const exp = point.expectedCumulativePercent;

        return (
          <div key={point.checkpointIso} className="flex flex-col gap-1.5">
            {/* bar track */}
            <div
              className={`flex-1 relative rounded-lg overflow-hidden ${
                isCurrent
                  ? "bg-ctp-surface1 ring-1 ring-ctp-blue ring-inset"
                  : "bg-ctp-surface0 border border-ctp-surface1"
              }`}
            >
              {/* actual fill — current day only */}
              {isCurrent && normalizedActual !== null ? (
                <div
                  className={`absolute inset-x-0 bottom-0 transition-all duration-700 ${fillColor}`}
                  style={{ height: `${normalizedActual}%` }}
                />
              ) : null}
              {/* expected tick */}
              <div
                className="absolute inset-x-0 border-t-2 border-ctp-lavender/40"
                style={{ bottom: `${exp}%` }}
              />
            </div>
            {/* labels below bar */}
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <span
                className={`text-xs font-semibold ${
                  isCurrent ? "text-ctp-blue" : "text-ctp-subtext0"
                }`}
              >
                {point.dayLabel}
              </span>
              <span className="text-[11px] text-ctp-overlay0 tabular-nums">{exp}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── clipboard icon ──────────────────────────────────────────────────────────

function ClipboardIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z" />
      <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5H3.5a1 1 0 0 0-1 1V3h9V2.5a1 1 0 0 0-1-1H9A1.5 1.5 0 0 0 7.5 0h-1z" />
    </svg>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export function DashboardClient() {
  const [companionState, setCompanionState] = useState<CompanionState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);

  // restore from localStorage
  useEffect(() => {
    const parsed = parseStoredCompanionState(window.localStorage.getItem(LOCAL_STORAGE_KEY));
    if (parsed) setCompanionState(parsed);
  }, []);

  // live clock
  useEffect(() => {
    const timeoutId = window.setTimeout(() => setNowMs(Date.now()), 0);
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  // auto-dismiss notice
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(id);
  }, [notice]);

  function persistState(next: CompanionState): void {
    setCompanionState(next);
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
  }

  async function handlePaste(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setNotice("clipboard is empty");
        return;
      }
      const { parsed, status } = parseClaudeUsageBlock(text);
      const nowIso = DateTime.now().setZone(PH_TIMEZONE).toISO() ?? new Date().toISOString();
      persistState({
        rawText: text,
        plan: parsed.plan,
        sessionUsedPercent: parsed.sessionUsedPercent,
        sessionResetText: parsed.sessionResetText,
        weeklyUsedPercent: parsed.weeklyUsedPercent,
        weeklyResetText: parsed.weeklyResetText,
        parsedAt: nowIso,
        weeklyManuallyEdited: false,
        manualWeeklyUsedPercent: null,
      });
      const ok = status.weeklyParsed && status.sessionParsed;
      const partial = status.weeklyPartial || status.sessionPartial;
      setNotice(ok ? "parsed" : partial ? "partial parse — check block" : "parse failed");
    } catch {
      setNotice("clipboard blocked — check permissions");
    }
  }

  function handleClear(): void {
    setCompanionState(null);
    setNotice("cleared");
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
  }

  // ─── derived state ───────────────────────────────────────────────────────

  const nowPh = nowMs !== null ? DateTime.fromMillis(nowMs).setZone(PH_TIMEZONE) : null;

  const fasterStatus = nowPh
    ? getFasterLimitsStatusPH(nowPh)
    : { mode: "normal" as const, isActive: false, windowStartIso: null, windowEndIso: null };

  const nextSwitch = nowPh ? getNextFasterLimitsSwitchPH(nowPh) : null;

  const countdown =
    nowPh && nextSwitch
      ? formatCountdown(nextSwitch.toMillis() - nowPh.toMillis())
      : "--h --m --s";

  const weeklyUsed = companionState?.weeklyUsedPercent ?? null;

  const weeklyAnchor = companionState?.weeklyResetText
    ? getCurrentWeeklyAnchorFromResetText(companionState.weeklyResetText, nowPh ?? undefined)
    : null;

  const projection = weeklyAnchor ? buildWeeklyProjection(weeklyAnchor) : [];
  const currentCheckpoint = getCurrentExpectedCheckpoint(projection, nowPh ?? undefined);

  // Calendar-day index for the highlight — independent of checkpoint time.
  // Anchors at midnight so Wed 10AM and Wed 8PM both resolve to the same day column.
  const todayIndex =
    weeklyAnchor && nowPh
      ? Math.max(
          0,
          Math.min(
            6,
            Math.round(
              nowPh.startOf("day").diff(weeklyAnchor.startOf("day"), "days").days,
            ),
          ),
        )
      : null;

  const comparison =
    weeklyUsed !== null && currentCheckpoint
      ? compareWeeklyPace(weeklyUsed, currentCheckpoint.expectedCumulativePercent)
      : null;

  // ─── render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-ctp-base text-ctp-text py-10 px-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-5">
        {/* top bar */}
        <div className="flex items-center gap-3 pb-3 border-b border-ctp-surface1">
          <span className="text-[10px] tracking-[0.22em] text-ctp-surface1 uppercase select-none font-semibold">
            claudium
          </span>

          <button
            type="button"
            onClick={() => void handlePaste()}
            className="flex items-center gap-1.5 text-[11px] text-ctp-subtext0 hover:text-ctp-text transition-colors px-2.5 py-1.5 rounded-lg hover:bg-ctp-surface0 border border-transparent hover:border-ctp-surface1 cursor-pointer"
          >
            <ClipboardIcon />
            paste
          </button>

          {notice ? (
            <span className="text-[10px] text-ctp-subtext0 truncate max-w-60">
              {notice}
            </span>
          ) : null}

          <div className="flex-1" />

          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] text-ctp-overlay0 hover:text-ctp-red transition-colors px-2 py-1 rounded cursor-pointer"
          >
            clear
          </button>
        </div>

        {/* main content — items-stretch so both cols share the same height */}
        <div className="flex gap-5 items-stretch">
          {/* left column */}
          <div className="w-50 shrink-0 flex flex-col gap-3">
            <SessionCard
              used={companionState?.sessionUsedPercent ?? null}
              resetText={companionState?.sessionResetText ?? null}
            />
            <WeeklyCard
              used={weeklyUsed}
              resetText={companionState?.weeklyResetText ?? null}
              status={comparison?.status ?? null}
            />
            <ModePanel
              mode={fasterStatus.mode}
              countdown={countdown}
              nextSwitch={nextSwitch}
            />
          </div>

          {/* right column — flex-col so chart can flex-1 to fill remaining height */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            <PacingChart
              points={projection}
              currentIndex={todayIndex}
              actual={weeklyUsed}
              status={comparison?.status ?? null}
            />
            <p className="text-sm text-ctp-subtext0 shrink-0">
              {feedbackLine(comparison?.delta ?? null)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
