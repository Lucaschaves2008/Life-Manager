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
  updateParcelamento,
  type ParcelamentoInput,
} from "@/app/actions/financas";
import type { OpcaoSimples } from "@/components/financas/transacao-sheet";
import { formatBRL } from "@/lib/money";

export type ParcelamentoEditavel = {
  grupo: string;
  descricao: string;
  valorParcela: number;
  parcelas: number;
  primeiraData: string;
  accountId: string;
  categoryId: string | null;
  cardId: string | null;
  tags: string[];
  natureza?: "despesa" | "compromisso";
};

export function ParcelamentoSheet({
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
  editando?: ParcelamentoEditavel | null;
}) {
  const [pending, executar] = useAcao();
  const [descricao, setDescricao] = useState(editando?.descricao ?? "");
  const [valorParcela, setValorParcela] = useState(editando?.valorParcela ?? 0);
  const [data, setData] = useState(editando?.primeiraData ?? hoje);
  const [parcelas, setParcelas] = useState(editando?.parcelas ?? 2);
  const [accountId, setAccountId] = useState(editando?.accountId ?? contas[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(editando?.categoryId ?? "");
  const [cardId, setCardId] = useState(editando?.cardId ?? "");
  const [tags, setTags] = useState<string[]>(editando?.tags ?? []);
  const [compromisso, setCompromisso] = useState(editando?.natureza === "compromisso");

  const categoriasDespesa = categorias.filter((c) => c.tipo === "despesa");

  const valido = valorParcela > 0 && descricao.trim().length > 0 && accountId && parcelas >= 2;

  function salvar() {
    const payload: ParcelamentoInput = {
      descricao: descricao.trim(),
      valorParcela,
      data,
      parcelas,
      accountId,
      categoryId: categoryId || null,
      cardId: cardId || null,
      tags,
      natureza: compromisso ? "compromisso" : "despesa",
    };

    executar(async () => {
      if (editando) {
        await updateParcelamento(editando.grupo, payload);
        toast.success("Parcelamento atualizado");
      } else {
        await createTransacao({
          tipo: "despesa",
          natureza: payload.natureza,
          valor: payload.valorParcela,
          data: payload.data,
          descricao: payload.descricao,
          accountId: payload.accountId,
          categoryId: payload.categoryId,
          cardId: payload.cardId,
          tags: payload.tags,
          parcelas: payload.parcelas,
        });
        toast.success(`${parcelas} parcelas lançadas`);
      }
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>{editando ? "Editar parcelamento" : "Novo parcelamento"}</SheetTitle>

        <div className="mt-6 flex flex-col gap-5">
          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Input
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Fone Bluetooth JBL…"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor da parcela</Label>
              <MoneyInput value={valorParcela} onChange={setValorParcela} autoFocus />
            </div>
            <div>
              <Label htmlFor="parcelas">Parcelas</Label>
              <Input
                id="parcelas"
                type="number"
                min={2}
                max={48}
                value={parcelas}
                onChange={(e) =>
                  setParcelas(Math.min(48, Math.max(2, Number(e.target.value) || 2)))
                }
                onFocus={(e) => e.target.select()}
                className="tabular"
              />
            </div>
          </div>

          {valorParcela > 0 && parcelas >= 2 && (
            <p className="-mt-2 text-[11.5px] text-steel">
              Total de {formatBRL(valorParcela * parcelas)} em {parcelas}x.
            </p>
          )}

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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="data">Primeira parcela</Label>
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
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categoriasDespesa.map((c) => (
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

          <div>
            <Label>Tags</Label>
            <TagsInput value={tags} onChange={setTags} />
          </div>

          {editando && (
            <p className="text-[11.5px] text-steel">
              Salvar recria todas as parcelas deste grupo com os novos dados — inclusive as
              já pagas.
            </p>
          )}

          <div className="mt-1 flex items-center gap-3">
            <Button variant="primary" onClick={salvar} disabled={!valido || pending}>
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
