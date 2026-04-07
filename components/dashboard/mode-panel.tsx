import { DateTime } from "luxon";

import { InfoIcon } from "@/components/dashboard/dashboard-icons";
import { clampPercent } from "@/components/dashboard/progress-bar";

const SWITCH_START_MINUTE = 20 * 60;
const SWITCH_END_MINUTE = 2 * 60;

function getTimelinePositionPercent(
  nextSwitch: DateTime | null,
  remainingMs: number | null,
): number {
  if (!nextSwitch || remainingMs === null) {
    return 0;
  }

  const nowMs = nextSwitch.toMillis() - remainingMs;
  const nowPh = DateTime.fromMillis(nowMs).setZone("Asia/Manila");
  const minutesToday = nowPh.hour * 60 + nowPh.minute + nowPh.second / 60;

  return clampPercent((minutesToday / (24 * 60)) * 100);
}

export function ModePanel({
  mode,
  countdown,
  nextSwitch,
  remainingMs,
}: {
  mode: "faster" | "normal";
  countdown: string;
  nextSwitch: DateTime | null;
  remainingMs: number | null;
}) {
  const isFaster = mode === "faster";
  const modeColor = isFaster ? "text-ctp-yellow" : "text-ctp-green";
  const timelinePct = getTimelinePositionPercent(nextSwitch, remainingMs);
  const startPct = clampPercent((SWITCH_END_MINUTE / (24 * 60)) * 100);
  const endPct = clampPercent((SWITCH_START_MINUTE / (24 * 60)) * 100);
  const normalWidthPct = Math.max(0, endPct - startPct);

  return (
    <div className="relative flex flex-col gap-3 rounded-2xl border border-ctp-surface1 bg-ctp-surface0 p-7">
      <div className="group absolute top-4 right-4">
        <button
          type="button"
          aria-label="View mode schedule"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-ctp-surface1 text-ctp-subtext0 transition-colors hover:text-ctp-text"
        >
          <InfoIcon />
        </button>

        <div className="pointer-events-none absolute top-9 right-0 z-20 w-80 translate-y-1 rounded-xl border border-ctp-surface1 bg-ctp-mantle p-4 opacity-0 shadow-xl transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
          <p className="mb-3 text-sm leading-none text-ctp-subtext0">
            Next switch:{" "}
            {nextSwitch
              ? `${nextSwitch.toFormat("ccc h:mm a")} PH`
              : "No schedule"}
          </p>
          <table className="w-full border-collapse overflow-hidden rounded-lg text-left">
            <thead>
              <tr className="border-b border-ctp-surface1 text-xs tracking-wide text-ctp-subtext0 uppercase">
                <th className="py-2 pr-3 font-semibold">Nerfed</th>
                <th className="py-2 pl-3 font-semibold">Normal</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-sm text-ctp-text">
                <td className="py-2 pr-3">8 PM - 2 AM</td>
                <td className="py-2 pl-3">2 AM - 8 PM + weekend</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className={`text-5xl leading-none font-bold ${modeColor}`}>
        {isFaster ? "Nerfed" : "Normal"}
      </p>

      <div className="relative mt-1">
        <div className="relative h-1.5 overflow-hidden rounded-full bg-ctp-surface1">
          <div
            className="absolute top-0 bottom-0 bg-ctp-green rounded-full"
            style={{ left: `${startPct}%`, width: `${normalWidthPct}%` }}
          />
        </div>
        <div
          className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${timelinePct}%` }}
        >
          <span className="block h-3.5 w-3.5 rounded-full bg-ctp-blue" />
        </div>
      </div>

      <div className="relative h-4 text-[0.72rem] text-ctp-subtext0 tabular-nums">
        <span
          className="absolute -translate-x-1/2"
          style={{ left: `${startPct}%` }}
        >
          2 am
        </span>
        <span
          className="absolute -translate-x-1/2"
          style={{ left: `${endPct}%` }}
        >
          8 pm
        </span>
      </div>

      <p className="text-base leading-none text-ctp-subtext0 tabular-nums">
        {isFaster ? "Normal" : "Nerfed"} in {countdown}
      </p>
    </div>
  );
}
