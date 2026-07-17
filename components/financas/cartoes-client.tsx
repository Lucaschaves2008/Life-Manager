"use client";

import { useState, useTransition } from "react";
import { CreditCard, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Card, CardLabel } from "@/components/caverna/card";
import { DotsMenu } from "@/components/caverna/dots-menu";
import { EmptyState } from "@/components/caverna/empty-state";
import { MoneyInput } from "@/components/caverna/money-input";
import {
  createCartao,
  deleteCartao,
  updateCartao,
  type CartaoInput,
} from "@/app/actions/financas";
import type { FaturaCartao } from "@/lib/data/financas";
import { formatBRL } from "@/lib/money";

const bandeiras = ["Visa", "Mastercard", "Elo", "Amex", "Hipercard"];

const vazio: CartaoInput = {
  nome: "",
  bandeira: "Visa",
  limite: 0,
  fechamento: 1,
  vencimento: 10,
  cor: "#6B96D6",
};

export function CartoesClient({ faturas }: { faturas: FaturaCartao[] }) {
  const [, startTransition] = useTransition();
  const [pending, startSalvar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<CartaoInput>(vazio);

  function abrir(fatura: FaturaCartao | null) {
    setEditandoId(fatura?.id ?? null);
    setForm(
      fatura
        ? {
            nome: fatura.nome,
            bandeira: fatura.bandeira,
            limite: fatura.limite,
            fechamento: fatura.fechamento,
            vencimento: fatura.vencimento,
            cor: fatura.cor,
          }
        : vazio
    );
    setAberto(true);
  }

  function salvar() {
    startSalvar(async () => {
      if (editandoId) {
        await updateCartao(editandoId, form);
        toast.success("Cartão atualizado");
      } else {
        await createCartao(form);
        toast.success("Cartão criado");
      }
      setAberto(false);
    });
  }

  return (
    <>
      {faturas.length === 0 ? (
        <Card>
          <CardLabel>Cartões</CardLabel>
          <EmptyState
            icon={CreditCard}
            title="Nenhum cartão conectado."
            className="py-14"
            action={
              <Button variant="dashed" size="sm" onClick={() => abrir(null)}>
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Adicionar cartão
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="stagger grid grid-cols-12 gap-6">
          {faturas.map((fatura) => (
            <Card key={fatura.id} className="col-span-12 md:col-span-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardLabel>{fatura.bandeira}</CardLabel>
                  <p className="mt-1.5 text-[15px] text-paper">{fatura.nome}</p>
                </div>
                <DotsMenu
                  items={[
                    { label: "Editar", icon: Pencil, onSelect: () => abrir(fatura) },
                    {
                      label: "Excluir",
                      icon: Trash2,
                      destructive: true,
                      onSelect: () =>
                        startTransition(async () => {
                          await deleteCartao(fatura.id);
                          toast.success("Cartão excluído");
                        }),
                    },
                  ]}
                />
              </div>

              <p className="microlabel mt-5">Fatura aberta</p>
              <p className="tabular mt-1 text-[26px] font-semibold text-paper">
                {formatBRL(fatura.faturaAberta)}
              </p>

              <div className="mt-4">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{
                      width: `${Math.min(100, fatura.pctLimite)}%`,
                      background:
                        fatura.pctLimite > 100
                          ? "var(--color-coral)"
                          : fatura.pctLimite >= 70
                          ? "var(--color-amber)"
                          : "var(--color-mint)",
                    }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11.5px] text-steel">
                  <span className="tabular">
                    {Math.round(fatura.pctLimite)}% de {formatBRL(fatura.limite)}
                  </span>
                  <span className="tabular">
                    Fecha dia {fatura.fechamento} · vence dia {fatura.vencimento}
                  </span>
                </div>
              </div>
            </Card>
          ))}

          <div className="col-span-12">
            <Button variant="dashed" size="sm" onClick={() => abrir(null)}>
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Adicionar cartão
            </Button>
          </div>
        </div>
      )}

      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>{editandoId ? "Editar cartão" : "Novo cartão"}</SheetTitle>
          <div className="mt-6 flex flex-col gap-5">
            <div>
              <Label htmlFor="cartao-nome">Nome</Label>
              <Input
                id="cartao-nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Nubank, Inter…"
              />
            </div>

            <div>
              <Label>Bandeira</Label>
              <Select
                value={form.bandeira}
                onValueChange={(v) => setForm({ ...form, bandeira: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bandeiras.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Limite</Label>
              <MoneyInput
                value={form.limite}
                onChange={(limite) => setForm({ ...form, limite })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fechamento">Dia de fechamento</Label>
                <Input
                  id="fechamento"
                  type="number"
                  min={1}
                  max={31}
                  value={form.fechamento}
                  onChange={(e) =>
                    setForm({ ...form, fechamento: Number(e.target.value) || 1 })
                  }
                  className="tabular"
                />
              </div>
              <div>
                <Label htmlFor="vencimento">Dia de vencimento</Label>
                <Input
                  id="vencimento"
                  type="number"
                  min={1}
                  max={31}
                  value={form.vencimento}
                  onChange={(e) =>
                    setForm({ ...form, vencimento: Number(e.target.value) || 1 })
                  }
                  className="tabular"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                onClick={salvar}
                disabled={!form.nome.trim() || form.limite <= 0 || pending}
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
