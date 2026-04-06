"use client";

import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { WeeklyActualPoint, WeeklyProjectionPoint } from "@/lib/types";

interface PacingChartProps {
  expected: WeeklyProjectionPoint[];
  actual: WeeklyActualPoint[];
  currentSlot: number;
}

export function PacingChart({ expected, actual, currentSlot }: PacingChartProps) {
  const rows = expected.map((entry) => ({
    label: entry.label,
    slot: entry.slot,
    expected: entry.expected,
    actual: actual.find((item) => item.slot === entry.slot)?.actual ?? 0,
  }));

  if (rows.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        No pacing series available.
      </div>
    );
  }

  return (
    <div className="h-[280px] rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
          <XAxis dataKey="label" tick={{ fill: "#475569", fontSize: 12 }} />
          <YAxis tick={{ fill: "#475569", fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <ReferenceArea
            x1={rows[currentSlot]?.label}
            x2={rows[currentSlot]?.label}
            fill="#fde68a"
            fillOpacity={0.35}
          />
          <Line
            type="monotone"
            dataKey="expected"
            stroke="#dc2626"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            name="Expected"
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            name="Actual"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
