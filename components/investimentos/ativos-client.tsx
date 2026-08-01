"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  Coins,
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
import { Segmented } from "@/components/caverna/segmented";
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
  diaAporte: number | null;
  revisarACada: number | null;
  valorAtual: number;
  aportado: number;
  rendimento: number;
  pctRendimento: number | null;
  serie: number[];
  movimentos: MovimentoView[];
};

const opcoesRevisao = [
  { label: "Não lembrar", value: "0" },
  { label: "A cada semana", value: "7" },
  { label: "A cada 15 dias", value: "15" },
  { label: "A cada mês", value: "30" },
];

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
  diaAporte: null,
  revisarACada: null,
};

const rotuloMovimento: Record<string, string> = {
  aporte: "Aporte",
  resgate: "Resgate",
  atualizacao: "Atualização",
  dividendo: "Dividendo",
};

const iconeMovimento: Record<
  string,
  { Icon: typeof ArrowUpRight; cor: string }
> = {
  aporte: { Icon: ArrowUpRight, cor: "text-mint" },
  resgate: { Icon: ArrowDownRight, cor: "text-coral" },
  atualizacao: { Icon: RotateCcw, cor: "text-steel" },
  dividendo: { Icon: Coins, cor: "text-amber" },
};

type GrupoInstituicaoView = {
  instituicao: string;
  valorTotal: number;
  ativos: AtivoView[];
};

/** Agrupa os ativos por instituição para a visão por corretora. */
function groupByInstituicao(ativos: AtivoView[]): GrupoInstituicaoView[] {
  const mapa = new Map<string, AtivoView[]>();
  for (const a of ativos) {
    mapa.set(a.instituicao, [...(mapa.get(a.instituicao) ?? []), a]);
  }
  return Array.from(mapa.entries())
    .map(([instituicao, lista]) => ({
      instituicao,
      valorTotal: lista.reduce((s, a) => s + a.valorAtual, 0),
      ativos: lista,
    }))
    .sort((a, b) => b.valorTotal - a.valorTotal);
}

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
  const [agrupar, setAgrupar] = useState(false);

  const grupos = groupByInstituicao(ativos);

  const [detalhe, setDetalhe] = useState<AtivoView | null>(null);
  const [mov, setMov] = useState<Omit<MovimentoInput, "assetId">>({
    tipo: "aporte",
    valor: 0,
    data: hoje,
    nota: "",
  });

  const abrirNovo = params.get("novo") === "1";
  const revisarId = params.get("revisar");
  useEffect(() => {
    if (abrirNovo && ativos.length > 0) setDetalhe(ativos[0]);
  }, [abrirNovo, ativos]);

  useEffect(() => {
    if (!revisarId) return;
    const ativo = ativos.find((a) => a.id === revisarId);
    if (ativo) {
      setDetalhe(ativo);
      setMov({ tipo: "atualizacao", valor: 0, data: hoje, nota: "" });
    }
  }, [revisarId, ativos, hoje]);

  function limparNovo() {
    if (!abrirNovo && !revisarId) return;
    const next = new URLSearchParams(params.toString());
    next.delete("novo");
    next.delete("revisar");
    const query = next.toString();
    // Adia a navegação para depois da animação de fechamento do Sheet (Radix
    // Portal): disparar o router.replace no mesmo tick faz o React tentar
    // remover o mesmo nó do portal duas vezes (removeChild NotFoundError).
    setTimeout(() => {
      router.replace(query ? `/investimentos?${query}` : "/investimentos");
    }, 0);
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
            diaAporte: ativo.diaAporte,
            revisarACada: ativo.revisarACada,
          }
        : ativoVazio,
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
            : mov.tipo === "dividendo"
              ? "Dividendo registrado"
              : "Valor atualizado",
      );
      setMov({ tipo: "aporte", valor: 0, data: hoje, nota: "" });
      setDetalhe(null);
      limparNovo();
    });
  }

  function renderLinha(ativo: AtivoView) {
    return (
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
              <span className="block text-[13.5px] text-ice">{ativo.nome}</span>
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
              ativo.rendimento >= 0 ? "var(--color-mint)" : "var(--color-coral)"
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
                            diaAporte: removido.diaAporte,
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
    );
  }

  const cabecalho = (
    <THead>
      <Th>Ativo</Th>
      <Th>Classe</Th>
      <Th right>Valor atual</Th>
      <Th right>Aportado</Th>
      <Th right>Rentabilidade</Th>
      <Th>Evolução</Th>
      <Th right> </Th>
    </THead>
  );

  return (
    <>
      {ativos.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Nenhum ativo na carteira ainda"
          description="Cadastre seu primeiro ativo para acompanhar aportes e rendimento."
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
          <div className="mb-4 flex justify-end">
            <Segmented
              options={[
                { label: "Lista", value: "lista" },
                { label: "Por instituição", value: "instituicao" },
              ]}
              value={agrupar ? "instituicao" : "lista"}
              onChange={(v) => setAgrupar(v === "instituicao")}
            />
          </div>

          {agrupar ? (
            <div className="flex flex-col gap-7">
              {grupos.map((grupo) => (
                <div key={grupo.instituicao}>
                  <div className="mb-2 flex items-baseline justify-between gap-4">
                    <p className="text-[13.5px] font-medium text-ice">
                      {grupo.instituicao || "Sem instituição"}
                    </p>
                    <p className="tabular text-[13px] text-mist">
                      {formatBRL(grupo.valorTotal)}
                    </p>
                  </div>
                  <Table>
                    {cabecalho}
                    <tbody>
                      {grupo.ativos.map((ativo) => renderLinha(ativo))}
                    </tbody>
                  </Table>
                </div>
              ))}
            </div>
          ) : (
            <Table>
              {cabecalho}
              <tbody>{ativos.map((ativo) => renderLinha(ativo))}</tbody>
            </Table>
          )}

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
                onChange={(e) =>
                  setForm({ ...form, instituicao: e.target.value })
                }
                placeholder="Inter, NuInvest…"
              />
            </div>
            <div>
              <Label htmlFor="dia-aporte">Dia do aporte (opcional)</Label>
              <Input
                id="dia-aporte"
                type="number"
                min={1}
                max={31}
                inputMode="numeric"
                value={form.diaAporte ?? ""}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === "") {
                    setForm({ ...form, diaAporte: null });
                    return;
                  }
                  const n = Math.min(31, Math.max(1, Number(raw)));
                  setForm({ ...form, diaAporte: Number.isNaN(n) ? null : n });
                }}
                placeholder="ex.: 5"
                className="tabular"
              />
              <p className="mt-1.5 text-[11.5px] text-steel">
                Dia do mês em que você costuma aportar. Vira lembrete na
                carteira.
              </p>
            </div>
            <div>
              <Label>Lembrar de atualizar o valor</Label>
              <Select
                value={String(form.revisarACada ?? 0)}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    revisarACada: v === "0" ? null : Number(v),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {opcoesRevisao.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-[11.5px] text-steel">
                Avisa no sino quando estiver perto de vencer, com atalho para
                atualizar.
              </p>
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
                        : "border-transparent",
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
                  {ativos.length > 1 && (
                    <div>
                      <Label>Ativo</Label>
                      <Select
                        value={detalhe.id}
                        onValueChange={(v) => {
                          const proximo = ativos.find((a) => a.id === v);
                          if (proximo) setDetalhe(proximo);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ativos.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.nome} · {a.instituicao}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-1.5 rounded-[14px] border border-stroke bg-surface p-1">
                    {(
                      ["aporte", "resgate", "atualizacao", "dividendo"] as const
                    ).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setMov({ ...mov, tipo: t })}
                        className={cn(
                          "rounded-[10px] py-1.5 text-[12.5px] transition-colors",
                          mov.tipo === t
                            ? t === "dividendo"
                              ? "bg-elevated text-amber"
                              : "bg-elevated text-ice"
                            : "text-steel hover:text-mist",
                        )}
                      >
                        {rotuloMovimento[t]}
                      </button>
                    ))}
                  </div>

                  <div>
                    <Label>
                      {mov.tipo === "atualizacao"
                        ? "Novo valor total"
                        : "Valor"}
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
                    const { Icon, cor } =
                      iconeMovimento[m.tipo] ?? iconeMovimento.atualizacao;
                    return (
                      <div
                        key={m.id}
                        className="group flex items-center gap-3 border-b border-stroke py-2.5 last:border-0"
                      >
                        <Icon
                          className={cn("h-4 w-4", cor)}
                          strokeWidth={1.5}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "flex items-center gap-1.5 text-[13px]",
                              m.tipo === "dividendo"
                                ? "text-amber"
                                : "text-ice",
                            )}
                          >
                            {rotuloMovimento[m.tipo] ?? "Atualização"}
                            {m.tipo === "dividendo" && (
                              <span aria-hidden>💰</span>
                            )}
                          </p>
                          <p className="tabular text-[11.5px] text-steel">
                            {m.dataLabel}
                            {m.nota ? ` · ${m.nota}` : ""}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "tabular text-[13px]",
                            m.tipo === "dividendo" ? "text-amber" : "text-mist",
                          )}
                        >
                          {m.tipo === "dividendo" ? "+" : ""}
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
