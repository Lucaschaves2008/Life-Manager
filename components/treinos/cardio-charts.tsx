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
import {
  MODALIDADE,
  formatRitmoBruto,
  paraUnidade,
  type ModalidadeCardio,
} from "@/lib/data/treinos-format";

export type PacePonto = { label: string; pace: number };

/**
 * Ritmo ao longo do tempo. Em corrida e natação o eixo Y é INVERTIDO (menos
 * tempo por km/100m é melhor); em ciclismo o valor é km/h, então mais alto é
 * melhor e o eixo segue normal.
 */
export function PaceChart({
  data,
  modalidade,
}: {
  data: PacePonto[];
  modalidade: ModalidadeCardio;
}) {
  const cfg = MODALIDADE[modalidade];
  const menorEhMelhor = modalidade !== "ciclismo";
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal vertical={false} stroke={chart.grid} />
          <XAxis dataKey="label" {...axisProps} minTickGap={20} />
          <YAxis
            {...axisProps}
            width={62}
            reversed={menorEhMelhor}
            domain={
              menorEhMelhor
                ? ["dataMin - 20", "dataMax + 20"]
                : ["dataMin - 2", "dataMax + 2"]
            }
            tickFormatter={(v: number) =>
              formatRitmoBruto(v, modalidade).replace(cfg.ritmoSufixo, "").trim()
            }
          />
          <Tooltip
            cursor={{ stroke: chart.stroke, strokeWidth: 1 }}
            content={({ active, payload, label }) => (
              <ChartTooltip
                active={active}
                label={String(label)}
                rows={(payload ?? []).map((p) => ({
                  cor: chart.mint,
                  nome: cfg.ritmoLabel,
                  valor: formatRitmoBruto(p.value as number, modalidade),
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

/**
 * Volume por período (semana, mês ou ano): período atual em destaque, demais em
 * surface-2. Os dados chegam sempre em km e são convertidos para a unidade da
 * modalidade aqui, para o eixo e o tooltip falarem a mesma língua da aba.
 */
export function VolumeChart({
  data,
  modalidade,
  rotulo = "Volume",
  barra = 26,
}: {
  data: VolumePonto[];
  modalidade: ModalidadeCardio;
  /** Nome da série no tooltip ("Volume" na semana, "Distância" no período). */
  rotulo?: string;
  barra?: number;
}) {
  const cfg = MODALIDADE[modalidade];
  const pontos = data.map((d) => ({ ...d, valor: paraUnidade(d.km, modalidade) }));
  const formatar = (v: number) =>
    `${v.toLocaleString("pt-BR", { maximumFractionDigits: cfg.unidade === "m" ? 0 : 1 })} ${cfg.unidade}`;

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={pontos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal vertical={false} stroke={chart.grid} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis
            {...axisProps}
            width={cfg.unidade === "m" ? 52 : 38}
            tickCount={4}
            tickFormatter={formatar}
          />
          <Tooltip
            cursor={{ fill: "rgba(143,169,205,.05)" }}
            content={({ active, payload, label }) => (
              <ChartTooltip
                active={active}
                label={String(label)}
                rows={(payload ?? []).map((p) => ({
                  cor: chart.mint,
                  nome: rotulo,
                  valor: formatar(Number(p.value)),
                }))}
              />
            )}
          />
          <Bar
            dataKey="valor"
            radius={[6, 6, 0, 0]}
            maxBarSize={barra}
            animationDuration={chart.animMs}
          >
            {pontos.map((d) => (
              <Cell key={d.label} fill={d.atual ? chart.mint : chart.surface2} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type PeriodoPonto = VolumePonto;
