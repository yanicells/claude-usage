"use client";

import { DateTime } from "luxon";
import { useEffect, useState } from "react";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { FeedbackCard } from "@/components/dashboard/feedback-card";
import { ModePanel } from "@/components/dashboard/mode-panel";
import { PacingChart } from "@/components/dashboard/pacing-chart";
import { SessionCard } from "@/components/dashboard/session-card";
import { WeeklyCard } from "@/components/dashboard/weekly-card";
import {
  LOCAL_STORAGE_KEY,
  PH_TIMEZONE,
  buildWeeklyProjection,
  compareWeeklyPace,
  formatCountdown,
  getCurrentWeeklyAnchorFromResetText,
  getFasterLimitsStatusPH,
  getNextFasterLimitsSwitchPH,
  parseClaudeUsageBlock,
  parseStoredCompanionState,
  type CompanionState,
} from "@/lib/local-companion";

export function DashboardClient() {
  const [companionState, setCompanionState] = useState<CompanionState | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const parsed = parseStoredCompanionState(
      window.localStorage.getItem(LOCAL_STORAGE_KEY),
    );
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
      if (!text.trim()) {
        setNotice("Clipboard is empty.");
        return;
      }
      const { parsed, status } = parseClaudeUsageBlock(text);
      const nowIso =
        DateTime.now().setZone(PH_TIMEZONE).toISO() ?? new Date().toISOString();
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
      setNotice(
        ok
          ? "Parsed."
          : partial
            ? "Partial parse — check block."
            : "Parse failed.",
      );
    } catch {
      setNotice("Clipboard blocked — check permissions.");
    }
  }

  function handleClear(): void {
    setCompanionState(null);
    setNotice("Cleared.");
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
  }

  const nowPh =
    nowMs !== null ? DateTime.fromMillis(nowMs).setZone(PH_TIMEZONE) : null;

  const fasterStatus = nowPh
    ? getFasterLimitsStatusPH(nowPh)
    : {
        mode: "normal" as const,
        isActive: false,
        windowStartIso: null,
        windowEndIso: null,
      };

  const nextSwitch = nowPh ? getNextFasterLimitsSwitchPH(nowPh) : null;

  const remainingMs =
    nowPh && nextSwitch ? nextSwitch.toMillis() - nowPh.toMillis() : null;

  const countdown =
    nowPh && nextSwitch
      ? formatCountdown(nextSwitch.toMillis() - nowPh.toMillis())
      : "--h --m --s";

  const weeklyUsed = companionState?.weeklyUsedPercent ?? null;

  const weeklyAnchor = companionState?.weeklyResetText
    ? getCurrentWeeklyAnchorFromResetText(
        companionState.weeklyResetText,
        nowPh ?? undefined,
      )
    : null;

  const projection = weeklyAnchor ? buildWeeklyProjection(weeklyAnchor) : [];

  const todayIndex =
    weeklyAnchor && nowPh
      ? Math.max(
          0,
          Math.min(
            6,
            Math.floor(
              nowPh.startOf("day").diff(weeklyAnchor.startOf("day"), "days")
                .days,
            ),
          ),
        )
      : null;

  const dayCheckpoint =
    todayIndex !== null && todayIndex >= 0 && todayIndex < projection.length
      ? projection[todayIndex]
      : null;

  const comparison =
    weeklyUsed !== null && dayCheckpoint
      ? compareWeeklyPace(weeklyUsed, dayCheckpoint.expectedCumulativePercent)
      : null;

  return (
    <div className="min-h-screen bg-ctp-base px-4 py-10 text-ctp-text sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <DashboardHeader
          notice={notice}
          onPaste={() => void handlePaste()}
          onClear={handleClear}
          lastPastedTime={companionState?.parsedAt ?? null}
        />

        <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
          <div className="grid w-full shrink-0 grid-cols-2 gap-4 xl:flex xl:w-104 xl:flex-col">
            <SessionCard
              used={companionState?.sessionUsedPercent ?? null}
              resetText={companionState?.sessionResetText ?? null}
            />
            <WeeklyCard
              used={weeklyUsed}
              resetText={companionState?.weeklyResetText ?? null}
              status={comparison?.status ?? null}
            />
            <div className="col-span-2">
              <ModePanel
                mode={fasterStatus.mode}
                countdown={countdown}
                nextSwitch={nextSwitch}
                remainingMs={remainingMs}
              />
            </div>
          </div>

          <div className="min-w-0 flex-1 flex flex-col gap-4 xl:min-h-0">
            <FeedbackCard
              delta={comparison?.delta ?? null}
              actual={comparison?.actual ?? null}
              expected={comparison?.expected ?? null}
            />
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
