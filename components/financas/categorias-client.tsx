"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DotsMenu } from "@/components/caverna/dots-menu";
import { EmptyState } from "@/components/caverna/empty-state";
import { EntityRow } from "@/components/caverna/entity-list";
import { MoneyInput } from "@/components/caverna/money-input";
import {
  createCategoria,
  deleteCategoria,
  updateCategoria,
  type CategoriaInput,
} from "@/app/actions/financas";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

export type CategoriaItem = CategoriaInput & { id: string; gastoMes: number };

/** Paleta fechada de cores de categoria (§3.8: nada fora dos tokens). */
const paleta = [
  "#0D6EFD",
  "#6B96D6",
  "#F5B14C",
  "#FF6B6B",
  "#4EC9C0",
  "#A78BDB",
  "#4E6A9C",
  "#1A3F75",
];

const vazia: CategoriaInput = {
  nome: "",
  emoji: "🏷️",
  cor: paleta[0],
  tipo: "despesa",
  orcamentoMensal: null,
};

export function CategoriasClient({ itens }: { itens: CategoriaItem[] }) {
  const [, startTransition] = useTransition();
  const [pending, startSalvar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<CategoriaItem | null>(null);
  const [form, setForm] = useState<CategoriaInput>(vazia);

  function abrir(item: CategoriaItem | null) {
    setEditando(item);
    setForm(
      item
        ? {
            nome: item.nome,
            emoji: item.emoji,
            cor: item.cor,
            tipo: item.tipo,
            orcamentoMensal: item.orcamentoMensal,
          }
        : vazia
    );
    setAberto(true);
  }

  function salvar() {
    startSalvar(async () => {
      if (editando) {
        await updateCategoria(editando.id, form);
        toast.success("Categoria atualizada");
      } else {
        await createCategoria(form);
        toast.success("Categoria criada");
      }
      setAberto(false);
    });
  }

  return (
    <>
      <div className="flex flex-col">
        {itens.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="Nenhuma categoria cadastrada."
            className="py-14"
            action={
              <Button variant="dashed" size="sm" onClick={() => abrir(null)}>
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Criar categoria
              </Button>
            }
          />
        ) : (
          itens.map((item) => (
            <EntityRow
              key={item.id}
              emoji={item.emoji}
              cor={item.cor}
              nome={item.nome}
              subtitulo={
                item.orcamentoMensal
                  ? `Orçamento ${formatBRL(item.orcamentoMensal)}`
                  : item.tipo === "receita"
                  ? "Receita"
                  : "Sem orçamento"
              }
              direita={
                <div className="flex items-center gap-3">
                  <span className="tabular text-[13.5px] text-ice">
                    {formatBRL(item.gastoMes)}
                  </span>
                  <DotsMenu
                    items={[
                      { label: "Editar", icon: Pencil, onSelect: () => abrir(item) },
                      {
                        label: "Excluir",
                        icon: Trash2,
                        destructive: true,
                        onSelect: () =>
                          startTransition(async () => {
                            await deleteCategoria(item.id);
                            toast.success("Categoria excluída");
                          }),
                      },
                    ]}
                  />
                </div>
              }
            />
          ))
        )}
      </div>

      {itens.length > 0 && (
        <Button
          variant="dashed"
          size="sm"
          className="mt-4 w-full"
          onClick={() => abrir(null)}
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          Criar categoria
        </Button>
      )}

      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>{editando ? "Editar categoria" : "Nova categoria"}</SheetTitle>
          <div className="mt-6 flex flex-col gap-5">
            <div className="grid grid-cols-[76px_1fr] gap-4">
              <div>
                <Label htmlFor="cat-emoji">Ícone</Label>
                <Input
                  id="cat-emoji"
                  value={form.emoji}
                  onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                  className="text-center"
                  maxLength={2}
                />
              </div>
              <div>
                <Label htmlFor="cat-nome">Nome</Label>
                <Input
                  id="cat-nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Mercado, Transporte…"
                />
              </div>
            </div>

            <div>
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {paleta.map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    aria-label={`Cor ${cor}`}
                    onClick={() => setForm({ ...form, cor })}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-transform",
                      form.cor.toUpperCase() === cor
                        ? "scale-110 border-paper"
                        : "border-transparent"
                    )}
                    style={{ background: cor }}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label>Tipo</Label>
              <div className="flex gap-1.5 rounded-full border border-stroke bg-surface-2 p-1">
                {(["despesa", "receita"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, tipo: t })}
                    className={cn(
                      "flex-1 rounded-full py-1.5 text-[12.5px] capitalize transition-colors",
                      form.tipo === t
                        ? "bg-elevated text-ice"
                        : "text-steel hover:text-mist"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {form.tipo === "despesa" && (
              <div>
                <Label>Orçamento mensal (opcional)</Label>
                <MoneyInput
                  value={form.orcamentoMensal ?? 0}
                  onChange={(v) =>
                    setForm({ ...form, orcamentoMensal: v > 0 ? v : null })
                  }
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                onClick={salvar}
                disabled={!form.nome.trim() || pending}
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
