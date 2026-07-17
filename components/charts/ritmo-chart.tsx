"use client";

import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chart, axisProps } from "@/components/charts/theme";
import { ChartTooltip } from "@/components/charts/tooltip";
import { formatBRL, formatBRLCompact } from "@/lib/money";

export type RitmoPoint = {
  dia: number;
  atual: number | null; // acumulado do mês atual (centavos)
  anterior: number | null; // acumulado do mês anterior (centavos)
  projecao: number | null; // projeção pontilhada até o fim do mês
};

/**
 * Gráfico do "Ritmo de gastos" (3.5.2):
 * mês atual sólido (coral se acima do anterior, menta se abaixo),
 * mês anterior tracejado steel a 50%, projeção pontilhada.
 */
export function RitmoChart({
  data,
  acima,
  height = 220,
  compact = false,
}: {
  data: RitmoPoint[];
  acima: boolean;
  height?: number;
  compact?: boolean;
}) {
  const corAtual = acima ? chart.coral : chart.mint;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: compact ? -14 : 0 }}
        >
          <CartesianGrid
            horizontal
            vertical={false}
            stroke={chart.grid}
            strokeWidth={1}
          />
          <XAxis
            dataKey="dia"
            {...axisProps}
            interval="preserveStartEnd"
            tickFormatter={(d: number) => String(d).padStart(2, "0")}
            minTickGap={28}
          />
          <YAxis
            {...axisProps}
            width={compact ? 46 : 56}
            tickFormatter={(v: number) => formatBRLCompact(v)}
            tickCount={4}
          />
          <Tooltip
            cursor={{ stroke: chart.stroke, strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              const rows = (payload ?? [])
                .filter((p) => p.value != null && p.dataKey !== "projecao")
                .map((p) => ({
                  cor: p.dataKey === "atual" ? corAtual : chart.steel,
                  nome: p.dataKey === "atual" ? "Este mês" : "Mês anterior",
                  valor: formatBRL(p.value as number),
                  dashed: p.dataKey === "anterior",
                }));
              return (
                <ChartTooltip
                  active={active}
                  label={`Dia ${String(label).padStart(2, "0")}`}
                  rows={rows}
                />
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="anterior"
            stroke={chart.steel}
            strokeOpacity={0.5}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 3, fill: chart.steel, strokeWidth: 0 }}
            animationDuration={chart.animMs}
            animationEasing="ease-out"
          />
          <Line
            type="monotone"
            dataKey="atual"
            stroke={corAtual}
            strokeWidth={2}
            dot={(props) => {
              // ponto só no último valor real
              const { key, cx, cy, index } = props as {
                key?: string;
                cx?: number;
                cy?: number;
                index?: number;
              };
              const lastIdx = data.reduce(
                (acc, p, i) => (p.atual != null ? i : acc),
                -1
              );
              if (index !== lastIdx || cx == null || cy == null)
                return <g key={key} />;
              return (
                <circle
                  key={key}
                  cx={cx}
                  cy={cy}
                  r={3.5}
                  fill={corAtual}
                  stroke="none"
                />
              );
            }}
            activeDot={{ r: 4, fill: corAtual, strokeWidth: 0 }}
            animationDuration={chart.animMs}
            animationEasing="ease-out"
          />
          <Line
            type="monotone"
            dataKey="projecao"
            stroke={corAtual}
            strokeOpacity={0.45}
            strokeWidth={1.5}
            strokeDasharray="2 5"
            dot={false}
            activeDot={false}
            animationDuration={chart.animMs}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
