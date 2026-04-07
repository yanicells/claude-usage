import { ProgressBar } from "@/components/dashboard/progress-bar";

export function WeeklyCard({
  used,
  resetText,
  status,
}: {
  used: number | null;
  resetText: string | null;
  status: "ahead" | "on-track" | "behind" | null;
}) {
  const pct = used ?? 0;
  const barColor =
    status === "ahead"
      ? "bg-ctp-red"
      : status === "behind"
        ? "bg-ctp-green"
        : "bg-ctp-blue";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-ctp-surface1 bg-ctp-surface0 p-7">
      <p className="text-6xl leading-none font-bold text-ctp-text tabular-nums">
        {used !== null ? `${used}%` : "—"}
      </p>
      <ProgressBar pct={pct} color={barColor} />
      <p className="text-base leading-none text-ctp-subtext0">
        {resetText ?? "no data"}
      </p>
    </div>
  );
}
