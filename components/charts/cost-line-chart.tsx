"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface CostLineChartProps {
  data: Array<{
    label: string;
    costUsd: number;
    cumulativeCostUsd: number;
  }>;
}

function usd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(value);
}

export function CostLineChart({ data }: CostLineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        No cost data returned for this filter set.
      </div>
    );
  }

  return (
    <div className="h-[280px] rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
          <XAxis dataKey="label" tick={{ fill: "#475569", fontSize: 12 }} />
          <YAxis
            tick={{ fill: "#475569", fontSize: 12 }}
            tickFormatter={(value) => usd(value).replace("$", "")}
          />
          <Tooltip
            formatter={(value) => {
              const numeric = typeof value === "number" ? value : Number(value ?? 0);
              return usd(Number.isFinite(numeric) ? numeric : 0);
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="costUsd"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ r: 2 }}
            name="Cost"
          />
          <Line
            type="monotone"
            dataKey="cumulativeCostUsd"
            stroke="#be123c"
            strokeWidth={2}
            dot={false}
            name="Cumulative"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
