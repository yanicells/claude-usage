import { ProgressBar } from "@/components/dashboard/progress-bar";
import { parseResetTime } from "@/lib/reset-time";

export function SessionCard({
  used,
  resetText,
}: {
  used: number | null;
  resetText: string | null;
}) {
  const pct = used ?? 0;
  const barColor =
    pct >= 80 ? "bg-ctp-red" : pct >= 60 ? "bg-ctp-yellow" : "bg-ctp-blue";
  const resetTimeInfo = resetText ? parseResetTime(resetText) : null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-ctp-surface1 bg-ctp-surface0 p-7">
      <p className="text-6xl leading-none font-bold text-ctp-text tabular-nums">
        {used !== null ? `${used}%` : "—"}
      </p>
      <ProgressBar pct={pct} color={barColor} />
      {resetTimeInfo ? (
        <div className="flex items-center justify-between gap-2 text-base leading-tight text-ctp-subtext0">
          <p>Resets in {resetTimeInfo.relative}</p>
          <p className="text-right tabular-nums">{resetTimeInfo.absolute}</p>
        </div>
      ) : (
        <p className="text-base leading-tight text-ctp-subtext0 sm:truncate sm:leading-none">
          {resetText ?? "no data"}
        </p>
      )}
    </div>
  );
}
