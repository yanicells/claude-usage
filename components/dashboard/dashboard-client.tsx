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

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full bg-ctp-surface1 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${clamp(pct)}%` }}
      />
    </div>
  );
}

function SessionCard({ used, resetText }: { used: number | null; resetText: string | null }) {
  const pct = used ?? 0;
  const barColor = pct >= 80 ? "bg-ctp-red" : pct >= 60 ? "bg-ctp-yellow" : "bg-ctp-blue";
  return (
    <div className="rounded-2xl border border-ctp-surface1 bg-ctp-surface0 p-7 flex flex-col gap-3">
      <p className="text-6xl font-bold text-ctp-text tabular-nums leading-none">
        {used !== null ? `${used}%` : "—"}
      </p>
      <ProgressBar pct={pct} color={barColor} />
      <p className="text-base text-ctp-subtext0 leading-none truncate">{resetText ?? "no data"}</p>
    </div>
  );
}

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
    status === "ahead" ? "bg-ctp-red" : status === "behind" ? "bg-ctp-green" : "bg-ctp-blue";
  return (
    <div className="rounded-2xl border border-ctp-surface1 bg-ctp-surface0 p-7 flex flex-col gap-3">
      <p className="text-6xl font-bold text-ctp-text tabular-nums leading-none">
        {used !== null ? `${used}%` : "—"}
      </p>
      <ProgressBar pct={pct} color={barColor} />
      <p className="text-base text-ctp-subtext0 leading-none">
        {resetText ?? "no data"}
      </p>
    </div>
  );
}

function ModePanel({
  mode,
  countdown,
  nextSwitch,
  remainingMs,
}: {
  mode: "faster" | "normal";
  countdown: string;
  nextSwitch: DateTime | null;
  remainingMs: number | null;
}) {
  const isFaster = mode === "faster";
  // Faster window = 6h, Normal window estimated at 18h
  const FASTER_TOTAL = 6 * 3600 * 1000;
  const NORMAL_TOTAL = 18 * 3600 * 1000;
  const totalDuration = isFaster ? FASTER_TOTAL : NORMAL_TOTAL;
  const elapsed = remainingMs !== null
    ? Math.max(0, totalDuration - Math.min(remainingMs, totalDuration))
    : 0;
  const progressPct = clamp((elapsed / totalDuration) * 100);
  const barColor = isFaster ? "bg-ctp-yellow" : "bg-ctp-green";
  const modeColor = isFaster ? "text-ctp-yellow" : "text-ctp-green";

  return (
    <div className="rounded-2xl border border-ctp-surface1 bg-ctp-surface0 p-7 flex flex-col gap-3">
      <p className={`text-5xl font-bold leading-none ${modeColor}`}>
        {isFaster ? "Faster" : "Normal"}
      </p>
      <ProgressBar pct={progressPct} color={barColor} />
      <p className="text-base text-ctp-subtext0 leading-none tabular-nums">{countdown}</p>
      {nextSwitch ? (
        <p className="text-sm text-ctp-overlay0 leading-none">
          → {nextSwitch.toFormat("ccc h:mm a")} PH
        </p>
      ) : null}
    </div>
  );
}

function FeedbackCard({
  delta,
}: {
  delta: number | null;
}) {
  let paceLabel = "—";
  let paceDetail = "Paste your usage block to begin.";
  let paceColor = "text-ctp-overlay0";

  if (delta !== null) {
    const abs = Math.abs(delta);
    const sessions = Math.round((abs / 14) * 2) / 2;
    const label = sessions === 1 ? "session" : "sessions";
    if (delta < 0) {
      paceLabel = "Under pace";
      paceDetail = `by ${abs}% — ~${sessions} ${label} of room left`;
      paceColor = "text-ctp-green";
    } else if (delta > 0) {
      paceLabel = "Over pace";
      paceDetail = `by ${delta}% — ~${sessions} ${label} over`;
      paceColor = "text-ctp-red";
    } else {
      paceLabel = "On pace";
      paceDetail = "Keep it steady.";
      paceColor = "text-ctp-blue";
    }
  }

  return (
    <div className="rounded-2xl border border-ctp-surface1 bg-ctp-surface0 px-7 py-5 flex items-center gap-8 shrink-0">
      <div className="shrink-0">
        <p className={`text-3xl font-bold leading-tight ${paceColor}`}>{paceLabel}</p>
      </div>
      <p className="text-lg text-ctp-subtext0">{paceDetail}</p>
    </div>
  );
}

function PacingChart({
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
      <div className="flex-1 flex items-center justify-center rounded-2xl border border-dashed border-ctp-surface1">
        <p className="text-base text-ctp-overlay0">paste usage to generate chart</p>
      </div>
    );
  }

  const normalizedActual = actual !== null ? clamp(actual) : null;

  return (
    <div className="flex-1 grid grid-cols-7 gap-3 min-h-0">
      {points.map((point) => {
        const isCurrent = point.index === currentIndex;
        const exp = point.expectedCumulativePercent;

        let greenHeight = 0;
        let accentHeight = 0;
        let accentBottom = 0;
        let accentColor = "";

        if (isCurrent && normalizedActual !== null) {
          if (normalizedActual <= exp) {
            greenHeight = normalizedActual;
            accentHeight = exp - normalizedActual;
            accentBottom = normalizedActual;
            accentColor = "bg-ctp-blue/40";
          } else {
            greenHeight = exp;
            accentHeight = normalizedActual - exp;
            accentBottom = exp;
            accentColor = "bg-ctp-red/60";
          }
        }

        return (
          <div key={point.checkpointIso} className="flex flex-col gap-3">
            <div
              className={`flex-1 relative rounded-xl overflow-hidden border border-ctp-surface1 ${
                isCurrent ? "bg-ctp-surface1" : "bg-ctp-surface0"
              }`}
            >
              {isCurrent && normalizedActual !== null ? (
                <div
                  className="absolute inset-x-0 bottom-0 bg-ctp-green/60 transition-all duration-700"
                  style={{ height: `${greenHeight}%` }}
                />
              ) : null}
              {isCurrent && accentHeight > 0 ? (
                <div
                  className={`absolute inset-x-0 transition-all duration-700 ${accentColor}`}
                  style={{ bottom: `${accentBottom}%`, height: `${accentHeight}%` }}
                />
              ) : null}
              <div
                className="absolute inset-x-0 border-t-2 border-ctp-lavender/50"
                style={{ bottom: `${exp}%` }}
              />
            </div>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <span
                className={`text-lg font-bold ${
                  isCurrent ? "text-ctp-blue" : "text-ctp-subtext0"
                }`}
              >
                {point.dayLabel}
              </span>
              <span className="text-base text-ctp-overlay0 tabular-nums">{exp}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ClipboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z" />
      <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5H3.5a1 1 0 0 0-1 1V3h9V2.5a1 1 0 0 0-1-1H9A1.5 1.5 0 0 0 7.5 0h-1z" />
    </svg>
  );
}

export function DashboardClient() {
  const [companionState, setCompanionState] = useState<CompanionState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const parsed = parseStoredCompanionState(window.localStorage.getItem(LOCAL_STORAGE_KEY));
    if (!parsed) return;
    const id = window.setTimeout(() => setCompanionState(parsed), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setNowMs(Date.now()), 0);
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

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
      if (!text.trim()) { setNotice("Clipboard is empty."); return; }
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
      setNotice(ok ? "Parsed." : partial ? "Partial parse — check block." : "Parse failed.");
    } catch {
      setNotice("Clipboard blocked — check permissions.");
    }
  }

  function handleClear(): void {
    setCompanionState(null);
    setNotice("Cleared.");
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
  }

  const nowPh = nowMs !== null ? DateTime.fromMillis(nowMs).setZone(PH_TIMEZONE) : null;

  const fasterStatus = nowPh
    ? getFasterLimitsStatusPH(nowPh)
    : { mode: "normal" as const, isActive: false, windowStartIso: null, windowEndIso: null };

  const nextSwitch = nowPh ? getNextFasterLimitsSwitchPH(nowPh) : null;

  const remainingMs =
    nowPh && nextSwitch ? nextSwitch.toMillis() - nowPh.toMillis() : null;

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

  const todayIndex =
    weeklyAnchor && nowPh
      ? Math.max(
          0,
          Math.min(
            6,
            Math.round(nowPh.startOf("day").diff(weeklyAnchor.startOf("day"), "days").days),
          ),
        )
      : null;

  const comparison =
    weeklyUsed !== null && currentCheckpoint
      ? compareWeeklyPace(weeklyUsed, currentCheckpoint.expectedCumulativePercent)
      : null;

  return (
    <div className="min-h-screen bg-ctp-base text-ctp-text py-10 px-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">

        {/* top bar */}
        <div className="flex items-center pb-5 border-b border-ctp-surface1">
          <span className="text-3xl font-bold text-ctp-text select-none tracking-tight">
            Claudium
          </span>

          {notice ? (
            <span className="ml-5 text-sm text-ctp-subtext0 truncate max-w-xs">{notice}</span>
          ) : null}

          <div className="flex-1" />

          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => void handlePaste()}
              className="flex items-center gap-2 text-2xl font-bold text-ctp-subtext0 hover:text-ctp-text transition-colors cursor-pointer"
            >
              <ClipboardIcon />
              paste
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="text-2xl font-bold text-ctp-overlay0 hover:text-ctp-red transition-colors cursor-pointer"
            >
              clear
            </button>
          </div>
        </div>

        {/* main content */}
        <div className="flex gap-6 items-stretch">

          {/* left column */}
          <div className="w-80 shrink-0 flex flex-col gap-4">
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
              remainingMs={remainingMs}
            />
          </div>

          {/* right column */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <FeedbackCard delta={comparison?.delta ?? null} />
            <PacingChart
              points={projection}
              currentIndex={todayIndex}
              actual={weeklyUsed}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
