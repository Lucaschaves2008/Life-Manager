"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, GlassWater, Heart, Pencil, Plus, Trash2 } from "lucide-react";
import { useAcao } from "@/lib/acao-cliente";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DotsMenu } from "@/components/caverna/dots-menu";
import { EmptyState } from "@/components/caverna/empty-state";
import {
  deleteHabit,
  moveHabit,
  toggleHabitDia,
  updateHabit,
} from "@/app/actions/checklist";
import { excluirRotinaTemplate, toggleRotinaCheckDia } from "@/app/actions/rotinas";
import { excluirVariavel, toggleVariavelCheckDia } from "@/app/actions/variaveis";
import {
  ItemFormSheet,
  TIPO_META,
  VARIAVEL_META,
  formDaVariavel,
  formDoTemplate,
  formVazio,
  type FormState,
} from "@/components/checklist/item-form";
import type { HabitoView, PctMensalHabito } from "@/lib/data/checklist";
import type {
  RotinaOcorrenciaView,
  RotinaOpcao,
  RotinaPlanoView,
  RotinaTemplateView,
} from "@/lib/data/rotinas";
import type { VariavelChecklistItem } from "@/lib/data/variaveis";
import type { AguaChecklistItem } from "@/lib/data/dieta";
import type { CategoriaView } from "@/lib/data/estudos";
import type { SessaoCorridaOpcao } from "@/lib/data/treinos-format";
import { cn } from "@/lib/utils";

/**
 * Bloco de Hábitos: o que é "todo dia, sempre igual" e por isso não tem lugar
 * na agenda por horário do checklist. Reúne três origens com a mesma cara —
 * hábitos simples (Habit), variáveis marcadas para morar aqui, e itens da
 * rotina sem horário (RotinaTemplate com local="habitos"), incluindo os
 * vinculados a treino/corrida/refeição. A meta de água também vive aqui: é
 * diária, não tem hora, e o progresso vem sozinho dos copos em /dieta.
 */

/** Card do bloco, seja qual for a origem — a UI trata os três igual. */
type CardHabito = {
  chave: string;
  nome: string;
  nota: string | null;
  emoji: string;
  feito: boolean;
  /** Rodapé do card: "72% no mês", "12 dias", … */
  rodape: string | null;
  onToggle: () => void;
  onEditar: () => void;
  onExcluir: () => void;
};

export function ChecklistHoje({
  habitos,
  feitos,
  pctMensal,
  ocorrencias,
  variaveis,
  templates,
  categorias,
  rotinasTreino,
  sessoesCorrida,
  refeicoesCadastradas,
  planos,
  agua,
  hoje,
}: {
  habitos: HabitoView[];
  feitos: string[];
  pctMensal: PctMensalHabito[];
  ocorrencias: RotinaOcorrenciaView[];
  variaveis: VariavelChecklistItem[];
  templates: RotinaTemplateView[];
  categorias: CategoriaView[];
  rotinasTreino: RotinaOpcao[];
  sessoesCorrida: SessaoCorridaOpcao[];
  refeicoesCadastradas: RotinaOpcao[];
  planos: RotinaPlanoView[];
  agua: AguaChecklistItem;
  hoje: string;
}) {
  const [pending, executar] = useAcao();
  const [gerenciar, setGerenciar] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoNome, setEditandoNome] = useState("");
  const [editandoNota, setEditandoNota] = useState("");
  const [feitosOtimista, setFeitosOtimista] = useState(feitos);
  const [variaveisOtimista, setVariaveisOtimista] = useState(variaveis);
  const [ocorrenciasOtimista, setOcorrenciasOtimista] = useState(ocorrencias);
  const [aberto, setAberto] = useState<CardHabito | null>(null);

  useEffect(() => setFeitosOtimista(feitos), [feitos]);
  useEffect(() => setVariaveisOtimista(variaveis), [variaveis]);
  useEffect(() => setOcorrenciasOtimista(ocorrencias), [ocorrencias]);

  const pctPorId = useMemo(() => new Map(pctMensal.map((p) => [p.habitId, p])), [pctMensal]);
  const templatesHabito = useMemo(
    () => templates.filter((t) => t.local === "habitos"),
    [templates]
  );

  function toggleHabito(habitId: string) {
    // Guarda o estado anterior para reverter se a gravação falhar — sem isso o
    // hábito ficava marcado na tela mesmo quando o banco não recebeu nada, e
    // só "desmarcava sozinho" no próximo reload.
    const anterior = feitosOtimista;
    setFeitosOtimista((atuais) =>
      atuais.includes(habitId) ? atuais.filter((id) => id !== habitId) : [...atuais, habitId]
    );
    executar(() => toggleHabitDia(habitId, hoje), {
      aoFalhar: () => setFeitosOtimista(anterior),
    });
  }

  function toggleVariavel(variavelId: string) {
    const virar = () =>
      setVariaveisOtimista((atuais) =>
        atuais.map((v) => (v.id === variavelId ? { ...v, feito: !v.feito } : v))
      );
    virar();
    executar(() => toggleVariavelCheckDia(variavelId, hoje), { aoFalhar: virar });
  }

  function toggleRotina(templateId: string, opcaoId?: string | null) {
    const anterior = ocorrenciasOtimista;
    setOcorrenciasOtimista((atuais) =>
      atuais.map((oc) => {
        if (oc.templateId !== templateId) return oc;
        if (opcaoId && oc.feito && oc.opcaoEscolhidaId !== opcaoId) {
          return { ...oc, opcaoEscolhidaId: opcaoId };
        }
        return {
          ...oc,
          feito: !oc.feito,
          feitoAuto: false,
          opcaoEscolhidaId: oc.feito ? null : opcaoId ?? null,
        };
      })
    );
    executar(() => toggleRotinaCheckDia(templateId, hoje, opcaoId ?? null), {
      aoFalhar: () => setOcorrenciasOtimista(anterior),
    });
  }

  function salvarEdicao(id: string) {
    if (!editandoNome.trim()) return;
    executar(
      async () => {
        await updateHabit(id, editandoNome, editandoNota);
        setEditandoId(null);
      },
      { sucesso: "Hábito atualizado" }
    );
  }

  const cards: CardHabito[] = useMemo(() => {
    const deVariaveis = variaveisOtimista.map((v) => ({
      chave: `variavel:${v.id}`,
      nome: v.nome,
      nota: v.nota,
      emoji: v.emoji || VARIAVEL_META.emoji,
      feito: v.feito,
      rodape:
        v.streakAtual && v.streakAtual > 0
          ? `${v.streakAtual} ${v.streakAtual === 1 ? "dia seguido" : "dias seguidos"}`
          : null,
      onToggle: () => toggleVariavel(v.id),
      onEditar: () => setForm(formDaVariavel(v)),
      onExcluir: () => executar(() => excluirVariavel(v.id), { sucesso: "Removido dos hábitos" }),
    }));

    const deRotinas = ocorrenciasOtimista.map((oc) => {
      const escolhida = oc.opcoes.find((o) => o.id === oc.opcaoEscolhidaId);
      return {
        chave: `rotina:${oc.templateId}`,
        nome: oc.nome,
        nota: oc.nota,
        emoji: (TIPO_META[oc.tipo] ?? TIPO_META.livre).emoji,
        feito: oc.feito,
        rodape: escolhida?.nome ?? null,
        onToggle: () => toggleRotina(oc.templateId),
        onEditar: () => {
          const t = templatesHabito.find((tt) => tt.id === oc.templateId);
          if (t) setForm(formDoTemplate(t));
        },
        onExcluir: () =>
          executar(() => excluirRotinaTemplate(oc.templateId), { sucesso: "Removido dos hábitos" }),
      };
    });

    const deHabitos = habitos.map((h) => {
      const pct = pctPorId.get(h.id);
      return {
        chave: `habit:${h.id}`,
        nome: h.nome,
        nota: h.nota,
        emoji: "✓",
        feito: feitosOtimista.includes(h.id),
        rodape: pct ? `${Math.round(pct.pct)}% no mês` : null,
        onToggle: () => toggleHabito(h.id),
        onEditar: () => {
          setGerenciar(true);
          setEditandoId(h.id);
          setEditandoNome(h.nome);
          setEditandoNota(h.nota ?? "");
        },
        onExcluir: () => executar(() => deleteHabit(h.id), { sucesso: "Hábito removido" }),
      };
    });

    return [...deVariaveis, ...deRotinas, ...deHabitos];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variaveisOtimista, ocorrenciasOtimista, habitos, feitosOtimista, pctPorId, templatesHabito]);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="microlabel">Hábitos</p>
        <div className="flex flex-wrap items-center gap-2">
          {habitos.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setGerenciar(true)}>
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
              Gerenciar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setForm(formVazio("habitos"))}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Adicionar
          </Button>
        </div>
      </div>

      <div className="mt-4">
        {cards.length === 0 ? (
          <div className="flex flex-col gap-3">
            <EmptyState
              icon={Heart}
              title="Nenhum hábito cadastrado ainda"
              description="Hábito é o que não tem horário e todo dia é igual — variável, treino, corrida ou refeição. Adicione um para acompanhar a constância."
              className="py-14"
            />
            <CardAgua item={agua} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
            {cards.map((c) => (
              <button
                key={c.chave}
                type="button"
                onClick={() => setAberto(c)}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-[14px] border px-3.5 py-3 text-left transition-colors",
                  c.feito
                    ? "border-mint/30 bg-mint-soft"
                    : "border-stroke bg-surface-2 hover:border-[rgba(143,169,205,.25)]"
                )}
              >
                <div className="flex w-full items-center gap-2">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      c.onToggle();
                    }}
                    role="button"
                    aria-label={c.feito ? "Desmarcar hoje" : "Marcar como feito hoje"}
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                      c.feito ? "border-mint bg-mint" : "border-stroke"
                    )}
                  >
                    {c.feito && (
                      <svg viewBox="0 0 12 12" className="h-3 w-3 fill-none stroke-[var(--color-bg)]">
                        <path
                          d="M2 6l2.5 2.5L10 3"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span className={cn("flex-1 truncate text-[13.5px]", c.feito ? "text-ice" : "text-mist")}>
                    {c.nome}
                  </span>
                </div>
                {c.rodape && <span className="text-[11.5px] text-steel">{c.rodape}</span>}
              </button>
            ))}
            <CardAgua item={agua} />
          </div>
        )}
      </div>

      {/* Sheet: ver/editar um hábito */}
      <Sheet open={!!aberto} onOpenChange={(v) => !v && setAberto(null)}>
        <SheetContent aria-describedby={undefined}>
          {aberto && (
            <>
              <SheetTitle>{aberto.nome}</SheetTitle>
              <div className="mt-6 flex flex-col gap-5">
                {aberto.rodape && <p className="text-[13px] text-steel">{aberto.rodape}</p>}

                <div>
                  <p className="microlabel mb-1.5">Por que esse hábito</p>
                  <p className="whitespace-pre-wrap text-[13.5px] text-ice">
                    {aberto.nota || "Nenhuma anotação ainda — edite para escrever o motivo."}
                  </p>
                </div>

                <Button
                  variant="primary"
                  onClick={() => {
                    aberto.onToggle();
                    setAberto(null);
                  }}
                >
                  {aberto.feito ? "Desmarcar hoje" : "Marcar como feito hoje"}
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      const alvo = aberto;
                      setAberto(null);
                      alvo.onEditar();
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      const alvo = aberto;
                      setAberto(null);
                      alvo.onExcluir();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Excluir
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet: gerenciar os hábitos simples (nome + porquê + ordem) */}
      <Sheet open={gerenciar} onOpenChange={setGerenciar}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>Gerenciar hábitos</SheetTitle>
          <div className="mt-6 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              {habitos.length === 0 && (
                <p className="text-[12.5px] text-steel">Nenhum hábito simples cadastrado.</p>
              )}
              {habitos.map((h, i) => (
                <div
                  key={h.id}
                  className="flex flex-col gap-2 rounded-[14px] border border-stroke bg-surface-2 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    {editandoId === h.id ? (
                      <Input
                        autoFocus
                        value={editandoNome}
                        onChange={(e) => setEditandoNome(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && salvarEdicao(h.id)}
                        className="h-8"
                      />
                    ) : (
                      <span className="flex-1 text-[13px] text-ice">{h.nome}</span>
                    )}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Subir"
                        disabled={i === 0}
                        onClick={() => executar(() => moveHabit(h.id, -1))}
                        className="rounded-full p-1.5 text-steel transition-colors hover:bg-surface hover:text-ice disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        aria-label="Descer"
                        disabled={i === habitos.length - 1}
                        onClick={() => executar(() => moveHabit(h.id, 1))}
                        className="rounded-full p-1.5 text-steel transition-colors hover:bg-surface hover:text-ice disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                      <DotsMenu
                        items={[
                          {
                            label: "Editar",
                            icon: Pencil,
                            onSelect: () => {
                              setEditandoId(h.id);
                              setEditandoNome(h.nome);
                              setEditandoNota(h.nota ?? "");
                            },
                          },
                          {
                            label: "Excluir",
                            icon: Trash2,
                            destructive: true,
                            onSelect: () =>
                              executar(() => deleteHabit(h.id), { sucesso: "Hábito removido" }),
                          },
                        ]}
                      />
                    </div>
                  </div>
                  {editandoId === h.id && (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`nota-${h.id}`}>Por que esse hábito (opcional)</Label>
                      <textarea
                        id={`nota-${h.id}`}
                        value={editandoNota}
                        onChange={(e) => setEditandoNota(e.target.value)}
                        rows={3}
                        className="w-full rounded-[10px] border border-stroke bg-surface px-3 py-2 text-[13px] text-ice outline-none focus:border-mint/60"
                      />
                      <Button size="sm" onClick={() => salvarEdicao(h.id)} disabled={pending}>
                        Salvar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setGerenciar(false);
                setForm(formVazio("habitos"));
              }}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Novo hábito
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ItemFormSheet
        form={form}
        setForm={setForm}
        dia={hoje}
        categorias={categorias}
        rotinasTreino={rotinasTreino}
        sessoesCorrida={sessoesCorrida}
        refeicoesCadastradas={refeicoesCadastradas}
        planos={planos}
      />
    </>
  );
}

/**
 * Meta de água como card de hábito — sem toggle próprio: o check acende quando
 * `aguaMl >= metaAguaMl`, o mesmo cálculo de AguaClient em /dieta, onde os
 * copos ficam. Clicar leva pra lá em vez de marcar aqui, já que marcar precisa
 * saber QUANTOS copos foram bebidos, não só sim/não.
 */
function CardAgua({ item }: { item: AguaChecklistItem }) {
  const pct = item.metaAguaMl > 0 ? Math.min(100, (item.aguaMl / item.metaAguaMl) * 100) : 0;

  return (
    <Link
      href="/dieta"
      className={cn(
        "flex flex-col items-start gap-2 rounded-[14px] border px-3.5 py-3 transition-colors",
        item.feito
          ? "border-mint/30 bg-mint-soft"
          : "border-stroke bg-surface-2 hover:border-[rgba(143,169,205,.25)]"
      )}
    >
      <div className="flex w-full items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
            item.feito ? "border-mint bg-mint" : "border-stroke"
          )}
        >
          {item.feito && (
            <svg viewBox="0 0 12 12" className="h-3 w-3 fill-none stroke-[var(--color-bg)]">
              <path d="M2 6l2.5 2.5L10 3" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <GlassWater className="h-[15px] w-[15px] shrink-0 text-mist" strokeWidth={1.5} />
        <span className={cn("flex-1 truncate text-[13.5px]", item.feito ? "text-ice" : "text-mist")}>
          Beber água
        </span>
      </div>
      <div className="flex w-full items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-mint transition-all duration-500"
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        </div>
        <span className="tabular text-[11px] text-steel">
          {(item.aguaMl / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}/
          {(item.metaAguaMl / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L
        </span>
      </div>
    </Link>
  );
}
