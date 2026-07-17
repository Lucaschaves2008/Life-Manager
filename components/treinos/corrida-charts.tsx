"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisProps, chart } from "@/components/charts/theme";
import { ChartTooltip } from "@/components/charts/tooltip";
import { formatPace } from "@/lib/data/treinos";

export type PacePonto = { label: string; pace: number };

/** Pace ao longo do tempo — eixo Y invertido (pace menor é melhor). */
export function PaceChart({ data }: { data: PacePonto[] }) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal vertical={false} stroke={chart.grid} />
          <XAxis dataKey="label" {...axisProps} minTickGap={20} />
          <YAxis
            {...axisProps}
            width={62}
            reversed
            domain={["dataMin - 20", "dataMax + 20"]}
            tickFormatter={(v: number) => formatPace(v).replace("/km", "")}
          />
          <Tooltip
            cursor={{ stroke: chart.stroke, strokeWidth: 1 }}
            content={({ active, payload, label }) => (
              <ChartTooltip
                active={active}
                label={String(label)}
                rows={(payload ?? []).map((p) => ({
                  cor: chart.mint,
                  nome: "Pace",
                  valor: formatPace(p.value as number),
                }))}
              />
            )}
          />
          <Line
            type="monotone"
            dataKey="pace"
            stroke={chart.mint}
            strokeWidth={2}
            dot={{ r: 2.5, fill: chart.mint, strokeWidth: 0 }}
            activeDot={{ r: 4, fill: chart.mint, strokeWidth: 0 }}
            animationDuration={chart.animMs}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export type VolumePonto = { label: string; km: number; atual: boolean };

/** Volume semanal: semana atual em destaque, demais em surface-2. */
export function VolumeChart({ data }: { data: VolumePonto[] }) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal vertical={false} stroke={chart.grid} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis
            {...axisProps}
            width={38}
            tickCount={4}
            tickFormatter={(v: number) => `${v} km`}
          />
          <Tooltip
            cursor={{ fill: "rgba(143,169,205,.05)" }}
            content={({ active, payload, label }) => (
              <ChartTooltip
                active={active}
                label={`Semana de ${label}`}
                rows={(payload ?? []).map((p) => ({
                  cor: chart.mint,
                  nome: "Volume",
                  valor: `${Number(p.value).toLocaleString("pt-BR", {
                    maximumFractionDigits: 1,
                  })} km`,
                }))}
              />
            )}
          />
          <Bar dataKey="km" radius={[6, 6, 0, 0]} maxBarSize={26} animationDuration={chart.animMs}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.atual ? chart.mint : chart.surface2} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
