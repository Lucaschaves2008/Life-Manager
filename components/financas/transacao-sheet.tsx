"use client";

import { useState, useTransition } from "react";
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
import { MoneyInput } from "@/components/caverna/money-input";
import { TagsInput } from "@/components/caverna/tags-input";
import {
  createTransacao,
  updateTransacao,
  type TransacaoInput,
} from "@/app/actions/financas";
import { cn } from "@/lib/utils";

export type OpcaoSimples = { id: string; nome: string; emoji?: string; tipo?: string };

export type TransacaoEditavel = {
  id: string;
  tipo: string;
  valor: number;
  data: string;
  descricao: string;
  accountId: string;
  contraAccountId: string | null;
  categoryId: string | null;
  cardId: string | null;
  tags: string[];
};

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
  hoje,
  editando,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contas: OpcaoSimples[];
  categorias: OpcaoSimples[];
  cartoes: OpcaoSimples[];
  /** yyyy-MM-dd de hoje em São Paulo */
  hoje: string;
  editando?: TransacaoEditavel | null;
}) {
  const [pending, startTransition] = useTransition();
  const [tipo, setTipo] = useState<TransacaoInput["tipo"]>(
    (editando?.tipo as TransacaoInput["tipo"]) ?? "despesa"
  );
  const [valor, setValor] = useState(editando?.valor ?? 0);
  const [data, setData] = useState(editando?.data ?? hoje);
  const [descricao, setDescricao] = useState(editando?.descricao ?? "");
  const [accountId, setAccountId] = useState(editando?.accountId ?? contas[0]?.id ?? "");
  const [contraAccountId, setContraAccountId] = useState(
    editando?.contraAccountId ?? ""
  );
  const [categoryId, setCategoryId] = useState(editando?.categoryId ?? "");
  const [cardId, setCardId] = useState(editando?.cardId ?? "");
  const [tags, setTags] = useState<string[]>(editando?.tags ?? []);
  const [parcelas, setParcelas] = useState(1);

  const categoriasDoTipo = categorias.filter((c) =>
    tipo === "receita" ? c.tipo === "receita" : c.tipo === "despesa"
  );

  const valido =
    valor > 0 &&
    descricao.trim().length > 0 &&
    accountId &&
    (tipo !== "transferencia" || (contraAccountId && contraAccountId !== accountId));

  function salvar() {
    const payload: TransacaoInput = {
      tipo,
      valor,
      data,
      descricao: descricao.trim(),
      accountId,
      contraAccountId: contraAccountId || null,
      categoryId: categoryId || null,
      cardId: cardId || null,
      tags,
      parcelas,
    };

    startTransition(async () => {
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
              <Label>{tipo === "transferencia" ? "Conta de origem" : "Conta"}</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolher conta" />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {tipo === "transferencia" ? (
            <div>
              <Label>Conta de destino</Label>
              <Select value={contraAccountId} onValueChange={setContraAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolher conta" />
                </SelectTrigger>
                <SelectContent>
                  {contas
                    .filter((c) => c.id !== accountId)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
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
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                className="tabular"
              />
              {parcelas > 1 && (
                <p className="mt-1.5 text-[11.5px] text-steel">
                  Serão criadas {parcelas} parcelas mensais a partir da data escolhida.
                </p>
              )}
            </div>
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
