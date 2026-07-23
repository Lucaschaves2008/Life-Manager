"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DotsMenu } from "@/components/caverna/dots-menu";
import {
  atualizarCategoria,
  criarCategoria,
  excluirCategoria,
} from "@/app/actions/estudos";
import type { CategoriaView } from "@/lib/data/estudos";

const CORES = [
  "#6B96D6",
  "#5FB49C",
  "#F5B14C",
  "#C77DFF",
  "#4FC3C7",
  "#E76F81",
];

type Edit = { id: string | null; nome: string; emoji: string; cor: string };
const VAZIO: Edit = { id: null, nome: "", emoji: "📚", cor: CORES[0] };

export function CategoriasSheet({
  open,
  onOpenChange,
  categorias,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categorias: CategoriaView[];
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Edit>(VAZIO);

  function salvar() {
    const nome = form.nome.trim();
    if (!nome) return;
    startTransition(async () => {
      if (form.id) {
        await atualizarCategoria(form.id, { nome, emoji: form.emoji, cor: form.cor });
        toast.success("Categoria atualizada");
      } else {
        await criarCategoria({ nome, emoji: form.emoji, cor: form.cor });
        toast.success("Categoria criada");
      }
      setForm(VAZIO);
    });
  }

  function excluir(id: string) {
    startTransition(async () => {
      await excluirCategoria(id);
      toast.success("Categoria removida");
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>Categorias de estudo</SheetTitle>
        <p className="mt-1 text-[12.5px] text-steel">
          As mesmas categorias que você cronometra aqui podem ser conectadas ao
          plano do dia no checklist.
        </p>

        <div className="mt-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            {categorias.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2.5 rounded-[14px] border border-stroke bg-surface-2 px-3 py-2.5"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px]"
                  style={{ backgroundColor: `${c.cor}22` }}
                >
                  {c.emoji}
                </span>
                <span className="flex-1 text-[13px] text-ice">{c.nome}</span>
                <DotsMenu
                  items={[
                    {
                      label: "Editar",
                      icon: Pencil,
                      onSelect: () =>
                        setForm({ id: c.id, nome: c.nome, emoji: c.emoji, cor: c.cor }),
                    },
                    {
                      label: "Excluir",
                      icon: Trash2,
                      destructive: true,
                      onSelect: () => excluir(c.id),
                    },
                  ]}
                />
              </div>
            ))}
            {categorias.length === 0 && (
              <p className="text-[12.5px] text-steel">Nenhuma categoria ainda.</p>
            )}
          </div>

          {/* Formulário criar/editar */}
          <div className="flex flex-col gap-3 rounded-[14px] border border-stroke bg-surface-2/50 p-4">
            <p className="microlabel">{form.id ? "Editar categoria" : "Nova categoria"}</p>
            <div className="flex items-end gap-2">
              <div className="w-16">
                <Label>Emoji</Label>
                <EmojiPicker
                  value={form.emoji}
                  onChange={(emoji) => setForm((f) => ({ ...f, emoji }))}
                  ariaLabel="Escolher emoji da categoria"
                />
              </div>
              <div className="flex-1">
                <Label>Nome</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && salvar()}
                  placeholder="Ex.: Inglês, Trabalho extra"
                />
              </div>
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {CORES.map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    aria-label={`Cor ${cor}`}
                    onClick={() => setForm((f) => ({ ...f, cor }))}
                    className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: cor,
                      borderColor: form.cor === cor ? "var(--color-ice)" : "transparent",
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={salvar} disabled={pending}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                {form.id ? "Salvar" : "Criar"}
              </Button>
              {form.id && (
                <Button variant="outline" size="sm" onClick={() => setForm(VAZIO)}>
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
