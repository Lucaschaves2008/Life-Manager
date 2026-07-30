"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Briefcase, Check, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  criarContaFinanceira,
  excluirContaFinanceira,
  renomearContaFinanceira,
  setContaAtiva,
} from "@/app/actions/contas-financeiras";
import {
  EMAIL_SUPORTE_LIMITE,
  LIMITE_CONTAS_FINANCEIRAS,
  type ContaFinanceiraView,
} from "@/lib/contas-financeiras-shared";
import { cn } from "@/lib/utils";

const paleta = ["#0D6EFD", "#6B96D6", "#F5B14C", "#4EC9C0", "#A78BDB"];

export function ContaFinanceiraSelector({
  contas,
  ativaId,
}: {
  contas: ContaFinanceiraView[];
  ativaId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pending, startSalvar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<ContaFinanceiraView | null>(null);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(paleta[0]);

  const ativa = contas.find((c) => c.id === ativaId) ?? contas[0];
  const noLimite = contas.length >= LIMITE_CONTAS_FINANCEIRAS;

  function trocar(id: string) {
    if (id === ativaId) return;
    startTransition(async () => {
      await setContaAtiva(id);
      router.refresh();
    });
  }

  function abrirNova() {
    setEditando(null);
    setNome("");
    setCor(paleta[0]);
    setAberto(true);
  }

  function abrirEdicao(conta: ContaFinanceiraView) {
    setEditando(conta);
    setNome(conta.nome);
    setCor(conta.cor);
    setAberto(true);
  }

  function salvar() {
    startSalvar(async () => {
      try {
        if (editando) {
          await renomearContaFinanceira(editando.id, nome, cor);
          toast.success("Conta atualizada");
        } else {
          const conta = await criarContaFinanceira(nome, cor);
          await setContaAtiva(conta.id);
          toast.success("Conta criada");
        }
        setAberto(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível salvar a conta.");
      }
    });
  }

  function excluir(conta: ContaFinanceiraView) {
    if (
      !confirm(
        `Excluir a conta "${conta.nome}"? Todo o histórico financeiro dela (transações, contas, cartões, ativos) será apagado permanentemente.`
      )
    )
      return;
    startTransition(async () => {
      try {
        await excluirContaFinanceira(conta.id);
        toast.success("Conta excluída");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível excluir a conta.");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-2 rounded-full border border-stroke bg-surface-2 py-1.5 pl-1.5 pr-3 text-[13px] text-ice transition-colors hover:border-mist/40">
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full"
              style={{ background: ativa.cor }}
            >
              <Briefcase className="h-3 w-3 text-paper" strokeWidth={2} />
            </span>
            {ativa.nome}
            <ChevronDown className="h-3.5 w-3.5 text-steel" strokeWidth={1.5} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[240px]">
          {contas.map((c) => (
            <DropdownMenuItem key={c.id} onSelect={() => trocar(c.id)} className="group">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: c.cor }}
              />
              <span className="flex-1">{c.nome}</span>
              {c.id === ativaId && (
                <Check className="h-3.5 w-3.5 shrink-0 text-mint" strokeWidth={2} />
              )}
              {!c.padrao && (
                <span className="ml-1 flex shrink-0 items-center gap-0.5">
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Editar ${c.nome}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      abrirEdicao(c);
                    }}
                    className="rounded-full p-1 text-steel opacity-0 transition-opacity hover:bg-surface hover:text-ice group-data-[highlighted]:opacity-100"
                  >
                    <Pencil className="h-3 w-3" strokeWidth={1.5} />
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Excluir ${c.nome}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      excluir(c);
                    }}
                    className="rounded-full p-1 text-steel opacity-0 transition-opacity hover:bg-coral-soft hover:text-coral group-data-[highlighted]:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                  </span>
                </span>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {noLimite ? (
            <DropdownMenuItem
              disabled
              onSelect={(e) => e.preventDefault()}
              className="text-steel"
            >
              Limite atingido — fale com {EMAIL_SUPORTE_LIMITE}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => abrirNova()}>
              <Plus className="h-3.5 w-3.5 text-steel" strokeWidth={1.5} />
              Criar conta
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>{editando ? "Editar conta" : "Nova conta financeira"}</SheetTitle>
          <div className="mt-6 flex flex-col gap-5">
            <div>
              <Label htmlFor="conta-nome">Nome</Label>
              <Input
                id="conta-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Trabalho, Empresa…"
              />
            </div>

            <div>
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {paleta.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Cor ${c}`}
                    onClick={() => setCor(c)}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-transform",
                      cor.toUpperCase() === c ? "scale-110 border-paper" : "border-transparent"
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="primary" onClick={salvar} disabled={!nome.trim() || pending}>
                {pending ? "Salvando…" : editando ? "Salvar" : "Criar"}
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
