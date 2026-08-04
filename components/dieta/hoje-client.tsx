"use client";

import { useEffect, useState, useTransition } from "react";
import { useAcao } from "@/lib/acao-cliente";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, GlassWater, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/caverna/empty-state";
import {
  addExtra,
  escolherOpcao,
  removeExtra,
  setAgua,
  setNotas,
  toggleRefeicaoCumprida,
} from "@/app/actions/dieta";
import { rotuloIngrediente } from "@/lib/data/dieta-calc";
import type { DiaDaDieta, ExtraLog, OpcaoView } from "@/lib/data/dieta";
import { cn } from "@/lib/utils";

export function RefeicoesClient({ dia }: { dia: DiaDaDieta }) {
  const [, executar] = useAcao();
  // escolha otimista por refeição: mealId → optionId (ou null = não comida)
  const [escolhas, setEscolhas] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(dia.refeicoes.map((r) => [r.id, r.escolhaId]))
  );

  useEffect(() => {
    setEscolhas(Object.fromEntries(dia.refeicoes.map((r) => [r.id, r.escolhaId])));
  }, [dia.refeicoes]);

  function escolher(mealId: string, optionId: string | null) {
    // Guarda a escolha anterior para reverter se a gravação falhar — senão a
    // refeição fica marcada na tela sem nada ter sido salvo no banco.
    const anterior = escolhas;
    setEscolhas((atual) => ({ ...atual, [mealId]: optionId }));
    executar(
      async () => {
        if (optionId === null) await toggleRefeicaoCumprida(dia.data, mealId);
        else await escolherOpcao(dia.data, mealId, optionId);
      },
      { aoFalhar: () => setEscolhas(anterior) }
    );
  }

  if (dia.refeicoes.length === 0) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title="Nenhuma dieta ativa"
        description="Monte um plano alimentar e ative-o para acompanhar suas refeições do dia."
        className="py-14"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {dia.refeicoes.map((r) => {
        const escolhida = escolhas[r.id] ?? null;
        const feita = escolhida !== null;
        const umaOpcao = r.opcoes.length <= 1;
        const opcaoUnica = r.opcoes[0] ?? null;

        return (
          <div
            key={r.id}
            className={cn(
              "rounded-[14px] border px-4 py-3.5 transition-colors",
              feita
                ? "border-[var(--mint-border)] bg-mint-soft"
                : "border-stroke bg-surface-2"
            )}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                checked={feita}
                aria-label={r.nome}
                // com 1 opção o checkbox marca direto; com várias, checar sem ter
                // escolhido seleciona a 1ª (o usuário troca depois se quiser)
                onCheckedChange={() => {
                  if (feita) escolher(r.id, null);
                  else escolher(r.id, (escolhida ?? opcaoUnica?.id) ?? null);
                }}
                disabled={!opcaoUnica}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[14px] text-paper">{r.nome}</p>
                  {r.horario && (
                    <span className="tabular text-[11.5px] text-steel">{r.horario}</span>
                  )}
                </div>

                {umaOpcao ? (
                  <>
                    <p className="tabular mt-0.5 text-[11.5px] text-steel">
                      {Math.round(r.macros.kcal)} kcal · P {Math.round(r.macros.prot)}g ·
                      C {Math.round(r.macros.carb)}g · G {Math.round(r.macros.gord)}g
                    </p>
                    {opcaoUnica && opcaoUnica.ingredientes.length > 0 && (
                      <p className="mt-1.5 text-[12px] text-mist">
                        {opcaoUnica.ingredientes.map(rotuloIngrediente).join(" · ")}
                      </p>
                    )}
                    {opcaoUnica && <Preparo opcao={opcaoUnica} />}
                  </>
                ) : (
                  <>
                    <p className="mt-0.5 text-[11px] text-steel">
                      {feita ? "Você comeu:" : "Escolha o que comeu:"}
                    </p>
                    <div className="mt-2 flex flex-col gap-1.5">
                      {r.opcoes.map((o) => {
                        const sel = escolhida === o.id;
                        return (
                          <div
                            key={o.id}
                            className={cn(
                              "rounded-[10px] border px-3 py-2 transition-colors",
                              sel
                                ? "border-[var(--mint-border)] bg-surface-1"
                                : "border-stroke bg-surface-1 hover:border-[var(--mint-border)]"
                            )}
                          >
                            <button
                              onClick={() => escolher(r.id, sel ? null : o.id)}
                              className="flex w-full items-center justify-between gap-3 text-left"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border",
                                      sel
                                        ? "border-mint bg-mint"
                                        : "border-steel bg-transparent"
                                    )}
                                  >
                                    {sel && (
                                      <span className="h-1.5 w-1.5 rounded-full bg-surface-1" />
                                    )}
                                  </span>
                                  <span className="truncate text-[12.5px] text-ice">
                                    {o.nome}
                                  </span>
                                </div>
                                {o.ingredientes.length > 0 && (
                                  <p className="mt-0.5 truncate pl-5 text-[11px] text-mist">
                                    {o.ingredientes.map((i) => i.nome).join(" · ")}
                                  </p>
                                )}
                              </div>
                              <span className="tabular shrink-0 text-[11px] text-steel">
                                {Math.round(o.macros.kcal)} kcal
                              </span>
                            </button>
                            <div className="pl-5">
                              <Preparo opcao={o} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * O modo de preparo na hora de comer — fechado por padrão, porque na maioria
 * dos dias ele já sabe fazer; aberto, é a receita inteira sem sair da tela.
 */
function Preparo({ opcao }: { opcao: OpcaoView }) {
  const [aberto, setAberto] = useState(false);
  const passos = (opcao.descricao ?? "").split("\n").filter((l) => l.trim());
  if (passos.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setAberto((v) => !v)}
        className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-steel transition-colors hover:text-ice"
      >
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", aberto && "rotate-180")}
          strokeWidth={1.5}
        />
        {aberto ? "Esconder o preparo" : "Como faz"}
      </button>
      {aberto && (
        <ol className="mt-1.5 flex flex-col gap-1 border-l border-stroke pl-3">
          {passos.map((passo, i) => (
            <li key={i} className="text-[11.5px] leading-relaxed text-mist">
              {passo}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

export function ExtrasClient({ dia }: { dia: DiaDaDieta }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, executar] = useAcao();
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
                  executar(async () => {
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
  const [, executar] = useAcao();
  const [ml, setMl] = useState(dia.aguaMl);
  const copoMl = Math.max(1, dia.copoMl);
  const copos = Math.max(1, Math.ceil(dia.metaAguaMl / copoMl));
  // copos já totalmente cheios com o ml atual (não arredonda: um copo só
  // conta como cheio quando o volume bate ou passa do tamanho do copo)
  const cheios = Math.min(copos, Math.floor(ml / copoMl));

  useEffect(() => {
    setMl(dia.aguaMl);
  }, [dia.aguaMl]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: copos }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            aria-label={`${n * copoMl} ml`}
            onClick={() => {
              const novo = n <= cheios ? (n - 1) * copoMl : n * copoMl;
              setMl(novo);
              executar(() => setAgua(dia.data, novo));
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
        <span className="text-steel"> · copo de {copoMl} ml</span>
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
