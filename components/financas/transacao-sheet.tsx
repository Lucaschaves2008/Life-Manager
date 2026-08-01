"use client";

import { useState } from "react";
import { useAcao } from "@/lib/acao-cliente";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { MoneyInput } from "@/components/caverna/money-input";
import { TagsInput } from "@/components/caverna/tags-input";
import {
  createTransacao,
  updateTransacao,
  type TransacaoInput,
} from "@/app/actions/financas";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/money";

export type OpcaoSimples = {
  id: string;
  nome: string;
  emoji?: string;
  tipo?: string;
  /** Saldo/valor atual (contas, ativos) ou fatura utilizada (cartões), em centavos. */
  saldo?: number;
  /** Rótulo do valor, ex. "Saldo", "Fatura", "Valor atual". Default "Saldo". */
  saldoLabel?: string;
};

function detalheDaOpcao(o: OpcaoSimples | undefined): string | null {
  if (!o || o.saldo == null) return null;
  return `${o.saldoLabel ?? "Saldo"}: ${formatBRL(o.saldo)}`;
}

export type TipoPonta = "conta" | "cartao" | "ativo";
export type Ponta = { tipo: TipoPonta; id: string };

export type TransacaoEditavel = {
  id: string;
  tipo: string;
  valor: number;
  data: string;
  descricao: string;
  accountId: string | null;
  categoryId: string | null;
  cardId: string | null;
  origemTipo: TipoPonta | null;
  origemId: string | null;
  destinoTipo: TipoPonta | null;
  destinoId: string | null;
  tags: string[];
  natureza?: string;
};

const rotuloPonta: Record<TipoPonta, string> = {
  conta: "Conta",
  cartao: "Cartão",
  ativo: "Ativo",
};

function SeletorPonta({
  label,
  valor,
  onChange,
  contas,
  cartoes,
  ativos,
}: {
  label: string;
  valor: Ponta | null;
  onChange: (p: Ponta | null) => void;
  contas: OpcaoSimples[];
  cartoes: OpcaoSimples[];
  ativos: OpcaoSimples[];
}) {
  const opcoesPorTipo: Record<TipoPonta, OpcaoSimples[]> = {
    conta: contas,
    cartao: cartoes,
    ativo: ativos,
  };
  const tipo = valor?.tipo ?? "conta";
  const opcaoSelecionada = opcoesPorTipo[tipo].find((o) => o.id === valor?.id);
  const detalhe = detalheDaOpcao(opcaoSelecionada);

  return (
    <div>
      <Label>{label}</Label>
      <div className="mb-2 flex gap-1.5 rounded-full border border-stroke bg-surface-2 p-1">
        {(["conta", "cartao", "ativo"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              const primeira = opcoesPorTipo[t][0];
              onChange(primeira ? { tipo: t, id: primeira.id } : null);
            }}
            className={cn(
              "flex-1 rounded-full py-1.5 text-[12.5px] transition-colors",
              tipo === t ? "bg-elevated text-ice" : "text-steel hover:text-mist"
            )}
          >
            {rotuloPonta[t]}
          </button>
        ))}
      </div>
      <Select
        value={valor?.id ?? ""}
        onValueChange={(id) => onChange({ tipo, id })}
      >
        <SelectTrigger>
          <SelectValue placeholder="Escolher" />
        </SelectTrigger>
        <SelectContent>
          {opcoesPorTipo[tipo].map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.nome}
              {o.saldo != null ? ` · ${formatBRL(o.saldo)}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {detalhe && (
        <p className="mt-1.5 text-[12.5px] text-steel">{detalhe}</p>
      )}
    </div>
  );
}

const tipos = [
  { value: "despesa", label: "Despesa" },
  { value: "receita", label: "Receita" },
  { value: "transferencia", label: "Transferência" },
] as const;

export function TransacaoSheet({
  open,
  onOpenChange,
  contas,
  categorias,
  cartoes,
  ativos,
  hoje,
  editando,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contas: OpcaoSimples[];
  categorias: OpcaoSimples[];
  cartoes: OpcaoSimples[];
  ativos: OpcaoSimples[];
  /** yyyy-MM-dd de hoje em São Paulo */
  hoje: string;
  editando?: TransacaoEditavel | null;
}) {
  const [pending, executar] = useAcao();
  const [tipo, setTipo] = useState<TransacaoInput["tipo"]>(
    (editando?.tipo as TransacaoInput["tipo"]) ?? "despesa"
  );
  const [valor, setValor] = useState(editando?.valor ?? 0);
  const [data, setData] = useState(editando?.data ?? hoje);
  const [descricao, setDescricao] = useState(editando?.descricao ?? "");
  const [accountId, setAccountId] = useState(editando?.accountId ?? contas[0]?.id ?? "");
  const [origem, setOrigem] = useState<Ponta | null>(
    editando?.origemTipo && editando?.origemId
      ? { tipo: editando.origemTipo, id: editando.origemId }
      : contas[0]
        ? { tipo: "conta", id: contas[0].id }
        : null
  );
  const [destino, setDestino] = useState<Ponta | null>(
    editando?.destinoTipo && editando?.destinoId
      ? { tipo: editando.destinoTipo, id: editando.destinoId }
      : null
  );
  const [categoryId, setCategoryId] = useState(editando?.categoryId ?? "");
  const [cardId, setCardId] = useState(editando?.cardId ?? "");
  const [tags, setTags] = useState<string[]>(editando?.tags ?? []);
  const [parcelas, setParcelas] = useState(1);
  const [compromisso, setCompromisso] = useState(editando?.natureza === "compromisso");

  const categoriasDoTipo = categorias.filter((c) =>
    tipo === "receita" ? c.tipo === "receita" : c.tipo === "despesa"
  );

  const valido =
    valor > 0 &&
    descricao.trim().length > 0 &&
    (tipo === "transferencia"
      ? origem &&
        destino &&
        !(origem.tipo === destino.tipo && origem.id === destino.id)
      : accountId);

  function salvar() {
    const payload: TransacaoInput = {
      tipo,
      valor,
      data,
      descricao: descricao.trim(),
      accountId,
      categoryId: categoryId || null,
      cardId: cardId || null,
      origemTipo: origem?.tipo ?? null,
      origemId: origem?.id ?? null,
      destinoTipo: destino?.tipo ?? null,
      destinoId: destino?.id ?? null,
      tags,
      parcelas,
      natureza: tipo === "despesa" && compromisso ? "compromisso" : "despesa",
    };

    executar(async () => {
      if (editando) {
        await updateTransacao(editando.id, payload);
        toast.success("Transação atualizada");
      } else {
        await createTransacao(payload);
        toast.success(
          parcelas > 1 ? `${parcelas} parcelas lançadas` : "Transação lançada"
        );
      }
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>{editando ? "Editar transação" : "Nova transação"}</SheetTitle>

        <div className="mt-6 flex flex-col gap-5">
          <div className="flex gap-1.5 rounded-full border border-stroke bg-surface-2 p-1">
            {tipos.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                className={cn(
                  "flex-1 rounded-full py-1.5 text-[12.5px] transition-colors",
                  tipo === t.value
                    ? "bg-elevated text-ice"
                    : "text-steel hover:text-mist"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div>
            <Label>Valor</Label>
            <MoneyInput value={valor} onChange={setValor} autoFocus />
          </div>

          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Input
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Mercado, salário, aluguel…"
            />
          </div>

          {tipo === "transferencia" ? (
            <div>
              <Label htmlFor="data">Data</Label>
              <Input
                id="data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="tabular"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="data">Data</Label>
                <Input
                  id="data"
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="tabular"
                />
              </div>
              <div>
                <Label>Conta</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolher conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {contas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                        {c.saldo != null ? ` · ${formatBRL(c.saldo)}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(() => {
                  const detalhe = detalheDaOpcao(contas.find((c) => c.id === accountId));
                  return detalhe ? (
                    <p className="mt-1.5 text-[12.5px] text-steel">{detalhe}</p>
                  ) : null;
                })()}
              </div>
            </div>
          )}

          {tipo === "transferencia" ? (
            <>
              <SeletorPonta
                label="De"
                valor={origem}
                onChange={setOrigem}
                contas={contas}
                cartoes={cartoes}
                ativos={ativos}
              />
              <SeletorPonta
                label="Para"
                valor={destino}
                onChange={setDestino}
                contas={contas}
                cartoes={cartoes}
                ativos={ativos}
              />
            </>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriasDoTipo.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.emoji} {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cartão</Label>
                <Select value={cardId} onValueChange={setCardId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    {cartoes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                        {c.saldo != null ? ` · ${formatBRL(c.saldo)}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(() => {
                  const detalhe = detalheDaOpcao(cartoes.find((c) => c.id === cardId));
                  return detalhe ? (
                    <p className="mt-1.5 text-[12.5px] text-steel">{detalhe}</p>
                  ) : null;
                })()}
              </div>
            </div>
          )}

          <div>
            <Label>Tags</Label>
            <TagsInput value={tags} onChange={setTags} />
          </div>

          {!editando && tipo === "despesa" && (
            <div>
              <Label htmlFor="parcelas">Parcelas</Label>
              <Input
                id="parcelas"
                type="number"
                min={1}
                max={48}
                value={parcelas}
                onChange={(e) => setParcelas(Number(e.target.value) || 1)}
                onFocus={(e) => e.target.select()}
                className="tabular"
              />
              {parcelas > 1 && (
                <p className="mt-1.5 text-[11.5px] text-steel">
                  Serão criadas {parcelas} parcelas mensais a partir da data escolhida.
                </p>
              )}
            </div>
          )}

          {tipo === "despesa" && (
            <label className="flex cursor-pointer items-start gap-2 text-[13px] text-mist">
              <Checkbox
                className="mt-0.5"
                checked={compromisso}
                onCheckedChange={(v) => setCompromisso(v === true)}
              />
              <span>
                É um compromisso, não uma despesa
                <span className="mt-0.5 block text-[11.5px] text-steel">
                  Ex.: aporte mensal fixo — aparece na lista, mas não entra nos totais de gasto.
                </span>
              </span>
            </label>
          )}

          <div className="mt-1 flex items-center gap-3">
            <Button
              variant="primary"
              onClick={salvar}
              disabled={!valido || pending}
            >
              {pending ? "Salvando…" : editando ? "Salvar" : "Lançar"}
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
