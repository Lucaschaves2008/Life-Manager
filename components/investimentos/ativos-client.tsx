"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { DotsMenu } from "@/components/caverna/dots-menu";
import { EmptyState } from "@/components/caverna/empty-state";
import { MoneyInput } from "@/components/caverna/money-input";
import { VariationBadge } from "@/components/caverna/variation-badge";
import { Sparkline } from "@/components/charts/sparkline";
import {
  createAsset,
  createMovement,
  deleteAsset,
  deleteMovement,
  restoreAsset,
  restoreMovement,
  updateAsset,
  type AtivoInput,
  type MovimentoInput,
} from "@/app/actions/investimentos";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

export type MovimentoView = {
  id: string;
  tipo: string;
  valor: number;
  dataLabel: string;
  nota: string | null;
  assetId: string;
  dataISO: string;
};

export type AtivoView = {
  id: string;
  nome: string;
  classe: string;
  instituicao: string;
  cor: string;
  valorAtual: number;
  aportado: number;
  rendimento: number;
  pctRendimento: number | null;
  serie: number[];
  movimentos: MovimentoView[];
};

const classes = ["Renda Fixa", "Tesouro", "Ações", "FIIs", "Cripto", "Fundos"];
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

const ativoVazio: AtivoInput = {
  nome: "",
  classe: "Renda Fixa",
  instituicao: "",
  cor: paleta[0],
};

const iconeMovimento: Record<string, { Icon: typeof ArrowUpRight; cor: string }> = {
  aporte: { Icon: ArrowUpRight, cor: "text-mint" },
  resgate: { Icon: ArrowDownRight, cor: "text-coral" },
  atualizacao: { Icon: RotateCcw, cor: "text-steel" },
};

export function AtivosClient({
  ativos,
  hoje,
}: {
  ativos: AtivoView[];
  hoje: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [pending, startSalvar] = useTransition();

  const [sheetAtivo, setSheetAtivo] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<AtivoInput>(ativoVazio);

  const [detalhe, setDetalhe] = useState<AtivoView | null>(null);
  const [mov, setMov] = useState<Omit<MovimentoInput, "assetId">>({
    tipo: "aporte",
    valor: 0,
    data: hoje,
    nota: "",
  });

  const abrirNovo = params.get("novo") === "1";
  useEffect(() => {
    if (abrirNovo && ativos.length > 0) setDetalhe(ativos[0]);
  }, [abrirNovo, ativos]);

  function limparNovo() {
    if (!abrirNovo) return;
    const next = new URLSearchParams(params.toString());
    next.delete("novo");
    router.replace(`/investimentos?${next.toString()}`);
  }

  function abrirAtivo(ativo: AtivoView | null) {
    setEditandoId(ativo?.id ?? null);
    setForm(
      ativo
        ? {
            nome: ativo.nome,
            classe: ativo.classe,
            instituicao: ativo.instituicao,
            cor: ativo.cor,
          }
        : ativoVazio
    );
    setSheetAtivo(true);
  }

  function salvarAtivo() {
    startSalvar(async () => {
      if (editandoId) {
        await updateAsset(editandoId, form);
        toast.success("Ativo atualizado");
      } else {
        await createAsset(form);
        toast.success("Ativo criado");
      }
      setSheetAtivo(false);
    });
  }

  function salvarMovimento() {
    if (!detalhe) return;
    startSalvar(async () => {
      await createMovement({ ...mov, assetId: detalhe.id });
      toast.success(
        mov.tipo === "aporte"
          ? "Aporte registrado"
          : mov.tipo === "resgate"
          ? "Resgate registrado"
          : "Valor atualizado"
      );
      setMov({ tipo: "aporte", valor: 0, data: hoje, nota: "" });
      setDetalhe(null);
      limparNovo();
    });
  }

  return (
    <>
      {ativos.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Nenhum ativo na carteira ainda."
          className="py-16"
          action={
            <Button variant="dashed" size="sm" onClick={() => abrirAtivo(null)}>
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Adicionar ativo
            </Button>
          }
        />
      ) : (
        <>
          <Table>
            <THead>
              <Th>Ativo</Th>
              <Th>Classe</Th>
              <Th right>Valor atual</Th>
              <Th right>Aportado</Th>
              <Th right>Rentabilidade</Th>
              <Th>Evolução</Th>
              <Th right> </Th>
            </THead>
            <tbody>
              {ativos.map((ativo) => (
                <Tr key={ativo.id}>
                  <Td>
                    <button
                      onClick={() => setDetalhe(ativo)}
                      className="flex items-center gap-3 text-left"
                    >
                      <span
                        className="h-7 w-7 shrink-0 rounded-[8px]"
                        style={{
                          background: `color-mix(in srgb, ${ativo.cor} 22%, transparent)`,
                          border: `1px solid ${ativo.cor}`,
                        }}
                      />
                      <span>
                        <span className="block text-[13.5px] text-ice">
                          {ativo.nome}
                        </span>
                        <span className="block text-[11.5px] text-steel">
                          {ativo.instituicao}
                        </span>
                      </span>
                    </button>
                  </Td>
                  <Td>
                    <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11.5px] text-mist">
                      {ativo.classe}
                    </span>
                  </Td>
                  <Td right>{formatBRL(ativo.valorAtual)}</Td>
                  <Td right className="text-mist">
                    {formatBRL(ativo.aportado)}
                  </Td>
                  <Td right>
                    {ativo.pctRendimento != null ? (
                      <VariationBadge pct={ativo.pctRendimento} />
                    ) : (
                      <span className="text-steel">—</span>
                    )}
                  </Td>
                  <Td>
                    <Sparkline
                      values={ativo.serie}
                      cor={
                        ativo.rendimento >= 0
                          ? "var(--color-mint)"
                          : "var(--color-coral)"
                      }
                    />
                  </Td>
                  <Td right>
                    <DotsMenu
                      items={[
                        {
                          label: "Movimentos",
                          icon: RotateCcw,
                          onSelect: () => setDetalhe(ativo),
                        },
                        {
                          label: "Editar",
                          icon: Pencil,
                          onSelect: () => abrirAtivo(ativo),
                        },
                        {
                          label: "Excluir",
                          icon: Trash2,
                          destructive: true,
                          onSelect: () =>
                            startTransition(async () => {
                              const removido = await deleteAsset(ativo.id);
                              if (!removido) return;
                              toast("Ativo excluído", {
                                action: {
                                  label: "Desfazer",
                                  onClick: () =>
                                    restoreAsset({
                                      nome: removido.nome,
                                      classe: removido.classe,
                                      instituicao: removido.instituicao,
                                      cor: removido.cor,
                                      movements: removido.movements.map((m) => ({
                                        tipo: m.tipo,
                                        valor: m.valor,
                                        data: m.data,
                                        nota: m.nota,
                                      })),
                                    }),
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

          <Button
            variant="dashed"
            size="sm"
            className="mt-4 w-full"
            onClick={() => abrirAtivo(null)}
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Adicionar ativo
          </Button>
        </>
      )}

      {/* Sheet de ativo */}
      <Sheet open={sheetAtivo} onOpenChange={setSheetAtivo}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>{editandoId ? "Editar ativo" : "Novo ativo"}</SheetTitle>
          <div className="mt-6 flex flex-col gap-5">
            <div>
              <Label htmlFor="ativo-nome">Nome</Label>
              <Input
                id="ativo-nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="CDB 110% CDI, ITSA4…"
              />
            </div>
            <div>
              <Label>Classe</Label>
              <Select
                value={form.classe}
                onValueChange={(v) => setForm({ ...form, classe: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="instituicao">Instituição</Label>
              <Input
                id="instituicao"
                value={form.instituicao}
                onChange={(e) => setForm({ ...form, instituicao: e.target.value })}
                placeholder="Inter, NuInvest…"
              />
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
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                onClick={salvarAtivo}
                disabled={!form.nome.trim() || pending}
              >
                {pending ? "Salvando…" : "Salvar"}
              </Button>
              <Button variant="ghost" onClick={() => setSheetAtivo(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet de movimentos do ativo */}
      <Sheet
        open={!!detalhe}
        onOpenChange={(v) => {
          if (!v) {
            setDetalhe(null);
            limparNovo();
          }
        }}
      >
        <SheetContent aria-describedby={undefined}>
          {detalhe && (
            <>
              <SheetTitle>{detalhe.nome}</SheetTitle>
              <p className="mt-1 text-[12.5px] text-steel">
                {detalhe.classe} · {detalhe.instituicao} ·{" "}
                <span className="tabular">{formatBRL(detalhe.valorAtual)}</span>
              </p>

              <div className="mt-6 rounded-[14px] border border-stroke bg-surface-2 p-4">
                <p className="microlabel">Novo movimento</p>
                <div className="mt-3 flex flex-col gap-4">
                  <div className="flex gap-1.5 rounded-full border border-stroke bg-surface p-1">
                    {(["aporte", "resgate", "atualizacao"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setMov({ ...mov, tipo: t })}
                        className={cn(
                          "flex-1 rounded-full py-1.5 text-[12.5px] transition-colors",
                          mov.tipo === t
                            ? "bg-elevated text-ice"
                            : "text-steel hover:text-mist"
                        )}
                      >
                        {t === "aporte"
                          ? "Aporte"
                          : t === "resgate"
                          ? "Resgate"
                          : "Atualização"}
                      </button>
                    ))}
                  </div>

                  <div>
                    <Label>
                      {mov.tipo === "atualizacao" ? "Novo valor total" : "Valor"}
                    </Label>
                    <MoneyInput
                      value={mov.valor}
                      onChange={(valor) => setMov({ ...mov, valor })}
                    />
                    {mov.tipo === "atualizacao" && (
                      <p className="mt-1.5 text-[11.5px] text-steel">
                        Informe quanto o ativo vale hoje, não o rendimento.
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="mov-data">Data</Label>
                    <Input
                      id="mov-data"
                      type="date"
                      value={mov.data}
                      onChange={(e) => setMov({ ...mov, data: e.target.value })}
                      className="tabular"
                    />
                  </div>

                  <div>
                    <Label htmlFor="mov-nota">Nota (opcional)</Label>
                    <Textarea
                      id="mov-nota"
                      value={mov.nota ?? ""}
                      onChange={(e) => setMov({ ...mov, nota: e.target.value })}
                      className="min-h-16"
                    />
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={salvarMovimento}
                    disabled={mov.valor <= 0 || pending}
                  >
                    {pending ? "Salvando…" : "Registrar"}
                  </Button>
                </div>
              </div>

              <p className="microlabel mt-7">Histórico</p>
              <div className="mt-2 flex flex-col">
                {detalhe.movimentos.length === 0 ? (
                  <p className="py-3 text-[13px] text-steel">
                    Nenhum movimento registrado.
                  </p>
                ) : (
                  [...detalhe.movimentos].reverse().map((m) => {
                    const { Icon, cor } = iconeMovimento[m.tipo] ?? iconeMovimento.atualizacao;
                    return (
                      <div
                        key={m.id}
                        className="group flex items-center gap-3 border-b border-stroke py-2.5 last:border-0"
                      >
                        <Icon className={cn("h-4 w-4", cor)} strokeWidth={1.5} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] text-ice">
                            {m.tipo === "aporte"
                              ? "Aporte"
                              : m.tipo === "resgate"
                              ? "Resgate"
                              : "Atualização"}
                          </p>
                          <p className="tabular text-[11.5px] text-steel">
                            {m.dataLabel}
                            {m.nota ? ` · ${m.nota}` : ""}
                          </p>
                        </div>
                        <span className="tabular text-[13px] text-mist">
                          {formatBRL(m.valor)}
                        </span>
                        <button
                          aria-label="Excluir movimento"
                          onClick={() =>
                            startTransition(async () => {
                              const removido = await deleteMovement(m.id);
                              if (!removido) return;
                              setDetalhe(null);
                              toast("Movimento excluído", {
                                action: {
                                  label: "Desfazer",
                                  onClick: () =>
                                    restoreMovement({
                                      assetId: removido.assetId,
                                      tipo: removido.tipo,
                                      valor: removido.valor,
                                      data: removido.data,
                                      nota: removido.nota,
                                    }),
                                },
                              });
                            })
                          }
                          className="rounded-md p-1 text-steel opacity-0 transition-opacity hover:text-coral group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
