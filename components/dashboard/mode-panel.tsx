import { DateTime } from "luxon";

import { InfoIcon } from "@/components/dashboard/dashboard-icons";
import { clampPercent } from "@/components/dashboard/progress-bar";

const SWITCH_START_MINUTE = 20 * 60;
const SWITCH_END_MINUTE = 2 * 60;
const MINUTES_PER_DAY = 24 * 60;

function isFasterStartDay(weekday: number): boolean {
  return weekday >= 1 && weekday <= 5;
}

function getNowPh(
  nextSwitch: DateTime | null,
  remainingMs: number | null,
): DateTime {
  if (nextSwitch && remainingMs !== null) {
    const nowMs = nextSwitch.toMillis() - remainingMs;
    return DateTime.fromMillis(nowMs).setZone("Asia/Manila");
  }

  return DateTime.now().setZone("Asia/Manila");
}

function getDailyNormalWindow(nowPh: DateTime): {
  startMinute: number;
  endMinute: number;
} {
  const morningIsFaster = isFasterStartDay(nowPh.minus({ days: 1 }).weekday);
  const eveningIsFaster = isFasterStartDay(nowPh.weekday);

  return {
    startMinute: morningIsFaster ? SWITCH_END_MINUTE : 0,
    endMinute: eveningIsFaster ? SWITCH_START_MINUTE : MINUTES_PER_DAY,
  };
}

function formatMinuteLabel(minute: number): string {
  if (minute <= 0 || minute >= MINUTES_PER_DAY) {
    return "12 am";
  }

  if (minute === SWITCH_END_MINUTE) {
    return "2 am";
  }

  if (minute === SWITCH_START_MINUTE) {
    return "8 pm";
  }

  const hours = Math.floor(minute / 60);
  const mins = minute % 60;
  const period = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(mins).padStart(2, "0")} ${period}`;
}

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

  return clampPercent((minutesToday / MINUTES_PER_DAY) * 100);
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
  const nowPh = getNowPh(nextSwitch, remainingMs);
  const { startMinute, endMinute } = getDailyNormalWindow(nowPh);

  const startPct = clampPercent((startMinute / MINUTES_PER_DAY) * 100);
  const endPct = clampPercent((endMinute / MINUTES_PER_DAY) * 100);
  const normalWidthPct = Math.max(0, endPct - startPct);
  const showBoundaryTicks = startMinute > 0 || endMinute < MINUTES_PER_DAY;

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
                <td className="py-2 pr-3">Mon-Fri, 8 PM-2 AM</td>
                <td className="py-2 pl-3">Sat 2 AM-Mon 8 PM + weekdays 2 AM-8 PM</td>
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
          <span className="block h-3.5 w-3.5 rounded-full text-ctp-blue bg-current" />
        </div>
      </div>

      {showBoundaryTicks && (
        <div className="relative h-4 text-[0.72rem] text-ctp-subtext0 tabular-nums">
          <span
            className="absolute -translate-x-1/2"
            style={{ left: `${startPct}%` }}
          >
            {formatMinuteLabel(startMinute)}
          </span>
          <span
            className="absolute -translate-x-1/2"
            style={{ left: `${endPct}%` }}
          >
            {formatMinuteLabel(endMinute)}
          </span>
        </div>
      )}

      <p className="text-base leading-none text-ctp-subtext0 tabular-nums">
        Switches in {countdown}
      </p>
    </div>
  );
}
