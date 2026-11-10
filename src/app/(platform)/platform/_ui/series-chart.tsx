"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// One series per chart, bars per day.
export function SeriesChart({
  data,
  dataKey,
  label,
  color = "var(--color-brand-blue)",
}: {
  data: { day: string; [k: string]: string | number }[];
  dataKey: string;
  label: string;
  color?: string;
}) {
  const rows = data.map((d) => ({ ...d, label: d.day.slice(5) }));
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={12} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: "var(--color-canvas)" }}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "var(--color-line)" }}
            formatter={(v) => [v, label]}
          />
          <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
