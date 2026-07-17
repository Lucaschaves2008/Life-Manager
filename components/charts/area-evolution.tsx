"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisProps, chart } from "@/components/charts/theme";
import { ChartTooltip } from "@/components/charts/tooltip";

export type AreaPoint = {
  label: string;
  valor: number;
  /** ponto marcado (ex.: aporte no mês) */
  marcado?: boolean;
};

/**
 * Gráfico de área com gradiente vertical (acento 25% → transparente).
 * Usado em evolução patrimonial, peso, etc.
 */
export function AreaEvolution({
  data,
  cor = chart.mint,
  height = 240,
  formatValue,
  nome = "Valor",
}: {
  data: AreaPoint[];
  cor?: string;
  height?: number;
  formatValue: (v: number) => string;
  nome?: string;
}) {
  const gradId = `grad-${cor.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity={0.25} />
              <stop offset="100%" stopColor={cor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid horizontal vertical={false} stroke={chart.grid} />
          <XAxis dataKey="label" {...axisProps} minTickGap={24} />
          <YAxis
            {...axisProps}
            width={58}
            tickFormatter={(v: number) => formatValue(v)}
            tickCount={4}
            domain={["auto", "auto"]}
          />
          <Tooltip
            cursor={{ stroke: chart.stroke, strokeWidth: 1 }}
            content={({ active, payload, label }) => (
              <ChartTooltip
                active={active}
                label={String(label)}
                rows={(payload ?? []).map((p) => ({
                  cor,
                  nome,
                  valor: formatValue(p.value as number),
                }))}
              />
            )}
          />
          <Area
            type="monotone"
            dataKey="valor"
            stroke={cor}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={(props) => {
              const { key, cx, cy, payload } = props as {
                key?: string;
                cx?: number;
                cy?: number;
                payload?: AreaPoint;
              };
              if (!payload?.marcado || cx == null || cy == null)
                return <g key={key} />;
              return (
                <circle key={key} cx={cx} cy={cy} r={3} fill={cor} stroke="none" />
              );
            }}
            activeDot={{ r: 4, fill: cor, strokeWidth: 0 }}
            animationDuration={chart.animMs}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
