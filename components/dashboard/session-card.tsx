import { ProgressBar } from "@/components/dashboard/progress-bar";

function parseResetTime(
  resetText: string,
): { relative: string; absolute: string } | null {
  const match = resetText.match(
    /Resets in (\d+)\s*hr(?:s)?\s*(?:(\d+)\s*min)?/i,
  );
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const mins = match[2] ? parseInt(match[2], 10) : 0;
  const totalMs = (hours * 60 + mins) * 60 * 1000;
  const resetDateTime = new Date(Date.now() + totalMs);

  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const absolute = formatter.format(resetDateTime);
  const relative = `${hours} h ${mins} min`;

  return { relative, absolute };
}

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
          <p>{resetTimeInfo.absolute}</p>
        </div>
      ) : (
        <p className="text-base leading-tight text-ctp-subtext0 sm:truncate sm:leading-none">
          {resetText ?? "no data"}
        </p>
      )}
    </div>
  );
}
