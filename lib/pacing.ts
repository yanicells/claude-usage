import "server-only";

import { DateTime } from "luxon";

import type {
  AppSettings,
  PacingComparison,
  PacingCycleRange,
  PacingStatus,
  ResetDay,
  UsageBucket,
  WeeklyActualPoint,
  WeeklyProjectionPoint,
} from "@/lib/types";

const ORDERED_DAYS: ResetDay[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const SHORT_LABEL: Record<ResetDay, string> = {
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
};

function weekdayIndex(day: ResetDay): number {
  return ORDERED_DAYS.indexOf(day);
}

function dayFromIndex(index: number): ResetDay {
  return ORDERED_DAYS[(index + 7) % 7];
}

function asTimezoneNow(timezone: string): DateTime {
  return DateTime.now().setZone(timezone);
}

export function getMostRecentReset(settings: AppSettings, nowInput?: DateTime): DateTime {
  const now = (nowInput ?? asTimezoneNow(settings.timezone)).setZone(settings.timezone);
  const currentDayIndex = weekdayIndex(dayFromIndex(now.weekday % 7));
  const targetDayIndex = weekdayIndex(settings.resetDay);
  const daysBack = (currentDayIndex - targetDayIndex + 7) % 7;

  let candidate = now
    .minus({ days: daysBack })
    .set({ hour: settings.resetHour, minute: 0, second: 0, millisecond: 0 });

  if (candidate > now) {
    candidate = candidate.minus({ days: 7 });
  }

  return candidate;
}

export function getNextReset(settings: AppSettings, nowInput?: DateTime): DateTime {
  return getMostRecentReset(settings, nowInput).plus({ days: 7 });
}

export function getCurrentCycleRange(settings: AppSettings, nowInput?: DateTime): PacingCycleRange {
  const start = getMostRecentReset(settings, nowInput);
  const end = start.plus({ days: 7 });

  return {
    timezone: settings.timezone,
    startIso: start.toUTC().toISO() ?? start.toISO() ?? "",
    endIso: end.toUTC().toISO() ?? end.toISO() ?? "",
  };
}

export function buildSimpleWeeklyProjection(settings: AppSettings): WeeklyProjectionPoint[] {
  const baseDayIndex = weekdayIndex(settings.resetDay);

  return Array.from({ length: 7 }, (_, slot) => {
    const day = dayFromIndex(baseDayIndex + slot);
    const expected = Math.min((slot + 1) * settings.simpleDailyIncrement, settings.weeklyTargetPercent);

    return {
      slot,
      day,
      label: SHORT_LABEL[day],
      expected,
    };
  });
}

export function getCurrentCycleSlot(settings: AppSettings, nowInput?: DateTime): number {
  const now = (nowInput ?? asTimezoneNow(settings.timezone)).setZone(settings.timezone);
  const cycleStart = getMostRecentReset(settings, now);
  const elapsedHours = Math.max(0, now.diff(cycleStart, "hours").hours);
  return Math.min(6, Math.floor(elapsedHours / 24));
}

export function getExpectedCheckpointForNow(
  settings: AppSettings,
  projection: WeeklyProjectionPoint[],
  nowInput?: DateTime,
): WeeklyProjectionPoint {
  const slot = getCurrentCycleSlot(settings, nowInput);
  return projection[slot] ?? projection[projection.length - 1];
}

export function compareActualVsExpected(actual: number, expected: number): PacingComparison {
  const normalizedActual = Math.round(actual);
  const delta = normalizedActual - expected;

  let status: PacingStatus = "on-track";

  if (delta > 0) {
    status = "ahead";
  } else if (delta < 0) {
    status = "behind";
  }

  return {
    expected,
    actual: normalizedActual,
    delta,
    status,
  };
}

function toCycleSlot(timeIso: string, cycleStart: DateTime, timezone: string): number {
  const timestamp = DateTime.fromISO(timeIso).setZone(timezone);
  const elapsedHours = Math.max(0, timestamp.diff(cycleStart, "hours").hours);
  return Math.min(6, Math.floor(elapsedHours / 24));
}

export function buildWeeklyActualSeries(
  settings: AppSettings,
  usageBuckets: UsageBucket[],
  projection: WeeklyProjectionPoint[],
  nowInput?: DateTime,
): WeeklyActualPoint[] {
  const now = (nowInput ?? asTimezoneNow(settings.timezone)).setZone(settings.timezone);
  const cycleStart = getMostRecentReset(settings, now);
  const cycleEnd = cycleStart.plus({ days: 7 });

  const perSlot = new Array<number>(7).fill(0);

  for (const bucket of usageBuckets) {
    const start = DateTime.fromISO(bucket.startTime).setZone(settings.timezone);
    if (start < cycleStart || start >= cycleEnd) {
      continue;
    }

    const slot = toCycleSlot(bucket.startTime, cycleStart, settings.timezone);
    perSlot[slot] += bucket.totalUsage;
  }

  const cumulative: number[] = [];
  for (let index = 0; index < perSlot.length; index += 1) {
    const previous = index === 0 ? 0 : cumulative[index - 1];
    cumulative[index] = previous + perSlot[index];
  }

  return projection.map((point) => ({
    slot: point.slot,
    day: point.day,
    label: point.label,
    actual: Math.round(cumulative[point.slot] ?? 0),
  }));
}
