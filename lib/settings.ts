import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  BUCKET_WIDTHS,
  type AppSettings,
  RESET_DAYS,
  type ResetDay,
  type SettingsPatch,
  type SettingsApiResponse,
} from "@/lib/types";

const DEFAULTS = {
  timezone: "UTC",
  resetDay: "friday" as ResetDay,
  resetHour: 0,
  weeklyTargetPercent: 100,
  simpleDailyIncrement: 14,
  bucketWidth: "1d" as const,
};

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseResetDay(value: string | undefined, fallback: ResetDay): ResetDay {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if ((RESET_DAYS as readonly string[]).includes(normalized)) {
    return normalized as ResetDay;
  }

  return fallback;
}

function parseBucketWidth(value: string | undefined, fallback: AppSettings["bucketWidth"]): AppSettings["bucketWidth"] {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if ((BUCKET_WIDTHS as readonly string[]).includes(normalized)) {
    return normalized as AppSettings["bucketWidth"];
  }

  return fallback;
}

function sanitizeSettings(input: SettingsPatch, fallback: AppSettings): AppSettings {
  const timezone = typeof input.timezone === "string" && input.timezone.trim().length > 0
    ? input.timezone.trim()
    : fallback.timezone;

  const resetDay = parseResetDay(input.resetDay, fallback.resetDay);

  const resetHour = Number.isInteger(input.resetHour) && (input.resetHour as number) >= 0 && (input.resetHour as number) <= 23
    ? (input.resetHour as number)
    : fallback.resetHour;

  const weeklyTargetPercent = Number.isFinite(input.weeklyTargetPercent)
    ? Math.max(1, Math.round(input.weeklyTargetPercent as number))
    : fallback.weeklyTargetPercent;

  const simpleDailyIncrement = Number.isFinite(input.simpleDailyIncrement)
    ? Math.max(1, Math.round(input.simpleDailyIncrement as number))
    : fallback.simpleDailyIncrement;

  const bucketWidth = parseBucketWidth(input.bucketWidth, fallback.bucketWidth);

  return {
    timezone,
    resetDay,
    resetHour,
    weeklyTargetPercent,
    simpleDailyIncrement,
    bucketWidth,
  };
}

export function getSettingsFilePath(): string {
  const configuredPath = process.env.SETTINGS_FILE_PATH?.trim() || "./config/settings.json";
  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }

  return path.resolve(process.cwd(), configuredPath);
}

export function getEnvDefaults(): AppSettings {
  const timezone = process.env.DEFAULT_TIMEZONE?.trim() || DEFAULTS.timezone;
  const resetDay = parseResetDay(process.env.DEFAULT_RESET_DAY, DEFAULTS.resetDay);
  const resetHour = Math.min(23, Math.max(0, parseInteger(process.env.DEFAULT_RESET_HOUR, DEFAULTS.resetHour)));
  const weeklyTargetPercent = Math.max(
    1,
    parseInteger(process.env.DEFAULT_WEEKLY_TARGET_PERCENT, DEFAULTS.weeklyTargetPercent),
  );
  const simpleDailyIncrement = Math.max(
    1,
    parseInteger(process.env.DEFAULT_SIMPLE_DAILY_INCREMENT, DEFAULTS.simpleDailyIncrement),
  );
  const bucketWidth = parseBucketWidth(process.env.DEFAULT_BUCKET_WIDTH, DEFAULTS.bucketWidth);

  return {
    timezone,
    resetDay,
    resetHour,
    weeklyTargetPercent,
    simpleDailyIncrement,
    bucketWidth,
  };
}

async function readSettingsOverrides(filePath: string): Promise<SettingsPatch | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return parsed as SettingsPatch;
  } catch {
    return null;
  }
}

export async function loadSettings(): Promise<SettingsApiResponse> {
  const filePath = getSettingsFilePath();
  const defaults = getEnvDefaults();
  const fileSettings = await readSettingsOverrides(filePath);

  if (!fileSettings) {
    return {
      settings: defaults,
      sourcePath: filePath,
      usedFileOverrides: false,
    };
  }

  return {
    settings: sanitizeSettings(fileSettings, defaults),
    sourcePath: filePath,
    usedFileOverrides: true,
  };
}

export async function saveSettings(patch: SettingsPatch): Promise<SettingsApiResponse> {
  const filePath = getSettingsFilePath();
  const loaded = await loadSettings();
  const merged = sanitizeSettings({ ...loaded.settings, ...patch }, loaded.settings);

  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);

  return {
    settings: merged,
    sourcePath: filePath,
    usedFileOverrides: true,
  };
}
