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

interface UsageLineChartProps {
  data: Array<{
    label: string;
    usage: number;
    cumulativeUsage: number;
  }>;
}

export function UsageLineChart({ data }: UsageLineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        No usage data returned for this filter set.
      </div>
    );
  }

  return (
    <div className="h-[280px] rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
          <XAxis dataKey="label" tick={{ fill: "#475569", fontSize: 12 }} />
          <YAxis tick={{ fill: "#475569", fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="usage"
            stroke="#0284c7"
            strokeWidth={2}
            dot={{ r: 2 }}
            name="Usage"
          />
          <Line
            type="monotone"
            dataKey="cumulativeUsage"
            stroke="#0f766e"
            strokeWidth={2}
            dot={false}
            name="Cumulative"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
