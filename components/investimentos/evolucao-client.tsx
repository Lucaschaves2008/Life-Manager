"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Segmented } from "@/components/caverna/segmented";
import { axisProps, chart } from "@/components/charts/theme";
import { ChartTooltip } from "@/components/charts/tooltip";
import { formatBRL, formatBRLCompact } from "@/lib/money";

type Periodo = "mes" | "ano" | "total";

export type EvolucaoPonto = {
  label: string;
  valor: number;
  aportado: number;
  dividendos: number;
  marcado?: boolean;
};

const linhas = [
  { key: "valor", nome: "Valor atual", cor: chart.mint, dashed: false },
  { key: "aportado", nome: "Guardado", cor: chart.steel, dashed: true },
  { key: "dividendos", nome: "Dividendos", cor: chart.amber, dashed: false },
] as const;

/** Evolução patrimonial: valor atual, guardado (principal) e dividendos. */
export function EvolucaoClient({
  series,
}: {
  series: Record<Periodo, EvolucaoPonto[]>;
}) {
  const [periodo, setPeriodo] = useState<Periodo>("ano");
  const data = series[periodo];

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <p className="microlabel">Evolução do patrimônio</p>
        <Segmented
          options={[
            { label: "6 meses", value: "mes" },
            { label: "1 ano", value: "ano" },
            { label: "Total", value: "total" },
          ]}
          value={periodo}
          onChange={setPeriodo}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {linhas.map((l) => (
          <span key={l.key} className="flex items-center gap-1.5 text-[11.5px] text-mist">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{
                background: l.dashed ? "transparent" : l.cor,
                border: l.dashed ? `1.5px dashed ${l.cor}` : undefined,
              }}
            />
            {l.nome}
          </span>
        ))}
      </div>

      <div className="mt-4" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid horizontal vertical={false} stroke={chart.grid} />
            <XAxis dataKey="label" {...axisProps} minTickGap={24} />
            <YAxis
              {...axisProps}
              width={58}
              tickFormatter={(v: number) => formatBRLCompact(v)}
              tickCount={4}
              domain={["auto", "auto"]}
            />
            <Tooltip
              cursor={{ stroke: chart.stroke, strokeWidth: 1 }}
              content={({ active, payload, label }) => (
                <ChartTooltip
                  active={active}
                  label={String(label)}
                  rows={linhas.map((l) => {
                    const p = (payload ?? []).find((x) => x.dataKey === l.key);
                    return {
                      cor: l.cor,
                      nome: l.nome,
                      dashed: l.dashed,
                      valor: formatBRL((p?.value as number) ?? 0),
                    };
                  })}
                />
              )}
            />
            {linhas.map((l) => (
              <Line
                key={l.key}
                type="monotone"
                dataKey={l.key}
                stroke={l.cor}
                strokeWidth={l.key === "valor" ? 2 : 1.75}
                strokeOpacity={l.dashed ? 0.7 : 1}
                strokeDasharray={l.dashed ? "5 4" : undefined}
                dot={false}
                activeDot={{ r: 4, fill: l.cor, strokeWidth: 0 }}
                animationDuration={chart.animMs}
                animationEasing="ease-out"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
