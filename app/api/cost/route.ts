import { NextResponse } from "next/server";
import { DateTime } from "luxon";

import { getCostReport } from "@/lib/anthropic-admin";
import { getCurrentCycleRange } from "@/lib/pacing";
import { loadSettings } from "@/lib/settings";
import type { AppSettings, BucketWidth, CostApiResponse, UsageFilters } from "@/lib/types";

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

  return {
    startingAt: search.get("startingAt") || search.get("start") || defaultStart,
    endingAt: search.get("endingAt") || search.get("end") || defaultEnd,
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

function formatCostLabel(startIso: string, timezone: string, bucketWidth: BucketWidth): string {
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

    const costBuckets = await getCostReport({
      startingAt: range.startingAt,
      endingAt: range.endingAt,
      bucketWidth,
      groupBy: ["model", "workspace", "apiKey", "serviceTier"],
      ...usageFilters(search),
    });

    const sorted = [...costBuckets].sort((a, b) => a.startTime.localeCompare(b.startTime));

    let cumulativeCostUsd = 0;
    const costSeries = sorted.map((bucket) => {
      cumulativeCostUsd += bucket.totalCostUsd;
      return {
        label: formatCostLabel(bucket.startTime, effectiveSettings.timezone, bucketWidth),
        costUsd: Number(bucket.totalCostUsd.toFixed(6)),
        cumulativeCostUsd: Number(cumulativeCostUsd.toFixed(6)),
        startTime: bucket.startTime,
        endTime: bucket.endTime,
      };
    });

    const totalCostUsd = Number(sorted.reduce((sum, bucket) => sum + bucket.totalCostUsd, 0).toFixed(6));

    const payload: CostApiResponse = {
      settings: effectiveSettings,
      totalCostUsd,
      costSeries,
    };

    return NextResponse.json(payload, {
      headers: {
        "cache-control": "s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown cost route error";
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
