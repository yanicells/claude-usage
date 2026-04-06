import "server-only";

import { DateTime } from "luxon";

import type {
  CompanionComputed,
  CompanionSettings,
  PaceStatus,
  UsageState,
  WeekDay,
  WeeklyProgressPoint,
} from "@/lib/companion-types";

const SHORT_LABELS: Record<WeekDay, string> = {
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function dayIndex(day: WeekDay): number {
  return [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ].indexOf(day);
}

function dayFromIndex(index: number): WeekDay {
  const ordered: WeekDay[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return ordered[(index + 7) % 7];
}

function parseInZone(isoValue: string, timezone: string): DateTime {
  const parsed = DateTime.fromISO(isoValue, { setZone: true });
  if (parsed.isValid) {
    return parsed.setZone(timezone);
  }

  return DateTime.now().setZone(timezone);
}

export function getMostRecentWeeklyReset(
  settings: CompanionSettings,
  nowInput?: DateTime,
): DateTime {
  const now = (nowInput ?? DateTime.now()).setZone(settings.timezone);
  const currentIndex = dayIndex(dayFromIndex(now.weekday % 7));
  const targetIndex = dayIndex(settings.weeklyResetDay);
  const daysBack = (currentIndex - targetIndex + 7) % 7;

  let candidate = now
    .minus({ days: daysBack })
    .set({
      hour: settings.weeklyResetHour,
      minute: 0,
      second: 0,
      millisecond: 0,
    });

  if (candidate > now) {
    candidate = candidate.minus({ days: 7 });
  }

  return candidate;
}

export function getCurrentWeeklySlot(
  settings: CompanionSettings,
  nowInput?: DateTime,
): number {
  const now = (nowInput ?? DateTime.now()).setZone(settings.timezone);
  const cycleStart = getMostRecentWeeklyReset(settings, now);
  const elapsedHours = Math.max(0, now.diff(cycleStart, "hours").hours);
  return Math.min(6, Math.floor(elapsedHours / 24));
}

export function buildWeeklyProgression(
  settings: CompanionSettings,
  currentSlot: number,
): WeeklyProgressPoint[] {
  const baseDayIndex = dayIndex(settings.weeklyResetDay);

  return Array.from({ length: 7 }, (_, slot) => {
    const day = dayFromIndex(baseDayIndex + slot);
    return {
      slot,
      day,
      shortLabel: SHORT_LABELS[day],
      expectedCumulativePercent: Math.min(
        settings.weeklyTargetPercent,
        Math.round((slot + 1) * settings.simpleDailyIncrement),
      ),
      isToday: slot === currentSlot,
    };
  });
}

function buildGuidance(
  settings: CompanionSettings,
  state: UsageState,
  paceStatus: PaceStatus,
  expectedWeeklyPercentNow: number,
  deltaWeeklyPercent: number,
  currentSlot: number,
): string[] {
  const guidance: string[] = [];
  const fiveUsage = clamp(
    Math.round(state.currentFiveHourUsagePercent),
    0,
    100,
  );
  const weeklyUsage = clamp(
    Math.round(state.currentWeeklyUsagePercent),
    0,
    100,
  );
  const weeklyRemaining = Math.max(
    0,
    settings.weeklyTargetPercent - weeklyUsage,
  );

  if (paceStatus === "ahead") {
    guidance.push(
      "You are ahead of your weekly pace, so use Claude more lightly until tomorrow.",
    );
  } else if (paceStatus === "behind") {
    guidance.push(
      "You are behind your weekly pace, so you still have room today.",
    );
  } else {
    guidance.push("You are on track for this week. Keep a steady pace today.");
  }

  if (fiveUsage >= 90) {
    guidance.push(
      "Your 5-hour window is almost full, so slow down until the next reset.",
    );
  } else if (fiveUsage >= 75) {
    guidance.push(
      "Your current 5-hour window is getting high. Use Claude a bit more selectively right now.",
    );
  } else if (fiveUsage <= 45) {
    guidance.push("Your current 5-hour window still has comfortable room.");
  }

  if (weeklyRemaining <= 15) {
    guidance.push(
      "Your weekly usage is getting tight. Save a chunk for tomorrow and the next days.",
    );
  } else if (weeklyRemaining >= 35 && fiveUsage >= 70) {
    guidance.push(
      "Your weekly usage is still comfortable even if your current 5-hour window is relatively high.",
    );
  }

  const remainingSlots = Math.max(1, 7 - (currentSlot + 1));
  const idealRemaining = Math.max(
    0,
    settings.weeklyTargetPercent - expectedWeeklyPercentNow,
  );
  const suggestedPerDay = Math.max(
    0,
    Math.ceil(idealRemaining / remainingSlots),
  );

  if (paceStatus === "ahead" && suggestedPerDay > 0) {
    guidance.push(
      `To settle back to pace, aim to average around ${suggestedPerDay}% per remaining day.`,
    );
  }

  if (paceStatus === "behind") {
    const catchUp = Math.abs(deltaWeeklyPercent);
    guidance.push(
      `You are ${catchUp}% behind your checkpoint. You can use more today if needed.`,
    );
  }

  return guidance;
}

export function calculateCompanionDashboard(
  settings: CompanionSettings,
  state: UsageState,
): CompanionComputed {
  const now = DateTime.now().setZone(settings.timezone);

  const currentSlot = getCurrentWeeklySlot(settings, now);
  const progression = buildWeeklyProgression(settings, currentSlot);
  const expectedWeeklyPercentNow =
    progression[currentSlot]?.expectedCumulativePercent ?? 0;

  const actualWeekly = clamp(
    Math.round(state.currentWeeklyUsagePercent),
    0,
    100,
  );
  const deltaWeeklyPercent = actualWeekly - expectedWeeklyPercentNow;

  let paceStatus: PaceStatus = "on-track";
  if (deltaWeeklyPercent > 0) {
    paceStatus = "ahead";
  } else if (deltaWeeklyPercent < 0) {
    paceStatus = "behind";
  }

  const fiveHourUsage = clamp(
    Math.round(state.currentFiveHourUsagePercent),
    0,
    100,
  );
  const fiveHourRemainingPercent = Math.max(0, 100 - fiveHourUsage);
  const weeklyRemainingPercent = Math.max(
    0,
    settings.weeklyTargetPercent - actualWeekly,
  );

  const currentWindowStart = parseInZone(
    state.currentFiveHourWindowStartedAt,
    settings.timezone,
  );
  const nextFiveHourResetAt = currentWindowStart
    .plus({ hours: settings.fiveHourWindowHours })
    .toISO();

  const nextWeeklyResetAt = getMostRecentWeeklyReset(settings, now)
    .plus({ days: 7 })
    .toISO();

  const guidance = buildGuidance(
    settings,
    state,
    paceStatus,
    expectedWeeklyPercentNow,
    deltaWeeklyPercent,
    currentSlot,
  );

  return {
    paceStatus,
    expectedWeeklyPercentNow,
    deltaWeeklyPercent,
    fiveHourRemainingPercent,
    weeklyRemainingPercent,
    nextFiveHourResetAt: nextFiveHourResetAt ?? new Date().toISOString(),
    nextWeeklyResetAt: nextWeeklyResetAt ?? new Date().toISOString(),
    currentWeeklySlot: currentSlot,
    progression,
    guidance,
  };
}

export function getCycleStartIsoForTimestamp(
  settings: CompanionSettings,
  timestamp: string,
): string {
  const moment = parseInZone(timestamp, settings.timezone);
  return (
    getMostRecentWeeklyReset(settings, moment).toISO() ??
    moment.toISO() ??
    new Date().toISOString()
  );
}
