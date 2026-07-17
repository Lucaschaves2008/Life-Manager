"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisProps, chart } from "@/components/charts/theme";
import { ChartTooltip } from "@/components/charts/tooltip";
import type { DiaEstudo } from "@/lib/data/estudos";

function rotulo(horas: number): string {
  const total = Math.round(horas * 3600);
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  return `${m}min`;
}

/** Horas líquidas por dia (últimos 14 dias); último dia em destaque. */
export function HorasChart({ data }: { data: DiaEstudo[] }) {
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal vertical={false} stroke={chart.grid} />
          <XAxis dataKey="label" {...axisProps} interval={0} />
          <YAxis
            {...axisProps}
            width={34}
            tickCount={4}
            allowDecimals={false}
            tickFormatter={(v: number) => `${v}h`}
          />
          <Tooltip
            cursor={{ fill: "var(--color-surface-2)", opacity: 0.4 }}
            content={({ active, payload }) => {
              const p = payload?.[0];
              return (
                <ChartTooltip
                  active={active}
                  label={p ? (p.payload as DiaEstudo).dia : ""}
                  rows={
                    p
                      ? [
                          {
                            cor: chart.mint,
                            nome: "Estudado",
                            valor: rotulo(p.value as number),
                          },
                        ]
                      : []
                  }
                />
              );
            }}
          />
          <Bar dataKey="horas" radius={6} animationDuration={chart.animMs}>
            {data.map((d, i) => (
              <Cell
                key={d.dia}
                fill={i === data.length - 1 ? chart.mint : chart.surface2}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
