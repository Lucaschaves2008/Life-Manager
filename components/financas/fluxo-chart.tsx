"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisProps, chart } from "@/components/charts/theme";
import { ChartTooltip } from "@/components/charts/tooltip";
import type { FluxoMes } from "@/lib/data/financas";
import { formatBRL, formatBRLCompact } from "@/lib/money";

/** Receita × despesa por mês + linha de saldo. */
export function FluxoChart({ data }: { data: FluxoMes[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal vertical={false} stroke={chart.grid} />
          <XAxis dataKey="label" {...axisProps} className="capitalize" />
          <YAxis
            {...axisProps}
            width={54}
            tickCount={4}
            tickFormatter={(v: number) => formatBRLCompact(v)}
          />
          <Tooltip
            cursor={{ fill: "rgba(143,169,205,.05)" }}
            content={({ active, payload, label }) => (
              <ChartTooltip
                active={active}
                label={String(label)}
                rows={[
                  {
                    cor: chart.mint,
                    nome: "Receita",
                    valor: formatBRL(
                      (payload?.[0]?.payload as FluxoMes | undefined)?.receita ?? 0
                    ),
                  },
                  {
                    cor: chart.coral,
                    nome: "Despesa",
                    valor: formatBRL(
                      (payload?.[0]?.payload as FluxoMes | undefined)?.despesa ?? 0
                    ),
                  },
                  {
                    cor: chart.mist,
                    nome: "Saldo",
                    valor: formatBRL(
                      (payload?.[0]?.payload as FluxoMes | undefined)?.saldo ?? 0
                    ),
                  },
                ]}
              />
            )}
          />
          <Bar
            dataKey="receita"
            fill={chart.mint}
            radius={[6, 6, 0, 0]}
            maxBarSize={18}
            animationDuration={chart.animMs}
          />
          <Bar
            dataKey="despesa"
            fill="rgba(255,107,107,.55)"
            radius={[6, 6, 0, 0]}
            maxBarSize={18}
            animationDuration={chart.animMs}
          />
          <Line
            type="monotone"
            dataKey="saldo"
            stroke={chart.mist}
            strokeWidth={1.5}
            dot={false}
            animationDuration={chart.animMs}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
