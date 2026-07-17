"use client";

import { useState, useTransition } from "react";
import { Copy, Pencil, Plus, Power, Salad, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/table";
import { Card, CardLabel } from "@/components/caverna/card";
import { DotsMenu } from "@/components/caverna/dots-menu";
import { EmptyState } from "@/components/caverna/empty-state";
import {
  addItem,
  ativarDieta,
  createDieta,
  createRefeicao,
  deleteDieta,
  deleteItem,
  deleteRefeicao,
  duplicarDieta,
  updateDieta,
  type DietaInput,
} from "@/app/actions/dieta";
import type { Macros } from "@/lib/data/dieta";

export type RefeicaoView = {
  id: string;
  nome: string;
  horario: string | null;
  macros: Macros;
  itens: { id: string; nome: string; quantidade: number; unidade: string }[];
};

export type DietaView = {
  id: string;
  nome: string;
  ativa: boolean;
  metas: Macros;
  totais: Macros;
  refeicoes: RefeicaoView[];
};

const dietaVazia: DietaInput = {
  nome: "",
  metaKcal: 2200,
  metaProt: 160,
  metaCarb: 220,
  metaGord: 60,
};

export function PlanoClient({
  dietas,
  alimentos,
}: {
  dietas: DietaView[];
  alimentos: { id: string; nome: string; porcaoNome: string | null }[];
}) {
  const [, startTransition] = useTransition();
  const [pending, startSalvar] = useTransition();

  const [sheetDieta, setSheetDieta] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<DietaInput>(dietaVazia);

  const [detalhe, setDetalhe] = useState<DietaView | null>(null);
  const [novaRefeicao, setNovaRefeicao] = useState({ nome: "", horario: "" });
  const [novoItem, setNovoItem] = useState<{
    mealId: string;
    foodId: string;
    quantidade: string;
    unidade: string;
  } | null>(null);

  function abrirDieta(dieta: DietaView | null) {
    setEditandoId(dieta?.id ?? null);
    setForm(
      dieta
        ? {
            nome: dieta.nome,
            metaKcal: dieta.metas.kcal,
            metaProt: dieta.metas.prot,
            metaCarb: dieta.metas.carb,
            metaGord: dieta.metas.gord,
          }
        : dietaVazia
    );
    setSheetDieta(true);
  }

  function salvarDieta() {
    startSalvar(async () => {
      if (editandoId) {
        await updateDieta(editandoId, form);
        toast.success("Dieta atualizada");
      } else {
        await createDieta(form);
        toast.success("Dieta criada");
      }
      setSheetDieta(false);
    });
  }

  const metasCampos: { chave: keyof DietaInput; label: string }[] = [
    { chave: "metaKcal", label: "Kcal" },
    { chave: "metaProt", label: "Proteína (g)" },
    { chave: "metaCarb", label: "Carbo (g)" },
    { chave: "metaGord", label: "Gordura (g)" },
  ];

  return (
    <>
      {dietas.length === 0 ? (
        <Card>
          <EmptyState
            icon={Salad}
            title="Nenhuma dieta montada ainda."
            className="py-16"
            action={
              <Button variant="dashed" size="sm" onClick={() => abrirDieta(null)}>
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Criar dieta
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="stagger grid grid-cols-12 gap-6">
          {dietas.map((dieta) => (
            <Card
              key={dieta.id}
              destaque={dieta.ativa}
              className="col-span-12 lg:col-span-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardLabel>
                    {dieta.refeicoes.length}{" "}
                    {dieta.refeicoes.length === 1 ? "refeição" : "refeições"}
                  </CardLabel>
                  <p className="mt-1.5 flex items-center gap-2 text-[16px] text-paper">
                    {dieta.nome}
                    {dieta.ativa && <StatusPill tone="mint">Ativa</StatusPill>}
                  </p>
                </div>
                <DotsMenu
                  items={[
                    ...(dieta.ativa
                      ? []
                      : [
                          {
                            label: "Ativar",
                            icon: Power,
                            onSelect: () =>
                              startTransition(async () => {
                                await ativarDieta(dieta.id);
                                toast.success(`${dieta.nome} agora é a dieta ativa`);
                              }),
                          },
                        ]),
                    {
                      label: "Editar metas",
                      icon: Pencil,
                      onSelect: () => abrirDieta(dieta),
                    },
                    {
                      label: "Duplicar",
                      icon: Copy,
                      onSelect: () =>
                        startTransition(async () => {
                          await duplicarDieta(dieta.id);
                          toast.success("Dieta duplicada");
                        }),
                    },
                    {
                      label: "Excluir",
                      icon: Trash2,
                      destructive: true,
                      onSelect: () =>
                        startTransition(async () => {
                          await deleteDieta(dieta.id);
                          toast.success("Dieta excluída");
                        }),
                    },
                  ]}
                />
              </div>

              <p className="tabular mt-4 text-[13px] text-mist">
                {Math.round(dieta.totais.kcal)} kcal montadas · meta {dieta.metas.kcal}{" "}
                kcal
              </p>
              <p className="tabular mt-1 text-[11.5px] text-steel">
                P {Math.round(dieta.totais.prot)}/{dieta.metas.prot}g · C{" "}
                {Math.round(dieta.totais.carb)}/{dieta.metas.carb}g · G{" "}
                {Math.round(dieta.totais.gord)}/{dieta.metas.gord}g
              </p>

              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setDetalhe(dieta)}
              >
                Ver refeições
              </Button>
            </Card>
          ))}

          <div className="col-span-12">
            <Button variant="dashed" size="sm" onClick={() => abrirDieta(null)}>
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Criar dieta
            </Button>
          </div>
        </div>
      )}

      {/* Sheet de metas da dieta */}
      <Sheet open={sheetDieta} onOpenChange={setSheetDieta}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>{editandoId ? "Editar dieta" : "Nova dieta"}</SheetTitle>
          <div className="mt-6 flex flex-col gap-5">
            <div>
              <Label htmlFor="dieta-nome">Nome</Label>
              <Input
                id="dieta-nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Cutting julho, Manutenção…"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {metasCampos.map((campo) => (
                <div key={campo.chave}>
                  <Label htmlFor={`dieta-${campo.chave}`}>{campo.label}</Label>
                  <Input
                    id={`dieta-${campo.chave}`}
                    type="number"
                    min={0}
                    value={form[campo.chave] as number}
                    onChange={(e) =>
                      setForm({ ...form, [campo.chave]: Number(e.target.value) || 0 })
                    }
                    className="tabular"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                onClick={salvarDieta}
                disabled={!form.nome.trim() || pending}
              >
                {pending ? "Salvando…" : "Salvar"}
              </Button>
              <Button variant="ghost" onClick={() => setSheetDieta(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet de refeições da dieta */}
      <Sheet open={!!detalhe} onOpenChange={(v) => !v && setDetalhe(null)}>
        <SheetContent aria-describedby={undefined}>
          {detalhe && (
            <>
              <SheetTitle>{detalhe.nome}</SheetTitle>
              <p className="mt-1 text-[12.5px] text-steel">
                Monte as refeições e os alimentos de cada uma.
              </p>

              <div className="mt-6 flex flex-col gap-4">
                {detalhe.refeicoes.length === 0 && (
                  <p className="text-[13px] text-steel">
                    Nenhuma refeição nesta dieta ainda.
                  </p>
                )}

                {detalhe.refeicoes.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-[14px] border border-stroke bg-surface-2 p-4"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[14px] text-paper">{r.nome}</p>
                      <div className="flex items-center gap-2">
                        {r.horario && (
                          <span className="tabular text-[11.5px] text-steel">
                            {r.horario}
                          </span>
                        )}
                        <button
                          aria-label="Excluir refeição"
                          onClick={() =>
                            startTransition(async () => {
                              await deleteRefeicao(r.id);
                              setDetalhe(null);
                              toast.success("Refeição excluída");
                            })
                          }
                          className="rounded-md p-1 text-steel hover:text-coral"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                    <p className="tabular mt-0.5 text-[11.5px] text-steel">
                      {Math.round(r.macros.kcal)} kcal · P {Math.round(r.macros.prot)}g ·
                      C {Math.round(r.macros.carb)}g · G {Math.round(r.macros.gord)}g
                    </p>

                    <div className="mt-3 flex flex-col">
                      {r.itens.map((i) => (
                        <div
                          key={i.id}
                          className="group flex items-center gap-2 border-b border-stroke py-1.5 text-[12.5px] last:border-0"
                        >
                          <span className="tabular text-steel">
                            {i.quantidade.toLocaleString("pt-BR", {
                              maximumFractionDigits: 0,
                            })}
                            {i.unidade === "g" ? " g" : "×"}
                          </span>
                          <span className="flex-1 text-mist">{i.nome}</span>
                          <button
                            aria-label="Remover alimento"
                            onClick={() =>
                              startTransition(async () => {
                                await deleteItem(i.id);
                                setDetalhe(null);
                              })
                            }
                            className="rounded-md p-1 text-steel opacity-0 transition-opacity hover:text-coral group-hover:opacity-100"
                          >
                            <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {novoItem?.mealId === r.id ? (
                      <div className="mt-3 flex flex-col gap-2.5">
                        <Select
                          value={novoItem.foodId}
                          onValueChange={(v) => setNovoItem({ ...novoItem, foodId: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Escolher alimento" />
                          </SelectTrigger>
                          <SelectContent>
                            {alimentos.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Input
                            aria-label="Quantidade"
                            inputMode="decimal"
                            value={novoItem.quantidade}
                            onChange={(e) =>
                              setNovoItem({ ...novoItem, quantidade: e.target.value })
                            }
                            placeholder="120"
                            className="tabular"
                          />
                          <Select
                            value={novoItem.unidade}
                            onValueChange={(v) =>
                              setNovoItem({ ...novoItem, unidade: v })
                            }
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="g">gramas</SelectItem>
                              <SelectItem value="porcao">porções</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={
                              !novoItem.foodId || !Number(novoItem.quantidade) || pending
                            }
                            onClick={() =>
                              startSalvar(async () => {
                                await addItem(
                                  r.id,
                                  novoItem.foodId,
                                  Number(novoItem.quantidade.replace(",", ".")),
                                  novoItem.unidade
                                );
                                setNovoItem(null);
                                setDetalhe(null);
                                toast.success("Alimento adicionado");
                              })
                            }
                          >
                            Adicionar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setNovoItem(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="dashed"
                        size="sm"
                        className="mt-3 w-full"
                        onClick={() =>
                          setNovoItem({
                            mealId: r.id,
                            foodId: "",
                            quantidade: "",
                            unidade: "g",
                          })
                        }
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                        Adicionar alimento
                      </Button>
                    )}
                  </div>
                ))}

                <div className="rounded-[14px] border border-dashed border-stroke p-4">
                  <p className="microlabel">Nova refeição</p>
                  <div className="mt-3 flex gap-2">
                    <Input
                      aria-label="Nome da refeição"
                      value={novaRefeicao.nome}
                      onChange={(e) =>
                        setNovaRefeicao({ ...novaRefeicao, nome: e.target.value })
                      }
                      placeholder="Café da manhã"
                    />
                    <Input
                      aria-label="Horário"
                      value={novaRefeicao.horario}
                      onChange={(e) =>
                        setNovaRefeicao({ ...novaRefeicao, horario: e.target.value })
                      }
                      placeholder="07:30"
                      className="tabular w-24 text-center"
                    />
                  </div>
                  <Button
                    variant="soft"
                    size="sm"
                    className="mt-3"
                    disabled={!novaRefeicao.nome.trim() || pending}
                    onClick={() =>
                      startSalvar(async () => {
                        await createRefeicao(
                          detalhe.id,
                          novaRefeicao.nome,
                          novaRefeicao.horario
                        );
                        setNovaRefeicao({ nome: "", horario: "" });
                        setDetalhe(null);
                        toast.success("Refeição criada");
                      })
                    }
                  >
                    Criar refeição
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
