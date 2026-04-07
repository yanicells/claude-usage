import { DateTime } from "luxon";

import { InfoIcon } from "@/components/dashboard/dashboard-icons";
import { clampPercent, ProgressBar } from "@/components/dashboard/progress-bar";

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
  const FASTER_TOTAL = 6 * 3600 * 1000;
  const NORMAL_TOTAL = 18 * 3600 * 1000;
  const totalDuration = isFaster ? FASTER_TOTAL : NORMAL_TOTAL;
  const elapsed =
    remainingMs !== null
      ? Math.max(0, totalDuration - Math.min(remainingMs, totalDuration))
      : 0;
  const progressPct = clampPercent((elapsed / totalDuration) * 100);
  const barColor = isFaster ? "bg-ctp-yellow" : "bg-ctp-green";
  const modeColor = isFaster ? "text-ctp-yellow" : "text-ctp-green";

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
                <td className="py-2 pl-3">2 AM - 8 PM + wknd</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className={`text-5xl leading-none font-bold ${modeColor}`}>
        {isFaster ? "Nerfed" : "Normal"}
      </p>
      <ProgressBar pct={progressPct} color={barColor} />
      <p className="text-xl leading-none text-ctp-subtext0 tabular-nums">
        {isFaster ? "Normal" : "Nerfed"} in {countdown}
      </p>
    </div>
  );
}
