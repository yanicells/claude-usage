import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { DateTime } from "luxon";

import { getCycleStartIsoForTimestamp } from "@/lib/companion-logic";
import type {
  CompanionSettings,
  SnapshotSaveInput,
  UsageHistory,
  UsageSnapshot,
  UsageState,
  WeekDay,
} from "@/lib/companion-types";

const SETTINGS_PATH = path.resolve(process.cwd(), "config/settings.json");
const STATE_PATH = path.resolve(process.cwd(), "data/usage-state.json");
const HISTORY_PATH = path.resolve(process.cwd(), "data/usage-history.json");

const DEFAULT_SETTINGS: CompanionSettings = {
  timezone: "Asia/Manila",
  weeklyResetDay: "friday",
  weeklyResetHour: 11,
  weeklyTargetPercent: 100,
  simpleDailyIncrement: 14,
  fiveHourWindowHours: 5,
  weeklyLimitLabel: "Weekly Claude limit",
  fiveHourLimitLabel: "5-hour Claude limit",
};

const ALL_WEEK_DAYS: WeekDay[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseWeekDay(value: unknown): WeekDay {
  if (typeof value !== "string") {
    return DEFAULT_SETTINGS.weeklyResetDay;
  }

  const normalized = value.trim().toLowerCase();
  if (ALL_WEEK_DAYS.includes(normalized as WeekDay)) {
    return normalized as WeekDay;
  }

  return DEFAULT_SETTINGS.weeklyResetDay;
}

function parsePercentFromInput(value: string | number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clamp(Math.round(value), 0, 100);
  }

  if (typeof value !== "string") {
    return 0;
  }

  const trimmed = value.trim();

  if (trimmed.includes("/")) {
    const [leftRaw, rightRaw] = trimmed.split("/").map((part) => part.trim());
    const left = Number.parseFloat(leftRaw);
    const right = Number.parseFloat(rightRaw);

    if (Number.isFinite(left) && Number.isFinite(right) && right > 0) {
      return clamp(Math.round((left / right) * 100), 0, 100);
    }
  }

  const parsed = Number.parseFloat(trimmed.replace(/%/g, ""));
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return clamp(Math.round(parsed), 0, 100);
}

async function readJsonObject<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return parsed as T;
  } catch {
    return null;
  }
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, content, "utf8");
  await rename(tempPath, filePath);
}

function sanitizeSettings(input: Partial<CompanionSettings> | null): CompanionSettings {
  if (!input) {
    return DEFAULT_SETTINGS;
  }

  const timezone = typeof input.timezone === "string" && input.timezone.trim().length > 0
    ? input.timezone.trim()
    : DEFAULT_SETTINGS.timezone;

  const weeklyResetHour = Number.isInteger(input.weeklyResetHour)
    ? clamp(input.weeklyResetHour as number, 0, 23)
    : DEFAULT_SETTINGS.weeklyResetHour;

  const weeklyTargetPercent = Number.isFinite(input.weeklyTargetPercent)
    ? Math.max(1, Math.round(input.weeklyTargetPercent as number))
    : DEFAULT_SETTINGS.weeklyTargetPercent;

  const simpleDailyIncrement = Number.isFinite(input.simpleDailyIncrement)
    ? Math.max(1, Math.round(input.simpleDailyIncrement as number))
    : DEFAULT_SETTINGS.simpleDailyIncrement;

  const fiveHourWindowHours = Number.isFinite(input.fiveHourWindowHours)
    ? Math.max(1, Math.round(input.fiveHourWindowHours as number))
    : DEFAULT_SETTINGS.fiveHourWindowHours;

  const weeklyLimitLabel = typeof input.weeklyLimitLabel === "string" && input.weeklyLimitLabel.trim().length > 0
    ? input.weeklyLimitLabel.trim()
    : DEFAULT_SETTINGS.weeklyLimitLabel;

  const fiveHourLimitLabel = typeof input.fiveHourLimitLabel === "string" && input.fiveHourLimitLabel.trim().length > 0
    ? input.fiveHourLimitLabel.trim()
    : DEFAULT_SETTINGS.fiveHourLimitLabel;

  return {
    timezone,
    weeklyResetDay: parseWeekDay(input.weeklyResetDay),
    weeklyResetHour,
    weeklyTargetPercent,
    simpleDailyIncrement,
    fiveHourWindowHours,
    weeklyLimitLabel,
    fiveHourLimitLabel,
  };
}

function defaultState(settings: CompanionSettings): UsageState {
  const now = DateTime.now().setZone(settings.timezone);

  return {
    currentFiveHourUsagePercent: 0,
    currentWeeklyUsagePercent: 0,
    currentFiveHourWindowStartedAt: now.toISO() ?? new Date().toISOString(),
    currentWeeklyCycleStartedAt: getCycleStartIsoForTimestamp(settings, now.toISO() ?? new Date().toISOString()),
    lastUpdatedAt: now.toISO() ?? new Date().toISOString(),
    notes: "",
  };
}

function sanitizeState(input: Partial<UsageState> | null, settings: CompanionSettings): UsageState {
  const fallback = defaultState(settings);
  if (!input) {
    return fallback;
  }

  const currentFiveHourUsagePercent = Number.isFinite(input.currentFiveHourUsagePercent)
    ? clamp(Math.round(input.currentFiveHourUsagePercent as number), 0, 100)
    : fallback.currentFiveHourUsagePercent;

  const currentWeeklyUsagePercent = Number.isFinite(input.currentWeeklyUsagePercent)
    ? clamp(Math.round(input.currentWeeklyUsagePercent as number), 0, 100)
    : fallback.currentWeeklyUsagePercent;

  const currentFiveHourWindowStartedAt = typeof input.currentFiveHourWindowStartedAt === "string" && input.currentFiveHourWindowStartedAt.length > 0
    ? input.currentFiveHourWindowStartedAt
    : fallback.currentFiveHourWindowStartedAt;

  const currentWeeklyCycleStartedAt = typeof input.currentWeeklyCycleStartedAt === "string" && input.currentWeeklyCycleStartedAt.length > 0
    ? input.currentWeeklyCycleStartedAt
    : fallback.currentWeeklyCycleStartedAt;

  const lastUpdatedAt = typeof input.lastUpdatedAt === "string" && input.lastUpdatedAt.length > 0
    ? input.lastUpdatedAt
    : fallback.lastUpdatedAt;

  const notes = typeof input.notes === "string" ? input.notes : "";

  return {
    currentFiveHourUsagePercent,
    currentWeeklyUsagePercent,
    currentFiveHourWindowStartedAt,
    currentWeeklyCycleStartedAt,
    lastUpdatedAt,
    notes,
  };
}

function sanitizeHistory(input: Partial<UsageHistory> | null): UsageHistory {
  if (!input || !Array.isArray(input.snapshots)) {
    return { snapshots: [] };
  }

  const snapshots: UsageSnapshot[] = input.snapshots
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const timestamp = typeof entry.timestamp === "string" && entry.timestamp.length > 0
        ? entry.timestamp
        : new Date().toISOString();

      const fiveHourUsagePercent = Number.isFinite(entry.fiveHourUsagePercent)
        ? clamp(Math.round(entry.fiveHourUsagePercent as number), 0, 100)
        : 0;

      const weeklyUsagePercent = Number.isFinite(entry.weeklyUsagePercent)
        ? clamp(Math.round(entry.weeklyUsagePercent as number), 0, 100)
        : 0;

      const notes = typeof entry.notes === "string" ? entry.notes : "";

      return {
        timestamp,
        fiveHourUsagePercent,
        weeklyUsagePercent,
        notes,
      };
    });

  return { snapshots };
}

export async function loadCompanionSettings(): Promise<CompanionSettings> {
  const parsed = await readJsonObject<Partial<CompanionSettings>>(SETTINGS_PATH);
  const settings = sanitizeSettings(parsed);

  if (!parsed) {
    await atomicWrite(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`);
  }

  return settings;
}

export async function loadUsageState(settings: CompanionSettings): Promise<UsageState> {
  const parsed = await readJsonObject<Partial<UsageState>>(STATE_PATH);
  const state = sanitizeState(parsed, settings);

  if (!parsed) {
    await atomicWrite(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
  }

  return state;
}

export async function loadUsageHistory(): Promise<UsageHistory> {
  const parsed = await readJsonObject<Partial<UsageHistory>>(HISTORY_PATH);
  const history = sanitizeHistory(parsed);

  if (!parsed) {
    await atomicWrite(HISTORY_PATH, `${JSON.stringify(history, null, 2)}\n`);
  }

  return history;
}

export async function saveUsageState(nextState: UsageState): Promise<void> {
  await atomicWrite(STATE_PATH, `${JSON.stringify(nextState, null, 2)}\n`);
}

export async function saveUsageHistory(nextHistory: UsageHistory): Promise<void> {
  await atomicWrite(HISTORY_PATH, `${JSON.stringify(nextHistory, null, 2)}\n`);
}

function parseSnapshotTimestamp(timestamp: string | undefined, timezone: string): DateTime {
  if (!timestamp || timestamp.trim().length === 0) {
    return DateTime.now().setZone(timezone);
  }

  const fromIso = DateTime.fromISO(timestamp, { setZone: true });
  if (fromIso.isValid) {
    return fromIso.setZone(timezone);
  }

  return DateTime.now().setZone(timezone);
}

export async function saveSnapshot(input: SnapshotSaveInput): Promise<{ state: UsageState; history: UsageHistory; settings: CompanionSettings }> {
  const settings = await loadCompanionSettings();
  const state = await loadUsageState(settings);
  const history = await loadUsageHistory();

  const timestamp = parseSnapshotTimestamp(input.timestamp, settings.timezone);
  const timestampIso = timestamp.toISO() ?? new Date().toISOString();

  const nextFiveHourUsagePercent = parsePercentFromInput(input.fiveHourUsageInput);
  const nextWeeklyUsagePercent = parsePercentFromInput(input.weeklyUsagePercent);
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";

  const existingWindowStart = DateTime.fromISO(state.currentFiveHourWindowStartedAt, { setZone: true });
  const existingWindowReset = existingWindowStart.plus({ hours: settings.fiveHourWindowHours });

  const shouldStartNewWindow = Boolean(input.startNewFiveHourWindow)
    || !existingWindowStart.isValid
    || !existingWindowReset.isValid
    || timestamp >= existingWindowReset;

  const nextState: UsageState = {
    currentFiveHourUsagePercent: nextFiveHourUsagePercent,
    currentWeeklyUsagePercent: nextWeeklyUsagePercent,
    currentFiveHourWindowStartedAt: shouldStartNewWindow
      ? timestampIso
      : state.currentFiveHourWindowStartedAt,
    currentWeeklyCycleStartedAt: getCycleStartIsoForTimestamp(settings, timestampIso),
    lastUpdatedAt: timestampIso,
    notes,
  };

  const nextSnapshots = [...history.snapshots, {
    timestamp: timestampIso,
    fiveHourUsagePercent: nextFiveHourUsagePercent,
    weeklyUsagePercent: nextWeeklyUsagePercent,
    notes,
  }].slice(-200);

  const nextHistory: UsageHistory = {
    snapshots: nextSnapshots,
  };

  await Promise.all([
    saveUsageState(nextState),
    saveUsageHistory(nextHistory),
  ]);

  return {
    state: nextState,
    history: nextHistory,
    settings,
  };
}
