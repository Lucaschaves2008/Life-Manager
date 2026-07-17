"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Copy, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { DotsMenu } from "@/components/caverna/dots-menu";
import { EmptyState } from "@/components/caverna/empty-state";
import {
  TransacaoSheet,
  type OpcaoSimples,
  type TransacaoEditavel,
} from "@/components/financas/transacao-sheet";
import {
  deleteTransacao,
  duplicateTransacao,
  restoreTransacao,
} from "@/app/actions/financas";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

export type LinhaTransacao = TransacaoEditavel & {
  dataLabel: string;
  categoriaNome: string | null;
  categoriaEmoji: string | null;
  contaNome: string;
  parcelaNum: number | null;
  parcelaTotal: number | null;
};

const periodos = [
  { value: "mes", label: "Este mês" },
  { value: "mes-passado", label: "Mês passado" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "tudo", label: "Tudo" },
];

export function TransacoesClient({
  linhas,
  contas,
  categorias,
  cartoes,
  hoje,
}: {
  linhas: LinhaTransacao[];
  contas: OpcaoSimples[];
  categorias: OpcaoSimples[];
  cartoes: OpcaoSimples[];
  hoje: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [sheet, setSheet] = useState<{ aberto: boolean; item: TransacaoEditavel | null }>(
    { aberto: false, item: null }
  );
  const [busca, setBusca] = useState(params.get("q") ?? "");

  const abrirNovo = params.get("novo") === "1";
  useEffect(() => {
    if (abrirNovo) setSheet({ aberto: true, item: null });
  }, [abrirNovo]);

  function setParam(chave: string, valor: string) {
    const next = new URLSearchParams(params.toString());
    if (valor && valor !== "tudo") next.set(chave, valor);
    else next.delete(chave);
    next.delete("novo");
    router.push(`/financas?${next.toString()}`);
  }

  function fecharSheet(v: boolean) {
    setSheet((s) => ({ ...s, aberto: v }));
    if (!v && abrirNovo) {
      const next = new URLSearchParams(params.toString());
      next.delete("novo");
      router.replace(`/financas?${next.toString()}`);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel"
            strokeWidth={1.5}
          />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setParam("q", busca.trim())}
            onBlur={() => setParam("q", busca.trim())}
            placeholder="Buscar transação…"
            className="pl-9"
          />
        </div>

        <div className="w-[150px]">
          <Select
            value={params.get("periodo") ?? "mes"}
            onValueChange={(v) => setParam("periodo", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodos.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-[150px]">
          <Select
            value={params.get("conta") ?? "tudo"}
            onValueChange={(v) => setParam("conta", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Conta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tudo">Todas as contas</SelectItem>
              {contas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-[160px]">
          <Select
            value={params.get("categoria") ?? "tudo"}
            onValueChange={(v) => setParam("categoria", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tudo">Todas as categorias</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.emoji} {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setSheet({ aberto: true, item: null })}
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Nova
        </Button>
      </div>

      {linhas.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhuma transação para esses filtros."
          className="py-16"
          action={
            <Button
              variant="dashed"
              size="sm"
              onClick={() => setSheet({ aberto: true, item: null })}
            >
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Lançar transação
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <Th>Data</Th>
            <Th>Descrição</Th>
            <Th>Categoria</Th>
            <Th>Conta</Th>
            <Th right>Valor</Th>
            <Th right> </Th>
          </THead>
          <tbody>
            {linhas.map((linha) => (
              <Tr key={linha.id}>
                <Td className="tabular whitespace-nowrap text-mist">
                  {linha.dataLabel}
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <span className="text-ice">{linha.descricao}</span>
                    {linha.parcelaTotal && (
                      <span className="tabular rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-steel">
                        {linha.parcelaNum}/{linha.parcelaTotal}
                      </span>
                    )}
                    {linha.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-elevated px-2 py-0.5 text-[11px] text-mist"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </Td>
                <Td className="text-mist">
                  {linha.categoriaNome
                    ? `${linha.categoriaEmoji ?? ""} ${linha.categoriaNome}`
                    : linha.tipo === "transferencia"
                    ? "Transferência"
                    : "—"}
                </Td>
                <Td className="text-mist">{linha.contaNome}</Td>
                <Td right>
                  <span
                    className={cn(
                      "tabular",
                      linha.tipo === "receita" ? "text-mint" : "text-ice"
                    )}
                  >
                    {linha.tipo === "receita" ? "+" : ""}
                    {formatBRL(linha.valor)}
                  </span>
                </Td>
                <Td right>
                  <DotsMenu
                    items={[
                      {
                        label: "Editar",
                        icon: Pencil,
                        onSelect: () => setSheet({ aberto: true, item: linha }),
                      },
                      {
                        label: "Duplicar",
                        icon: Copy,
                        onSelect: () =>
                          startTransition(async () => {
                            await duplicateTransacao(linha.id);
                            toast.success("Transação duplicada");
                          }),
                      },
                      {
                        label: "Excluir",
                        icon: Trash2,
                        destructive: true,
                        onSelect: () =>
                          startTransition(async () => {
                            const removida = await deleteTransacao(linha.id);
                            if (!removida) return;
                            toast("Transação excluída", {
                              action: {
                                label: "Desfazer",
                                onClick: () => restoreTransacao(removida),
                              },
                            });
                          }),
                      },
                    ]}
                  />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {sheet.aberto && (
        <TransacaoSheet
          key={sheet.item?.id ?? "novo"}
          open={sheet.aberto}
          onOpenChange={fecharSheet}
          contas={contas}
          categorias={categorias}
          cartoes={cartoes}
          hoje={hoje}
          editando={sheet.item}
        />
      )}
    </div>
  );
}
