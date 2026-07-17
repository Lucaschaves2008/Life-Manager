"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Plus, Scale, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/caverna/empty-state";
import { axisProps, chart } from "@/components/charts/theme";
import { ChartTooltip } from "@/components/charts/tooltip";
import { createPeso, deletePeso, restorePeso } from "@/app/actions/dieta";
import type { PesoPonto } from "@/lib/data/dieta";

export type RegistroPeso = {
  id: string;
  data: string;
  dataLabel: string;
  pesoKg: number;
  cintura: number | null;
  braco: number | null;
};

const kg = (v: number) =>
  `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;

export function PesoChart({ pontos }: { pontos: PesoPonto[] }) {
  if (pontos.length < 2) {
    return (
      <EmptyState
        icon={Scale}
        title="Registre ao menos dois pesos para ver a evolução."
      />
    );
  }

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pontos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal vertical={false} stroke={chart.grid} />
          <XAxis dataKey="label" {...axisProps} minTickGap={24} />
          <YAxis
            {...axisProps}
            width={46}
            domain={["dataMin - 1", "dataMax + 1"]}
            tickFormatter={(v: number) => `${v}`}
          />
          <Tooltip
            cursor={{ stroke: chart.stroke, strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              const ponto = payload?.[0]?.payload as PesoPonto | undefined;
              return (
                <ChartTooltip
                  active={active}
                  label={String(label)}
                  rows={[
                    { cor: chart.mint, nome: "Peso", valor: kg(ponto?.peso ?? 0) },
                    ...(ponto?.media7 != null
                      ? [
                          {
                            cor: chart.steel,
                            nome: "Média 7d",
                            valor: kg(ponto.media7),
                            dashed: true,
                          },
                        ]
                      : []),
                  ]}
                />
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="peso"
            stroke={chart.mint}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: chart.mint, strokeWidth: 0 }}
            animationDuration={chart.animMs}
          />
          <Line
            type="monotone"
            dataKey="media7"
            stroke={chart.steel}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            animationDuration={chart.animMs}
          />
          <Line
            type="monotone"
            dataKey="meta"
            stroke={chart.mint}
            strokeWidth={1}
            strokeDasharray="2 4"
            dot={false}
            animationDuration={0}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PesoClient({
  registros,
  hoje,
}: {
  registros: RegistroPeso[];
  hoje: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [pending, startSalvar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState(hoje);
  const [peso, setPeso] = useState("");
  const [cintura, setCintura] = useState("");
  const [braco, setBraco] = useState("");

  const abrirNovo = params.get("novo") === "1";
  useEffect(() => {
    if (abrirNovo) setAberto(true);
  }, [abrirNovo]);

  function fechar(v: boolean) {
    setAberto(v);
    if (!v && abrirNovo) {
      const next = new URLSearchParams(params.toString());
      next.delete("novo");
      router.replace(`/dieta?${next.toString()}`);
    }
  }

  const pesoNum = Number(peso.replace(",", ".")) || 0;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="microlabel">Registros</p>
        <Button variant="primary" size="sm" onClick={() => setAberto(true)}>
          <Plus className="h-4 w-4" strokeWidth={2} />
          Registrar peso
        </Button>
      </div>

      <div className="mt-4">
        {registros.length === 0 ? (
          <EmptyState icon={Scale} title="Nenhum peso registrado." className="py-14" />
        ) : (
          <Table>
            <THead>
              <Th>Data</Th>
              <Th right>Peso</Th>
              <Th right>Cintura</Th>
              <Th right>Braço</Th>
              <Th right> </Th>
            </THead>
            <tbody>
              {registros.map((r) => (
                <Tr key={r.id}>
                  <Td className="tabular text-mist">{r.dataLabel}</Td>
                  <Td right>{kg(r.pesoKg)}</Td>
                  <Td right className="text-mist">
                    {r.cintura ? `${r.cintura} cm` : "—"}
                  </Td>
                  <Td right className="text-mist">
                    {r.braco ? `${r.braco} cm` : "—"}
                  </Td>
                  <Td right>
                    <button
                      aria-label="Excluir registro"
                      onClick={() =>
                        startTransition(async () => {
                          const removido = await deletePeso(r.id);
                          if (!removido) return;
                          toast("Registro excluído", {
                            action: {
                              label: "Desfazer",
                              onClick: () =>
                                restorePeso({
                                  data: removido.data,
                                  pesoKg: removido.pesoKg,
                                  cintura: removido.cintura,
                                  braco: removido.braco,
                                }),
                            },
                          });
                        })
                      }
                      className="rounded-md p-1 text-steel transition-colors hover:text-coral"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <Dialog open={aberto} onOpenChange={fechar}>
        <DialogContent aria-describedby={undefined} className="w-[min(440px,94vw)]">
          <DialogTitle>Registrar peso</DialogTitle>
          <div className="mt-5 flex flex-col gap-4">
            <div>
              <Label htmlFor="peso-data">Data</Label>
              <Input
                id="peso-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="tabular"
              />
            </div>
            <div>
              <Label htmlFor="peso-kg">Peso (kg)</Label>
              <Input
                id="peso-kg"
                inputMode="decimal"
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                placeholder="81,4"
                className="tabular"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="peso-cintura">Cintura (cm)</Label>
                <Input
                  id="peso-cintura"
                  inputMode="decimal"
                  value={cintura}
                  onChange={(e) => setCintura(e.target.value)}
                  className="tabular"
                />
              </div>
              <div>
                <Label htmlFor="peso-braco">Braço (cm)</Label>
                <Input
                  id="peso-braco"
                  inputMode="decimal"
                  value={braco}
                  onChange={(e) => setBraco(e.target.value)}
                  className="tabular"
                />
              </div>
            </div>
            <div className="mt-1 flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                disabled={pesoNum <= 0 || pending}
                onClick={() =>
                  startSalvar(async () => {
                    await createPeso({
                      data,
                      pesoKg: pesoNum,
                      cintura: Number(cintura.replace(",", ".")) || null,
                      braco: Number(braco.replace(",", ".")) || null,
                    });
                    toast.success("Peso registrado");
                    setPeso("");
                    setCintura("");
                    setBraco("");
                    fechar(false);
                  })
                }
              >
                {pending ? "Salvando…" : "Salvar"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => fechar(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
