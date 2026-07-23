"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Heart, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DotsMenu } from "@/components/caverna/dots-menu";
import { EmptyState } from "@/components/caverna/empty-state";
import {
  createHabit,
  deleteHabit,
  moveHabit,
  toggleHabitDia,
  updateHabit,
} from "@/app/actions/checklist";
import type { HabitoView, PctMensalHabito } from "@/lib/data/checklist";
import { cn } from "@/lib/utils";

export function ChecklistHoje({
  habitos,
  feitos,
  pctMensal,
  hoje,
}: {
  habitos: HabitoView[];
  feitos: string[];
  pctMensal: PctMensalHabito[];
  hoje: string;
}) {
  const [pending, startTransition] = useTransition();
  const [gerenciar, setGerenciar] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novaNota, setNovaNota] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoNome, setEditandoNome] = useState("");
  const [editandoNota, setEditandoNota] = useState("");
  const [feitosOtimista, setFeitosOtimista] = useState(feitos);
  const [aberto, setAberto] = useState<HabitoView | null>(null);

  useEffect(() => {
    setFeitosOtimista(feitos);
  }, [feitos]);

  const pctPorId = new Map(pctMensal.map((p) => [p.habitId, p]));

  function toggle(habitId: string) {
    setFeitosOtimista((atuais) =>
      atuais.includes(habitId)
        ? atuais.filter((id) => id !== habitId)
        : [...atuais, habitId]
    );
    startTransition(async () => {
      await toggleHabitDia(habitId, hoje);
    });
  }

  function criar() {
    if (!novoNome.trim()) return;
    startTransition(async () => {
      await createHabit(novoNome, novaNota);
      setNovoNome("");
      setNovaNota("");
      toast.success("Hábito adicionado");
    });
  }

  function salvarEdicao(id: string) {
    if (!editandoNome.trim()) return;
    startTransition(async () => {
      await updateHabit(id, editandoNome, editandoNota);
      setEditandoId(null);
      toast.success("Hábito atualizado");
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="microlabel">Hábitos</p>
        <Button variant="outline" size="sm" onClick={() => setGerenciar(true)}>
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
          Gerenciar
        </Button>
      </div>

      <div className="mt-4">
        {habitos.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Nenhum hábito cadastrado ainda. Adicione o primeiro em Gerenciar."
            className="py-14"
          />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
            {habitos.map((h) => {
              const feito = feitosOtimista.includes(h.id);
              const pct = pctPorId.get(h.id);
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setAberto(h)}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-[14px] border px-3.5 py-3 text-left transition-colors",
                    feito
                      ? "border-mint/30 bg-mint-soft"
                      : "border-stroke bg-surface-2 hover:border-[rgba(143,169,205,.25)]"
                  )}
                >
                  <div className="flex w-full items-center gap-2">
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(h.id);
                      }}
                      role="button"
                      aria-label={feito ? "Desmarcar hoje" : "Marcar como feito hoje"}
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                        feito ? "border-mint bg-mint" : "border-stroke"
                      )}
                    >
                      {feito && (
                        <svg viewBox="0 0 12 12" className="h-3 w-3 fill-none stroke-[var(--color-bg)]">
                          <path d="M2 6l2.5 2.5L10 3" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className={cn("flex-1 truncate text-[13.5px]", feito ? "text-ice" : "text-mist")}>
                      {h.nome}
                    </span>
                  </div>
                  {pct && (
                    <span className="text-[11.5px] text-steel">
                      {Math.round(pct.pct)}% no mês
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sheet: ver/editar nota de um hábito */}
      <Sheet open={!!aberto} onOpenChange={(v) => !v && setAberto(null)}>
        <SheetContent aria-describedby={undefined}>
          {aberto && (
            <>
              <SheetTitle>{aberto.nome}</SheetTitle>
              <div className="mt-6 flex flex-col gap-5">
                {(() => {
                  const pct = pctPorId.get(aberto.id);
                  return pct ? (
                    <p className="text-[13px] text-steel">
                      Cumprido em {Math.round(pct.pct)}% dos dias deste mês ({pct.feitos} de{" "}
                      {pct.diasContados}).
                    </p>
                  ) : null;
                })()}

                <div>
                  <p className="microlabel mb-1.5">Por que esse hábito</p>
                  <p className="whitespace-pre-wrap text-[13.5px] text-ice">
                    {aberto.nota || "Nenhuma anotação ainda — edite em Gerenciar."}
                  </p>
                </div>

                <Button
                  variant="primary"
                  onClick={() => {
                    toggle(aberto.id);
                    setAberto(null);
                  }}
                >
                  {feitosOtimista.includes(aberto.id) ? "Desmarcar hoje" : "Marcar como feito hoje"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={gerenciar} onOpenChange={setGerenciar}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>Gerenciar hábitos</SheetTitle>
          <div className="mt-6 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
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
                        onClick={() => startTransition(() => moveHabit(h.id, -1))}
                        className="rounded-full p-1.5 text-steel transition-colors hover:bg-surface hover:text-ice disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        aria-label="Descer"
                        disabled={i === habitos.length - 1}
                        onClick={() => startTransition(() => moveHabit(h.id, 1))}
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
                              startTransition(async () => {
                                await deleteHabit(h.id);
                                toast.success("Hábito removido");
                              }),
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
                      <Button size="sm" onClick={() => salvarEdicao(h.id)}>
                        Salvar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <div>
                <Label htmlFor="novo-habito">Novo hábito</Label>
                <Input
                  id="novo-habito"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Ex.: Beber mais água"
                />
              </div>
              <div>
                <Label htmlFor="nova-nota">Por que esse hábito (opcional)</Label>
                <textarea
                  id="nova-nota"
                  value={novaNota}
                  onChange={(e) => setNovaNota(e.target.value)}
                  rows={2}
                  placeholder="O motivo de estar cultivando esse hábito"
                  className="w-full rounded-[10px] border border-stroke bg-surface px-3 py-2 text-[13px] text-ice outline-none focus:border-mint/60"
                />
              </div>
              <Button variant="primary" onClick={criar} disabled={pending}>
                <Plus className="h-4 w-4" strokeWidth={2} />
                Adicionar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
