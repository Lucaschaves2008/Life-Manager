"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GlassWater, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/caverna/empty-state";
import {
  addExtra,
  removeExtra,
  setAgua,
  setNotas,
  toggleRefeicaoCumprida,
} from "@/app/actions/dieta";
import type { DiaDaDieta, ExtraLog } from "@/lib/data/dieta";
import { cn } from "@/lib/utils";

const COPO_ML = 250;

export function RefeicoesClient({ dia }: { dia: DiaDaDieta }) {
  const [, startTransition] = useTransition();
  const [cumpridas, setCumpridas] = useState<string[]>(dia.cumpridas);

  useEffect(() => setCumpridas(dia.cumpridas), [dia.cumpridas]);

  if (dia.refeicoes.length === 0) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title="Nenhuma dieta ativa com refeições. Monte um plano alimentar primeiro."
        className="py-14"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {dia.refeicoes.map((r) => {
        const feita = cumpridas.includes(r.id);
        return (
          <div
            key={r.id}
            className={cn(
              "rounded-[14px] border px-4 py-3.5 transition-colors",
              feita ? "border-[var(--mint-border)] bg-mint-soft" : "border-stroke bg-surface-2"
            )}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                checked={feita}
                aria-label={r.nome}
                onCheckedChange={() => {
                  setCumpridas((atual) =>
                    atual.includes(r.id)
                      ? atual.filter((id) => id !== r.id)
                      : [...atual, r.id]
                  );
                  startTransition(() => void toggleRefeicaoCumprida(dia.data, r.id));
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[14px] text-paper">{r.nome}</p>
                  {r.horario && (
                    <span className="tabular text-[11.5px] text-steel">{r.horario}</span>
                  )}
                </div>
                <p className="tabular mt-0.5 text-[11.5px] text-steel">
                  {Math.round(r.macros.kcal)} kcal · P {Math.round(r.macros.prot)}g · C{" "}
                  {Math.round(r.macros.carb)}g · G {Math.round(r.macros.gord)}g
                </p>
                {r.itens.length > 0 && (
                  <p className="mt-1.5 text-[12px] text-mist">
                    {r.itens
                      .map(
                        (i) =>
                          `${i.quantidade.toLocaleString("pt-BR", {
                            maximumFractionDigits: 0,
                          })}${i.unidade === "g" ? " g" : "×"} ${i.nome}`
                      )
                      .join(" · ")}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ExtrasClient({ dia }: { dia: DiaDaDieta }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [pending, startSalvar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<ExtraLog>({
    nome: "",
    kcal: 0,
    prot: 0,
    carb: 0,
    gord: 0,
  });

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

  const campos: { chave: keyof ExtraLog; label: string }[] = [
    { chave: "kcal", label: "Kcal" },
    { chave: "prot", label: "Proteína (g)" },
    { chave: "carb", label: "Carbo (g)" },
    { chave: "gord", label: "Gordura (g)" },
  ];

  return (
    <>
      <div className="flex flex-col">
        {dia.extras.length === 0 ? (
          <p className="py-2 text-[13px] text-steel">
            Nada fora do plano hoje.
          </p>
        ) : (
          dia.extras.map((extra, i) => (
            <div
              key={`${extra.nome}-${i}`}
              className="group flex items-center gap-3 border-b border-stroke py-2.5 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-ice">{extra.nome}</p>
                <p className="tabular text-[11.5px] text-steel">
                  P {extra.prot}g · C {extra.carb}g · G {extra.gord}g
                </p>
              </div>
              <span className="tabular text-[13px] text-mist">{extra.kcal} kcal</span>
              <button
                aria-label="Remover extra"
                onClick={() =>
                  startTransition(async () => {
                    await removeExtra(dia.data, i);
                    toast.success("Extra removido");
                  })
                }
                className="rounded-md p-1 text-steel opacity-0 transition-opacity hover:text-coral group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>
          ))
        )}
      </div>

      <Button
        variant="dashed"
        size="sm"
        className="mt-4 w-full"
        onClick={() => setAberto(true)}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
        Adicionar extra
      </Button>

      <Dialog open={aberto} onOpenChange={fechar}>
        <DialogContent aria-describedby={undefined} className="w-[min(460px,94vw)]">
          <DialogTitle>Novo extra</DialogTitle>
          <div className="mt-5 flex flex-col gap-4">
            <div>
              <Label htmlFor="extra-nome">O que foi?</Label>
              <Input
                id="extra-nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Pão de queijo, cerveja…"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {campos.map((campo) => (
                <div key={campo.chave}>
                  <Label htmlFor={`extra-${campo.chave}`}>{campo.label}</Label>
                  <Input
                    id={`extra-${campo.chave}`}
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
            <div className="mt-1 flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                disabled={!form.nome.trim() || form.kcal <= 0 || pending}
                onClick={() =>
                  startSalvar(async () => {
                    await addExtra(dia.data, form);
                    toast.success("Extra registrado");
                    setForm({ nome: "", kcal: 0, prot: 0, carb: 0, gord: 0 });
                    fechar(false);
                  })
                }
              >
                {pending ? "Salvando…" : "Adicionar"}
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

export function AguaClient({ dia }: { dia: DiaDaDieta }) {
  const [, startTransition] = useTransition();
  const [ml, setMl] = useState(dia.aguaMl);
  const copos = Math.ceil(dia.metaAguaMl / COPO_ML);
  const cheios = Math.round(ml / COPO_ML);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: copos }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            aria-label={`${n * COPO_ML} ml`}
            onClick={() => {
              const novo = n === cheios ? (n - 1) * COPO_ML : n * COPO_ML;
              setMl(novo);
              startTransition(() => void setAgua(dia.data, novo));
            }}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-[10px] border transition-colors",
              n <= cheios
                ? "border-transparent bg-mint-soft text-mint"
                : "border-stroke text-steel hover:border-mint hover:text-mint"
            )}
          >
            <GlassWater className="h-4 w-4" strokeWidth={1.5} />
          </button>
        ))}
      </div>
      <p className="tabular mt-3 text-[13px] text-mist">
        {(ml / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L de{" "}
        {(dia.metaAguaMl / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L
      </p>
    </div>
  );
}

export function NotasClient({ dia }: { dia: DiaDaDieta }) {
  const [pending, startSalvar] = useTransition();
  const [texto, setTexto] = useState(dia.notas);
  const sujo = texto !== dia.notas;

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Como foi o dia? Fome, energia, treino…"
        className="min-h-24"
      />
      <div>
        <Button
          variant="soft"
          size="sm"
          disabled={!sujo || pending}
          onClick={() =>
            startSalvar(async () => {
              await setNotas(dia.data, texto);
              toast.success("Notas salvas");
            })
          }
        >
          {pending ? "Salvando…" : "Salvar notas"}
        </Button>
      </div>
    </div>
  );
}
