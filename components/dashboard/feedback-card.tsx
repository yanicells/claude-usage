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
  let roomSuffix = "awaiting usage";
  let sessionValueText = "—";
  let sessionValueColor = "text-ctp-overlay0";
  let actualColor = "text-ctp-text";
  let expectedColor = "text-ctp-subtext0";

  if (delta !== null) {
    const abs = Math.abs(delta);
    const sessions = Math.round((abs / 14) * 2) / 2;

    deltaText = `${delta > 0 ? "+" : ""}${delta}%`;

    if (delta < 0) {
      statusWord = "Behind";
      statusColor = "text-ctp-green";
      actualColor = "text-ctp-green";
      expectedColor = "text-ctp-blue";
      sessionValueText = `${sessions}`;
      sessionValueColor = "text-ctp-green";
      roomSuffix = sessions === 1 ? "session left" : "sessions left";
    } else if (delta > 0) {
      statusWord = "Ahead";
      statusColor = "text-ctp-red";
      actualColor = "text-ctp-red";
      expectedColor = "text-ctp-blue";
      sessionValueText = `${sessions}`;
      sessionValueColor = "text-ctp-red";
      roomSuffix = sessions === 1 ? "session over" : "sessions over";
    } else {
      statusWord = "Even";
      statusColor = "text-ctp-blue";
      actualColor = "text-ctp-blue";
      expectedColor = "text-ctp-blue";
      sessionValueText = "On target";
      sessionValueColor = "text-ctp-blue";
      roomSuffix = "";
    }
  }

  return (
    <div className="shrink-0 rounded-2xl border border-ctp-surface1 bg-ctp-surface0 px-3 py-2 sm:px-5 sm:py-3">
      <div className="grid md:grid-cols-3 md:divide-x md:divide-ctp-surface1/80">
        <div className="px-3 py-2">
          <p className="mb-1 text-[0.68rem] tracking-[0.14em] text-ctp-overlay0 uppercase">
            Pace status
          </p>
          <p className={`text-2xl leading-tight font-bold ${statusColor}`}>
            {statusWord} {delta !== null ? `by ${deltaText}` : ""}
          </p>
        </div>

        <div className="border-t border-ctp-surface1/80 px-3 py-2 md:border-t-0">
          <p className="mb-1 text-[0.68rem] tracking-[0.14em] text-ctp-overlay0 uppercase">
            weekly vs expected
          </p>
          <p className="text-2xl leading-tight font-semibold tabular-nums">
            <span className={actualColor}>
              {actual !== null ? `${actual}%` : "—"}
            </span>
            <span className="px-1 text-ctp-overlay0">/</span>
            <span className={expectedColor}>
              {expected !== null ? `${expected}%` : "—"}
            </span>
          </p>
        </div>

        <div className="border-t border-ctp-surface1/80 px-3 py-2 md:border-t-0">
          <p className="mb-1 text-[0.68rem] tracking-[0.14em] text-ctp-overlay0 uppercase">
            Session feedback
          </p>
          <p className="text-2xl leading-tight font-semibold text-ctp-subtext0">
            <span className={sessionValueColor}>{sessionValueText}</span>
            {roomSuffix ? <span className="ml-1">{roomSuffix}</span> : null}
          </p>
        </div>
      </div>
    </div>
  );
}
