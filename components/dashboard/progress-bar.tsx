function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-ctp-surface1">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${clampPercent(pct)}%` }}
      />
    </div>
  );
}

export { clampPercent };
