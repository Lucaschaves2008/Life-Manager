"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CardLabel } from "@/components/caverna/card";
import { MoneyInput } from "@/components/caverna/money-input";
import { Segmented } from "@/components/caverna/segmented";
import { axisProps, chart } from "@/components/charts/theme";
import { ChartTooltip } from "@/components/charts/tooltip";
import { Input, Label } from "@/components/ui/input";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatBRL, formatBRLCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

type Cadencia = "mensal" | "trimestral" | "semestral";

const MESES_POR_CADENCIA: Record<Cadencia, number> = {
  mensal: 1,
  trimestral: 3,
  semestral: 6,
};

type PontoSimulacao = {
  mes: number;
  label: string;
  aportado: number;
  total: number;
  rendimento: number;
};

function simular({
  aporteInicial,
  taxaAnualPct,
  anos,
  aumentoPct,
  cadencia,
}: {
  aporteInicial: number;
  taxaAnualPct: number;
  anos: number;
  aumentoPct: number;
  cadencia: Cadencia;
}): PontoSimulacao[] {
  const totalMeses = Math.round(anos * 12);
  if (totalMeses <= 0 || aporteInicial <= 0) return [];

  const taxaMensal = Math.pow(1 + taxaAnualPct / 100, 1 / 12) - 1;
  const passo = MESES_POR_CADENCIA[cadencia];

  const pontos: PontoSimulacao[] = [];
  let saldo = 0;
  let aportado = 0;
  let aporteAtual = aporteInicial;

  for (let mes = 1; mes <= totalMeses; mes++) {
    // reajusta o aporte a cada N meses (a partir do 2º período)
    if (mes > 1 && (mes - 1) % passo === 0) {
      aporteAtual = aporteAtual * (1 + aumentoPct / 100);
    }

    saldo = saldo * (1 + taxaMensal) + aporteAtual;
    aportado += aporteAtual;

    const ano = Math.ceil(mes / 12);
    const mesNoAno = ((mes - 1) % 12) + 1;
    pontos.push({
      mes,
      label: mes % 12 === 0 || mes === totalMeses ? `${ano}a` : `${ano}a${mesNoAno}m`,
      aportado: Math.round(aportado),
      total: Math.round(saldo),
      rendimento: Math.round(saldo - aportado),
    });
  }

  return pontos;
}

/** Amostra pontos anuais para o gráfico (evita poluir com 1 ponto por mês em prazos longos). */
function amostrarAnual(pontos: PontoSimulacao[]): PontoSimulacao[] {
  const anuais = pontos.filter((p) => p.mes % 12 === 0);
  const ultimo = pontos[pontos.length - 1];
  if (ultimo && anuais[anuais.length - 1]?.mes !== ultimo.mes) {
    anuais.push(ultimo);
  }
  return anuais;
}

export function CalculadoraClient() {
  const [aporte, setAporte] = useState(50000); // R$ 500,00 em centavos
  const [taxaAnual, setTaxaAnual] = useState("15");
  const [anos, setAnos] = useState("10");
  const [aumento, setAumento] = useState("1");
  const [cadencia, setCadencia] = useState<Cadencia>("mensal");

  useEffect(() => {
    const saved = localStorage.getItem("calc-aumento");
    if (saved) setAumento(saved);
  }, []);

  const handleAumentoChange = (value: string) => {
    setAumento(value);
    localStorage.setItem("calc-aumento", value);
  };

  const pontos = useMemo(
    () =>
      simular({
        aporteInicial: aporte,
        taxaAnualPct: parseFloat(taxaAnual.replace(",", ".")) || 0,
        anos: parseFloat(anos.replace(",", ".")) || 0,
        aumentoPct: parseFloat(aumento.replace(",", ".")) || 0,
        cadencia,
      }),
    [aporte, taxaAnual, anos, aumento, cadencia]
  );

  const resultado = pontos[pontos.length - 1];
  const serie = useMemo(() => amostrarAnual(pontos), [pontos]);

  const resumoPorAno = useMemo(() => {
    const totalAnos = Math.round(parseFloat(anos.replace(",", ".")) || 0);
    return Array.from({ length: totalAnos }, (_, i) => {
      const anoAlvo = i + 1;
      const ultimoDoAno =
        [...pontos].reverse().find((p) => Math.ceil(p.mes / 12) === anoAlvo) ??
        pontos[pontos.length - 1];
      return ultimoDoAno ? { ano: anoAlvo, ...ultimoDoAno } : null;
    }).filter((x): x is PontoSimulacao & { ano: number } => x !== null);
  }, [pontos, anos]);

  return (
    <>
      <CardLabel>Calculadora de rendimentos</CardLabel>
      <p className="mt-1.5 text-[13px] text-mist">
        Simule quanto você teria aplicando um valor por mês, com aumento periódico do
        aporte, sem contar dividendos reinvestidos automaticamente.
      </p>

      <div className="mt-5 grid grid-cols-12 gap-4">
        <div className="col-span-6 lg:col-span-3">
          <Label>Aporte inicial (mês 1)</Label>
          <MoneyInput value={aporte} onChange={setAporte} />
        </div>

        <div className="col-span-6 lg:col-span-3">
          <Label>Rendimento ao ano (%)</Label>
          <Input
            inputMode="decimal"
            value={taxaAnual}
            onChange={(e) => setTaxaAnual(e.target.value)}
            placeholder="15"
            className="tabular"
          />
        </div>

        <div className="col-span-6 lg:col-span-3">
          <Label>Prazo (anos)</Label>
          <Input
            inputMode="decimal"
            value={anos}
            onChange={(e) => setAnos(e.target.value)}
            placeholder="10"
            className="tabular"
          />
        </div>

        <div className="col-span-6 lg:col-span-3">
          <Label>Aumento do aporte (%)</Label>
          <Input
            inputMode="decimal"
            value={aumento}
            onChange={(e) => handleAumentoChange(e.target.value)}
            placeholder="1"
            className="tabular"
          />
        </div>

        <div className="col-span-12">
          <Label>Aumentar o aporte a cada</Label>
          <Segmented
            options={[
              { label: "Mês", value: "mensal" },
              { label: "Trimestre", value: "trimestral" },
              { label: "Semestre", value: "semestral" },
            ]}
            value={cadencia}
            onChange={setCadencia}
          />
        </div>
      </div>

      {resultado ? (
        <>
          <div className="mt-6 grid grid-cols-12 gap-4">
            <div className="col-span-12 rounded-[16px] border border-[rgba(13,110,253,.25)] bg-mint-soft p-5 lg:col-span-4">
              <p className="microlabel">Total acumulado</p>
              <p className="tabular mt-2 text-[24px] font-semibold leading-none text-paper">
                {formatBRL(resultado.total)}
              </p>
            </div>
            <div className="col-span-6 rounded-[16px] border border-stroke bg-surface-2 p-5 lg:col-span-4">
              <p className="microlabel">Total aportado</p>
              <p className="tabular mt-2 text-[24px] font-semibold leading-none text-ice">
                {formatBRL(resultado.aportado)}
              </p>
            </div>
            <div className="col-span-6 rounded-[16px] border border-stroke bg-surface-2 p-5 lg:col-span-4">
              <p className="microlabel">Rendimento total</p>
              <p className="tabular mt-2 text-[24px] font-semibold leading-none text-mint">
                {formatBRL(resultado.rendimento)}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="flex items-center gap-1.5 text-[11.5px] text-mist">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: chart.mint }} />
              Total acumulado
            </span>
            <span className="flex items-center gap-1.5 text-[11.5px] text-mist">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: "transparent", border: `1.5px dashed ${chart.steel}` }}
              />
              Aportado
            </span>
          </div>

          <div className="mt-3" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="calcTotalFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chart.mint} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={chart.mint} stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                      rows={[
                        {
                          cor: chart.mint,
                          nome: "Total acumulado",
                          valor: formatBRL(
                            (payload ?? []).find((p) => p.dataKey === "total")
                              ?.value as number ?? 0
                          ),
                        },
                        {
                          cor: chart.steel,
                          nome: "Aportado",
                          dashed: true,
                          valor: formatBRL(
                            (payload ?? []).find((p) => p.dataKey === "aportado")
                              ?.value as number ?? 0
                          ),
                        },
                      ]}
                    />
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke={chart.mint}
                  strokeWidth={2}
                  fill="url(#calcTotalFill)"
                  dot={false}
                  activeDot={{ r: 4, fill: chart.mint, strokeWidth: 0 }}
                  animationDuration={chart.animMs}
                  animationEasing="ease-out"
                />
                <Area
                  type="monotone"
                  dataKey="aportado"
                  stroke={chart.steel}
                  strokeWidth={1.75}
                  strokeOpacity={0.7}
                  strokeDasharray="5 4"
                  fill="transparent"
                  dot={false}
                  activeDot={{ r: 4, fill: chart.steel, strokeWidth: 0 }}
                  animationDuration={chart.animMs}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {resumoPorAno.length > 0 && (
            <div className="mt-6">
              <p className="microlabel mb-2">Evolução por ano</p>
              <Table>
                <THead>
                  <Th>Ano</Th>
                  <Th right>Aportado</Th>
                  <Th right>Rendimento</Th>
                  <Th right>Total</Th>
                </THead>
                <tbody>
                  {resumoPorAno.map((r) => (
                    <Tr key={r.ano}>
                      <Td>{r.ano}º ano</Td>
                      <Td right>{formatBRL(r.aportado)}</Td>
                      <Td right className={cn("text-mint")}>
                        {formatBRL(r.rendimento)}
                      </Td>
                      <Td right className="font-medium">
                        {formatBRL(r.total)}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </>
      ) : (
        <p className="mt-6 text-[13px] text-mist">
          Preencha os campos acima para simular o resultado.
        </p>
      )}
    </>
  );
}
