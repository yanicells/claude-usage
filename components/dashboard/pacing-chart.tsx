import type { WeeklyProjectionPoint } from "@/lib/local-companion";

function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function PacingChart({
  points,
  currentIndex,
  actual,
}: {
  points: WeeklyProjectionPoint[];
  currentIndex: number | null;
  actual: number | null;
}) {
  if (points.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center rounded-2xl border border-dashed border-ctp-surface1">
        <p className="text-base text-ctp-overlay0">
          paste usage to generate chart
        </p>
      </div>
    );
  }

  const normalizedActual = actual !== null ? clampPercent(actual) : null;

  return (
    <div className="flex-1 grid grid-cols-7 gap-3 min-h-0">
      {points.map((point) => {
        const isCurrent = point.index === currentIndex;
        const exp = point.expectedCumulativePercent;

        let greenHeight = 0;
        let accentHeight = 0;
        let accentBottom = 0;
        let accentColor = "";

        if (isCurrent && normalizedActual !== null) {
          if (normalizedActual <= exp) {
            greenHeight = normalizedActual;
            accentHeight = exp - normalizedActual;
            accentBottom = normalizedActual;
            accentColor = "bg-ctp-blue/40";
          } else {
            greenHeight = exp;
            accentHeight = normalizedActual - exp;
            accentBottom = exp;
            accentColor = "bg-ctp-red/60";
          }
        }

        return (
          <div key={point.checkpointIso} className="flex flex-col gap-2">
            <div
              className={`relative flex-1 overflow-hidden rounded-xl border border-ctp-surface1 ${
                isCurrent ? "bg-ctp-surface1" : "bg-ctp-surface0"
              }`}
            >
              {isCurrent && normalizedActual !== null ? (
                <div
                  className="absolute inset-x-0 bottom-0 bg-ctp-green/60 transition-all duration-700"
                  style={{ height: `${greenHeight}%` }}
                />
              ) : null}
              {isCurrent && accentHeight > 0 ? (
                <div
                  className={`absolute inset-x-0 transition-all duration-700 ${accentColor}`}
                  style={{
                    bottom: `${accentBottom}%`,
                    height: `${accentHeight}%`,
                  }}
                />
              ) : null}
              <div
                className="absolute inset-x-0 border-t-2 border-ctp-lavender/50"
                style={{ bottom: `${exp}%` }}
              />
            </div>

            <div className="shrink-0 text-center">
              <span
                className={`block text-xl font-bold ${
                  isCurrent ? "text-ctp-blue" : "text-ctp-subtext0"
                }`}
              >
                {point.dayLabel}
              </span>
              <span className="text-lg text-ctp-overlay0 tabular-nums">
                {exp}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
