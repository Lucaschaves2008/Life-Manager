"use client";

import { useState, useTransition } from "react";
import { useAcao } from "@/lib/acao-cliente";
import { Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DotsMenu } from "@/components/caverna/dots-menu";
import { EmptyState } from "@/components/caverna/empty-state";
import { EntityRow } from "@/components/caverna/entity-list";
import { MoneyInput } from "@/components/caverna/money-input";
import {
  createConta,
  deleteConta,
  updateConta,
  type ContaInput,
} from "@/app/actions/financas";
import type { ContaComSaldo } from "@/lib/data/financas";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

const paleta = [
  "#6B96D6",
  "#0D6EFD",
  "#4EC9C0",
  "#F5B14C",
  "#FF6B6B",
  "#A78BDB",
  "#4E6A9C",
  "#1A3F75",
];

const tipos: { value: ContaInput["tipo"]; label: string }[] = [
  { value: "corrente", label: "Conta corrente" },
  { value: "poupanca", label: "Poupança" },
  { value: "carteira", label: "Carteira" },
];

const rotuloTipo = new Map<string, string>(tipos.map((t) => [t.value, t.label]));

const vazia: ContaInput = {
  nome: "",
  tipo: "corrente",
  cor: paleta[0],
  saldoInicial: 0,
};

export function ContasClient({ contas }: { contas: ContaComSaldo[] }) {
  const [, executar] = useAcao();
  const [pending, startSalvar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<ContaInput>(vazia);

  function abrir(conta: ContaComSaldo | null) {
    setEditandoId(conta?.id ?? null);
    setForm(
      conta
        ? {
            nome: conta.nome,
            tipo: (conta.tipo as ContaInput["tipo"]) ?? "corrente",
            cor: conta.cor,
            saldoInicial: conta.saldoInicial,
          }
        : vazia
    );
    setAberto(true);
  }

  function salvar() {
    startSalvar(async () => {
      try {
        if (editandoId) {
          await updateConta(editandoId, form);
          toast.success("Conta atualizada");
        } else {
          await createConta(form);
          toast.success("Conta criada");
        }
        setAberto(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
      }
    });
  }

  return (
    <>
      <div className="flex flex-col">
        {contas.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Nenhuma conta cadastrada"
            description="Toda receita e despesa é lançada numa conta. Crie a primeira para começar."
            className="py-14"
            action={
              <Button variant="dashed" size="sm" onClick={() => abrir(null)}>
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Criar conta
              </Button>
            }
          />
        ) : (
          contas.map((conta) => (
            <EntityRow
              key={conta.id}
              cor={conta.cor}
              inicial={conta.nome}
              nome={conta.nome}
              subtitulo={`${rotuloTipo.get(conta.tipo) ?? conta.tipo} · saldo inicial ${formatBRL(conta.saldoInicial)}`}
              direita={
                <div className="flex items-center gap-3">
                  <span className="tabular text-[13.5px] text-ice">
                    {formatBRL(conta.saldo)}
                  </span>
                  <DotsMenu
                    items={[
                      { label: "Editar", icon: Pencil, onSelect: () => abrir(conta) },
                      {
                        label: "Excluir",
                        icon: Trash2,
                        destructive: true,
                        onSelect: () =>
                          executar(async () => {
                            await deleteConta(conta.id);
                            toast.success("Conta excluída");
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

      {contas.length > 0 && (
        <Button
          variant="dashed"
          size="sm"
          className="mt-4 w-full"
          onClick={() => abrir(null)}
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          Criar conta
        </Button>
      )}

      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>{editandoId ? "Editar conta" : "Nova conta"}</SheetTitle>
          <div className="mt-6 flex flex-col gap-5">
            <div>
              <Label htmlFor="conta-nome">Nome</Label>
              <Input
                id="conta-nome"
                autoFocus
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Pessoal, Nubank, Carteira…"
              />
            </div>

            <div>
              <Label>Tipo</Label>
              <div className="flex gap-1.5 rounded-full border border-stroke bg-surface-2 p-1">
                {tipos.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm({ ...form, tipo: t.value })}
                    className={cn(
                      "flex-1 rounded-full py-1.5 text-[12.5px] transition-colors",
                      form.tipo === t.value
                        ? "bg-elevated text-ice"
                        : "text-steel hover:text-mist"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
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
              <Label>Saldo inicial</Label>
              <MoneyInput
                value={form.saldoInicial}
                onChange={(saldoInicial) => setForm({ ...form, saldoInicial })}
              />
              <p className="mt-1.5 text-[11.5px] text-steel">
                Quanto havia na conta antes do primeiro lançamento aqui.
              </p>
            </div>

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
