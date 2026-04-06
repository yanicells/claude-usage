import { NextResponse } from "next/server";

import { loadSettings, saveSettings } from "@/lib/settings";
import type { SettingsPatch } from "@/lib/types";

export const runtime = "nodejs";

function isAllowedResetDay(day: string | undefined): boolean {
  if (!day) {
    return false;
  }

  return [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ].includes(day.toLowerCase());
}

function isAllowedBucketWidth(width: string | undefined): boolean {
  if (!width) {
    return false;
  }

  return ["1m", "1h", "1d"].includes(width.toLowerCase());
}

function validatePatch(payload: SettingsPatch): string[] {
  const errors: string[] = [];

  if (payload.timezone !== undefined && typeof payload.timezone !== "string") {
    errors.push("timezone must be a string");
  }

  if (payload.resetDay !== undefined && !isAllowedResetDay(payload.resetDay)) {
    errors.push("resetDay must be a valid weekday");
  }

  if (
    payload.resetHour !== undefined &&
    (!Number.isInteger(payload.resetHour) || payload.resetHour < 0 || payload.resetHour > 23)
  ) {
    errors.push("resetHour must be an integer from 0 to 23");
  }

  if (
    payload.weeklyTargetPercent !== undefined &&
    (!Number.isFinite(payload.weeklyTargetPercent) || payload.weeklyTargetPercent <= 0)
  ) {
    errors.push("weeklyTargetPercent must be a positive number");
  }

  if (
    payload.simpleDailyIncrement !== undefined &&
    (!Number.isFinite(payload.simpleDailyIncrement) || payload.simpleDailyIncrement <= 0)
  ) {
    errors.push("simpleDailyIncrement must be a positive number");
  }

  if (payload.bucketWidth !== undefined && !isAllowedBucketWidth(payload.bucketWidth)) {
    errors.push("bucketWidth must be one of 1m, 1h, or 1d");
  }

  return errors;
}

export async function GET() {
  try {
    const settings = await loadSettings();
    return NextResponse.json(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SettingsPatch;
    const validationErrors = validatePatch(payload);

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Invalid settings payload",
          validationErrors,
        },
        { status: 400 },
      );
    }

    const saved = await saveSettings(payload);
    return NextResponse.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
