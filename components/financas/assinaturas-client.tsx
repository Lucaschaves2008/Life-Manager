"use client";

import { useState, useTransition } from "react";
import { CreditCard, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/table";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DotsMenu } from "@/components/caverna/dots-menu";
import { EmptyState } from "@/components/caverna/empty-state";
import { EntityListFooter, EntityRow } from "@/components/caverna/entity-list";
import { MoneyInput } from "@/components/caverna/money-input";
import {
  createAssinatura,
  deleteAssinatura,
  restoreAssinatura,
  updateAssinatura,
  type AssinaturaInput,
} from "@/app/actions/financas";
import { formatBRL } from "@/lib/money";

export type AssinaturaItem = AssinaturaInput & { id: string };

const vazia: AssinaturaInput = {
  nome: "",
  emoji: "💳",
  valor: 0,
  diaCobranca: 1,
  status: "ativa",
};

export function AssinaturasClient({ itens }: { itens: AssinaturaItem[] }) {
  const [, startTransition] = useTransition();
  const [editando, setEditando] = useState<AssinaturaItem | null>(null);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<AssinaturaInput>(vazia);
  const [pending, startSalvar] = useTransition();

  function abrir(item: AssinaturaItem | null) {
    setEditando(item);
    setForm(item ? { ...item } : vazia);
    setAberto(true);
  }

  function salvar() {
    startSalvar(async () => {
      if (editando) {
        await updateAssinatura(editando.id, form);
        toast.success("Assinatura atualizada");
      } else {
        await createAssinatura(form);
        toast.success("Assinatura criada");
      }
      setAberto(false);
    });
  }

  return (
    <>
      <div className="flex flex-col">
        {itens.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Nenhuma assinatura cadastrada."
            className="py-14"
            action={
              <Button variant="dashed" size="sm" onClick={() => abrir(null)}>
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Adicionar assinatura
              </Button>
            }
          />
        ) : (
          <>
            {itens.map((item) => (
              <EntityRow
                key={item.id}
                emoji={item.emoji}
                cor="var(--color-navy)"
                nome={item.nome}
                subtitulo={`Todo dia ${item.diaCobranca}`}
                direita={
                  <div className="flex items-center gap-3">
                    <span className="tabular text-[13.5px] text-ice">
                      {formatBRL(item.valor)}
                    </span>
                    <StatusPill tone={item.status === "ativa" ? "mint" : "steel"}>
                      {item.status === "ativa" ? "Ativa" : "Pausada"}
                    </StatusPill>
                    <DotsMenu
                      items={[
                        { label: "Editar", icon: Pencil, onSelect: () => abrir(item) },
                        {
                          label: item.status === "ativa" ? "Pausar" : "Retomar",
                          icon: item.status === "ativa" ? Pause : Play,
                          onSelect: () =>
                            startTransition(async () => {
                              await updateAssinatura(item.id, {
                                ...item,
                                status: item.status === "ativa" ? "pausada" : "ativa",
                              });
                              toast.success(
                                item.status === "ativa"
                                  ? "Assinatura pausada"
                                  : "Assinatura retomada"
                              );
                            }),
                        },
                        {
                          label: "Excluir",
                          icon: Trash2,
                          destructive: true,
                          onSelect: () =>
                            startTransition(async () => {
                              const removida = await deleteAssinatura(item.id);
                              if (!removida) return;
                              toast("Assinatura excluída", {
                                action: {
                                  label: "Desfazer",
                                  onClick: () =>
                                    restoreAssinatura({
                                      nome: removida.nome,
                                      emoji: removida.emoji,
                                      valor: removida.valor,
                                      diaCobranca: removida.diaCobranca,
                                      status: removida.status as "ativa" | "pausada",
                                    }),
                                },
                              });
                            }),
                        },
                      ]}
                    />
                  </div>
                }
              />
            ))}
            <EntityListFooter>
              <button
                onClick={() => abrir(null)}
                className="inline-flex items-center gap-1.5 text-[12.5px] text-mist transition-colors hover:text-mint"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                Adicionar assinatura
              </button>
            </EntityListFooter>
          </>
        )}
      </div>

      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>
            {editando ? "Editar assinatura" : "Nova assinatura"}
          </SheetTitle>
          <div className="mt-6 flex flex-col gap-5">
            <div className="grid grid-cols-[76px_1fr] gap-4">
              <div>
                <Label htmlFor="emoji">Ícone</Label>
                <Input
                  id="emoji"
                  value={form.emoji}
                  onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                  className="text-center"
                  maxLength={2}
                />
              </div>
              <div>
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Netflix, Spotify…"
                />
              </div>
            </div>

            <div>
              <Label>Valor mensal</Label>
              <MoneyInput
                value={form.valor}
                onChange={(valor) => setForm({ ...form, valor })}
              />
            </div>

            <div>
              <Label htmlFor="dia">Dia da cobrança</Label>
              <Input
                id="dia"
                type="number"
                min={1}
                max={31}
                value={form.diaCobranca}
                onChange={(e) =>
                  setForm({
                    ...form,
                    diaCobranca: Math.min(31, Math.max(1, Number(e.target.value) || 1)),
                  })
                }
                className="tabular"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                onClick={salvar}
                disabled={!form.nome.trim() || form.valor <= 0 || pending}
              >
                {pending ? "Salvando…" : "Salvar"}
              </Button>
              <Button variant="ghost" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
