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
import { formatHoras } from "@/lib/data/estudos-format";
import type { SemanaEstudo } from "@/lib/data/estudos";

/** Horas líquidas por semana (12 semanas); a semana corrente em destaque. */
export function SemanasChart({ data, cor }: { data: SemanaEstudo[]; cor: string }) {
  // com semanas curtas (< 2h) o eixo em horas inteiras achata as barras até
  // sumirem; aí o eixo passa a ser em minutos
  const pico = Math.max(...data.map((d) => d.horas), 0);
  const emMinutos = pico > 0 && pico < 2;

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal vertical={false} stroke={chart.grid} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
          <YAxis
            {...axisProps}
            width={38}
            tickCount={4}
            allowDecimals={emMinutos}
            tickFormatter={(v: number) =>
              emMinutos ? `${Math.round(v * 60)}min` : `${v}h`
            }
          />
          <Tooltip
            cursor={{ fill: "var(--color-surface-2)", opacity: 0.4 }}
            content={({ active, payload }) => {
              const p = payload?.[0];
              return (
                <ChartTooltip
                  active={active}
                  label={p ? `semana de ${(p.payload as SemanaEstudo).label}` : ""}
                  rows={
                    p
                      ? [
                          {
                            cor,
                            nome: "Estudado",
                            valor: formatHoras(Math.round((p.value as number) * 3600)),
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
              <Cell key={d.key} fill={i === data.length - 1 ? cor : chart.surface2} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
