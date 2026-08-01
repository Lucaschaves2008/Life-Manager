"use client";

import { useState } from "react";
import { useAcao } from "@/lib/acao-cliente";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/table";
import { DotsMenu } from "@/components/caverna/dots-menu";
import { EmptyState } from "@/components/caverna/empty-state";
import { EntityListFooter, EntityRow } from "@/components/caverna/entity-list";
import {
  ParcelamentoSheet,
  type ParcelamentoEditavel,
} from "@/components/financas/parcelamento-sheet";
import type { OpcaoSimples } from "@/components/financas/transacao-sheet";
import { deleteParcelamento } from "@/app/actions/financas";
import { formatBRL } from "@/lib/money";
import { mediumDate } from "@/lib/dates";

export type ParcelamentoItem = {
  grupo: string;
  descricao: string;
  valorParcela: number;
  total: number;
  pagas: number;
  parcelas: number;
  proxima: string | null;
  primeiraData: string;
  accountId: string;
  categoryId: string | null;
  cardId: string | null;
  tags: string[];
  natureza: "despesa" | "compromisso";
};

export function ParcelamentosClient({
  itens,
  contas,
  categorias,
  cartoes,
  hoje,
}: {
  itens: ParcelamentoItem[];
  contas: OpcaoSimples[];
  categorias: OpcaoSimples[];
  cartoes: OpcaoSimples[];
  hoje: string;
}) {
  const [, executar] = useAcao();
  const [sheet, setSheet] = useState<{
    aberto: boolean;
    item: ParcelamentoEditavel | null;
  }>({ aberto: false, item: null });

  function abrirNovo() {
    setSheet({ aberto: true, item: null });
  }

  function abrirEditar(item: ParcelamentoItem) {
    setSheet({
      aberto: true,
      item: {
        grupo: item.grupo,
        descricao: item.descricao,
        valorParcela: item.valorParcela,
        parcelas: item.parcelas,
        primeiraData: item.primeiraData,
        accountId: item.accountId,
        categoryId: item.categoryId,
        cardId: item.cardId,
        tags: item.tags,
        natureza: item.natureza,
      },
    });
  }

  return (
    <>
      <div className="flex flex-col">
        {itens.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="Nenhuma compra parcelada em aberto"
            description="Suas compras parceladas aparecem aqui com o que ainda falta pagar."
            className="py-14"
            action={
              <Button variant="dashed" size="sm" onClick={abrirNovo}>
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Adicionar parcelamento
              </Button>
            }
          />
        ) : (
          <>
            {itens.map((p) => (
              <EntityRow
                key={p.grupo}
                emoji="📦"
                cor="var(--color-navy)"
                nome={p.descricao}
                subtitulo={
                  p.proxima
                    ? `Próxima em ${mediumDate(new Date(p.proxima))}`
                    : undefined
                }
                direita={
                  <div className="flex items-center gap-3">
                    <span className="tabular text-[13.5px] text-ice">
                      {formatBRL(p.valorParcela)} × {p.parcelas}
                    </span>
                    {p.natureza === "compromisso" && (
                      <StatusPill tone="amber">Compromisso</StatusPill>
                    )}
                    <StatusPill tone="steel">
                      {p.pagas}/{p.parcelas} pagas
                    </StatusPill>
                    <DotsMenu
                      items={[
                        {
                          label: "Editar",
                          icon: Pencil,
                          onSelect: () => abrirEditar(p),
                        },
                        {
                          label: "Excluir",
                          icon: Trash2,
                          destructive: true,
                          onSelect: () =>
                            executar(async () => {
                              await deleteParcelamento(p.grupo);
                              toast.success("Parcelamento excluído");
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
                onClick={abrirNovo}
                className="inline-flex items-center gap-1.5 text-[12.5px] text-mist transition-colors hover:text-mint"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                Adicionar parcelamento
              </button>
            </EntityListFooter>
          </>
        )}
      </div>

      {sheet.aberto && (
        <ParcelamentoSheet
          key={sheet.item?.grupo ?? "novo"}
          open={sheet.aberto}
          onOpenChange={(v) => setSheet((s) => ({ ...s, aberto: v }))}
          contas={contas}
          categorias={categorias}
          cartoes={cartoes}
          hoje={hoje}
          editando={sheet.item}
        />
      )}
    </>
  );
}
