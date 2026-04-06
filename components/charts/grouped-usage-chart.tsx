"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { GroupedValue } from "@/lib/types";

interface GroupedUsageChartProps {
  title: string;
  data: GroupedValue[];
}

export function GroupedUsageChart({ title, data }: GroupedUsageChartProps) {
  if (data.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <p className="mt-20 text-center text-sm text-slate-500">No grouped usage data available.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="mt-2 h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
            <XAxis type="number" tick={{ fill: "#475569", fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="label"
              width={100}
              tick={{ fill: "#475569", fontSize: 11 }}
            />
            <Tooltip />
            <Bar dataKey="usage" fill="#0891b2" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
