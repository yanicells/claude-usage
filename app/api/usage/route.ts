import { NextResponse } from "next/server";
import { DateTime } from "luxon";

import {
  getUsageReport,
  groupUsageValues,
} from "@/lib/anthropic-admin";
import {
  buildSimpleWeeklyProjection,
  buildWeeklyActualSeries,
  compareActualVsExpected,
  getCurrentCycleRange,
  getCurrentCycleSlot,
  getExpectedCheckpointForNow,
} from "@/lib/pacing";
import { loadSettings } from "@/lib/settings";
import type {
  AppSettings,
  BucketWidth,
  UsageApiResponse,
  UsageFilters,
} from "@/lib/types";

export const runtime = "nodejs";
export const revalidate = 60;

function parseBucketWidth(value: string | null, fallback: BucketWidth): BucketWidth {
  if (!value) {
    return fallback;
  }

  const normalized = value.toLowerCase();
  if (normalized === "1m" || normalized === "1h" || normalized === "1d") {
    return normalized;
  }

  return fallback;
}

function resolveDateRange(
  search: URLSearchParams,
  settings: AppSettings,
): { startingAt: string; endingAt: string; timezone: string } {
  const timezone = search.get("timezone") || settings.timezone;
  const now = DateTime.now().setZone(timezone);
  const cycleRange = getCurrentCycleRange({ ...settings, timezone });

  const defaultStart =
    cycleRange.startIso || now.minus({ days: 7 }).toUTC().toISO() || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const defaultEnd = cycleRange.endIso || now.toUTC().toISO() || new Date().toISOString();

  const startingAt =
    search.get("startingAt") ||
    search.get("start") ||
    defaultStart;
  const endingAt =
    search.get("endingAt") ||
    search.get("end") ||
    defaultEnd;

  return {
    startingAt,
    endingAt,
    timezone,
  };
}

function usageFilters(search: URLSearchParams): UsageFilters {
  return {
    model: search.get("model") || undefined,
    workspace: search.get("workspace") || undefined,
    apiKey: search.get("apiKey") || undefined,
    serviceTier: search.get("serviceTier") || undefined,
  };
}

function formatUsageLabel(startIso: string, timezone: string, bucketWidth: BucketWidth): string {
  const value = DateTime.fromISO(startIso).setZone(timezone);

  if (bucketWidth === "1m" || bucketWidth === "1h") {
    return value.toFormat("dd LLL HH:mm");
  }

  return value.toFormat("dd LLL");
}

export async function GET(request: Request) {
  try {
    const settingsResult = await loadSettings();
    const search = new URL(request.url).searchParams;

    const range = resolveDateRange(search, settingsResult.settings);
    const bucketWidth = parseBucketWidth(search.get("bucketWidth"), settingsResult.settings.bucketWidth);

    const effectiveSettings: AppSettings = {
      ...settingsResult.settings,
      timezone: range.timezone,
      bucketWidth,
    };

    const usageData = await getUsageReport({
      startingAt: range.startingAt,
      endingAt: range.endingAt,
      bucketWidth,
      groupBy: ["model", "workspace", "apiKey", "serviceTier"],
      ...usageFilters(search),
    });

    const sortedUsage = [...usageData].sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );

    let cumulativeUsage = 0;
    const usageSeries = sortedUsage.map((bucket) => {
      cumulativeUsage += bucket.totalUsage;
      return {
        label: formatUsageLabel(bucket.startTime, effectiveSettings.timezone, bucketWidth),
        usage: bucket.totalUsage,
        cumulativeUsage,
        requests: bucket.totalRequests,
        startTime: bucket.startTime,
        endTime: bucket.endTime,
      };
    });

    const weeklyExpectedSeries = buildSimpleWeeklyProjection(effectiveSettings);
    const weeklyActualSeries = buildWeeklyActualSeries(
      effectiveSettings,
      sortedUsage,
      weeklyExpectedSeries,
    );

    const expectedCheckpoint = getExpectedCheckpointForNow(
      effectiveSettings,
      weeklyExpectedSeries,
    );
    const currentSlot = getCurrentCycleSlot(effectiveSettings);
    const actualProgress = weeklyActualSeries[currentSlot]?.actual ?? 0;
    const comparison = compareActualVsExpected(actualProgress, expectedCheckpoint.expected);

    const totalUsage = sortedUsage.reduce((sum, bucket) => sum + bucket.totalUsage, 0);
    const totalRequests = sortedUsage.reduce((sum, bucket) => sum + bucket.totalRequests, 0);

    const groupedByModel = groupUsageValues(sortedUsage, "model");
    const groupedByWorkspace = groupUsageValues(sortedUsage, "workspace");
    const groupedByApiKey = groupUsageValues(sortedUsage, "apiKey");
    const groupedByServiceTier = groupUsageValues(sortedUsage, "serviceTier");

    const payload: UsageApiResponse = {
      settings: effectiveSettings,
      cycleRange: getCurrentCycleRange(effectiveSettings),
      queryRange: {
        startingAt: range.startingAt,
        endingAt: range.endingAt,
        bucketWidth,
      },
      currentSlot,
      comparison,
      totalUsage,
      totalRequests,
      usageSeries,
      weeklyExpectedSeries,
      weeklyActualSeries,
      groupedByModel,
      groupedByWorkspace,
      groupedByApiKey,
      groupedByServiceTier,
    };

    return NextResponse.json(payload, {
      headers: {
        "cache-control": "s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown usage route error";
    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}
