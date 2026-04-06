import { cn } from "@/lib/cn";

type Tone = "neutral" | "good" | "warn" | "bad";

const toneClasses: Record<Tone, string> = {
  neutral: "border-slate-200 bg-white",
  good: "border-emerald-300 bg-emerald-50/60",
  warn: "border-amber-300 bg-amber-50/70",
  bad: "border-rose-300 bg-rose-50/70",
};

interface OverviewCardProps {
  title: string;
  value: string;
  subtitle?: string;
  tone?: Tone;
}

export function OverviewCard({ title, value, subtitle, tone = "neutral" }: OverviewCardProps) {
  return (
    <article
      className={cn(
        "rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md",
        toneClasses[tone],
      )}
    >
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">{title}</h3>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
    </article>
  );
}
