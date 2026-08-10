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

type DataPoint = { month: string; extended: number; recovered: number };

const EXTENDED = "#8A8F98"; // neutral — money going out is not a win or a loss
const RECOVERED = "#3FB950"; // positive — money actually collected

function formatK(v: number) {
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `₦${Math.round(v / 1_000)}K`;
  return `₦${v}`;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; fill: string }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  const extended = payload.find((p) => p.name === "extended")?.value ?? 0;
  const recovered = payload.find((p) => p.name === "recovered")?.value ?? 0;
  const rate = extended > 0 ? Math.round((recovered / extended) * 100) : null;

  return (
    <div className="rounded-xl border border-[color:var(--hairline-strong)] bg-[color:var(--surface-2)] px-3 py-2.5 shadow-[var(--elev-2)]">
      <p className="mb-2 text-[11px] font-medium text-[color:var(--text-secondary)]">
        {label}
      </p>
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-5 text-[12px]">
            <span className="flex items-center gap-1.5 text-[color:var(--text-tertiary)]">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: p.fill }}
                aria-hidden
              />
              {p.name === "extended" ? "Extended" : "Recovered"}
            </span>
            <span className="tnum text-[color:var(--text-primary)]">
              {formatK(p.value)}
            </span>
          </div>
        ))}
      </div>
      {rate !== null && (
        <p className="tnum mt-2 border-t border-[color:var(--hairline)] pt-2 text-[11px] text-[color:var(--text-tertiary)]">
          {rate}% recovered
        </p>
      )}
    </div>
  );
};

export function RevenueChart({ data }: { data: DataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} barGap={3} barCategoryGap="34%" margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="2 4"
          stroke="rgba(255,255,255,0.06)"
          vertical={false}
        />
        <XAxis
          dataKey="month"
          tick={{ fill: "rgba(242,242,239,0.40)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          dy={4}
        />
        <YAxis
          tickFormatter={formatK}
          tick={{ fill: "rgba(242,242,239,0.26)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="extended" fill={EXTENDED} radius={[3, 3, 0, 0]} name="extended" />
        <Bar dataKey="recovered" fill={RECOVERED} radius={[3, 3, 0, 0]} name="recovered" />
      </BarChart>
    </ResponsiveContainer>
  );
}
