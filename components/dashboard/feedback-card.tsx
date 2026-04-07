export function FeedbackCard({
  delta,
  actual,
  expected,
}: {
  delta: number | null;
  actual: number | null;
  expected: number | null;
}) {
  let statusWord = "—";
  let statusColor = "text-ctp-overlay0";
  let deltaText = "no data";
  let roomText = "Paste usage block";

  if (delta !== null) {
    const abs = Math.abs(delta);
    const sessions = Math.round((abs / 14) * 2) / 2;

    deltaText = `${delta > 0 ? "+" : ""}${delta}%`;

    if (delta < 0) {
      statusWord = "Behind";
      statusColor = "text-ctp-green";
      roomText = `${sessions} sessions of room`;
    } else if (delta > 0) {
      statusWord = "Ahead";
      statusColor = "text-ctp-red";
      roomText = `${sessions} sessions to trim`;
    } else {
      statusWord = "Even";
      statusColor = "text-ctp-blue";
      roomText = "No adjustment needed";
    }
  }

  return (
    <div className="shrink-0 rounded-2xl border border-ctp-surface1 bg-ctp-surface0 px-7 py-5">
      <div className="grid gap-5 md:grid-cols-3">
        <div>
          <p className="mb-2 text-xs tracking-wide text-ctp-overlay0 uppercase">
            Pace status
          </p>
          <p className={`text-3xl leading-tight font-bold ${statusColor}`}>
            {statusWord} {delta !== null ? `by ${deltaText}` : ""}
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs tracking-wide text-ctp-overlay0 uppercase">
            Current weekly vs expected
          </p>
          <p className="text-2xl leading-tight font-semibold text-ctp-text tabular-nums">
            {actual !== null ? `${actual}%` : "—"} /{" "}
            {expected !== null ? `${expected}%` : "—"}
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs tracking-wide text-ctp-overlay0 uppercase">
            Session feedback
          </p>
          <p className="text-2xl leading-tight font-semibold text-ctp-subtext0">
            {roomText}
          </p>
        </div>
      </div>
    </div>
  );
}
