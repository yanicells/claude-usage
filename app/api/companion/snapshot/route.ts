import { NextResponse } from "next/server";

import { calculateCompanionDashboard } from "@/lib/companion-logic";
import { saveSnapshot } from "@/lib/companion-storage";
import type { CompanionDashboardResponse, SnapshotSaveInput } from "@/lib/companion-types";

export const runtime = "nodejs";

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Partial<SnapshotSaveInput>;

    if (!hasValue(payload.fiveHourUsageInput)) {
      return NextResponse.json(
        { error: "fiveHourUsageInput is required" },
        { status: 400 },
      );
    }

    if (!hasValue(payload.weeklyUsagePercent)) {
      return NextResponse.json(
        { error: "weeklyUsagePercent is required" },
        { status: 400 },
      );
    }

    const fiveHourUsageInput = payload.fiveHourUsageInput as string | number;
    const weeklyUsagePercent = payload.weeklyUsagePercent as string | number;

    const { settings, state, history } = await saveSnapshot({
      fiveHourUsageInput,
      weeklyUsagePercent,
      notes: payload.notes,
      timestamp: payload.timestamp,
      startNewFiveHourWindow: payload.startNewFiveHourWindow,
    });

    const computed = calculateCompanionDashboard(settings, state);
    const recentSnapshots = [...history.snapshots]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 20);

    const responsePayload: CompanionDashboardResponse = {
      settings,
      state,
      computed,
      recentSnapshots,
    };

    return NextResponse.json(responsePayload, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save snapshot";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
