import { NextResponse } from "next/server";

import { calculateCompanionDashboard } from "@/lib/companion-logic";
import { loadCompanionSettings, loadUsageHistory, loadUsageState } from "@/lib/companion-storage";
import type { CompanionDashboardResponse } from "@/lib/companion-types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = await loadCompanionSettings();
    const [state, history] = await Promise.all([
      loadUsageState(settings),
      loadUsageHistory(),
    ]);

    const computed = calculateCompanionDashboard(settings, state);
    const recentSnapshots = [...history.snapshots]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 20);

    const payload: CompanionDashboardResponse = {
      settings,
      state,
      computed,
      recentSnapshots,
    };

    return NextResponse.json(payload, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load personal companion data";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
