"use client";

import { useMemo, useState, useTransition } from "react";
import { useAcao } from "@/lib/acao-cliente";
import {
  ChevronDown,
  Copy,
  Link2Off,
  Pencil,
  Plus,
  Power,
  Salad,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/table";
import { Card, CardLabel } from "@/components/caverna/card";
import { DotsMenu } from "@/components/caverna/dots-menu";
import { EmptyState } from "@/components/caverna/empty-state";
import { ReceitaForm, type AlimentoOpcao } from "@/components/dieta/receita-form";
import {
  ativarDieta,
  createDieta,
  createRefeicao,
  deleteDieta,
  deleteRefeicao,
  desvincularReceita,
  duplicarDieta,
  updateDieta,
  vincularReceita,
  type DietaInput,
} from "@/app/actions/dieta";
import { rotuloIngrediente } from "@/lib/data/dieta-calc";
import type { Macros, OpcaoView, ReceitaView } from "@/lib/data/dieta";
import { cn } from "@/lib/utils";

const MAX_OPCOES = 4;

export type RefeicaoView = {
  id: string;
  nome: string;
  horario: string | null;
  macros: Macros;
  opcoes: OpcaoView[];
};

export type DietaView = {
  id: string;
  nome: string;
  ativa: boolean;
  metas: Macros;
  totais: Macros;
  refeicoes: RefeicaoView[];
};

const dietaVazia: DietaInput = {
  nome: "",
  metaKcal: 2200,
  metaProt: 160,
  metaCarb: 220,
  metaGord: 60,
};

export function PlanoClient({
  dietas,
  receitas,
  alimentos,
}: {
  dietas: DietaView[];
  receitas: ReceitaView[];
  alimentos: AlimentoOpcao[];
}) {
  const [, executar] = useAcao();
  const [pending, startSalvar] = useTransition();

  const [sheetDieta, setSheetDieta] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<DietaInput>(dietaVazia);

  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [novaRefeicao, setNovaRefeicao] = useState({ nome: "", horario: "" });
  // horário que está escolhendo qual refeição pendurar
  const [escolhendo, setEscolhendo] = useState<string | null>(null);
  const [novaReceita, setNovaReceita] = useState<string | null>(null);

  // O detalhe segue a prop, não uma cópia: assim vincular uma refeição já
  // aparece na hora, sem fechar e reabrir o painel.
  const detalhe = dietas.find((d) => d.id === detalheId) ?? null;

  function abrirDieta(dieta: DietaView | null) {
    setEditandoId(dieta?.id ?? null);
    setForm(
      dieta
        ? {
            nome: dieta.nome,
            metaKcal: dieta.metas.kcal,
            metaProt: dieta.metas.prot,
            metaCarb: dieta.metas.carb,
            metaGord: dieta.metas.gord,
          }
        : dietaVazia
    );
    setSheetDieta(true);
  }

  function salvarDieta() {
    startSalvar(async () => {
      if (editandoId) {
        await updateDieta(editandoId, form);
        toast.success("Dieta atualizada");
      } else {
        await createDieta(form);
        toast.success("Dieta criada");
      }
      setSheetDieta(false);
    });
  }

  const metasCampos: { chave: keyof DietaInput; label: string }[] = [
    { chave: "metaKcal", label: "Kcal" },
    { chave: "metaProt", label: "Proteína (g)" },
    { chave: "metaCarb", label: "Carbo (g)" },
    { chave: "metaGord", label: "Gordura (g)" },
  ];

  return (
    <>
      {dietas.length === 0 ? (
        <Card>
          <EmptyState
            icon={Salad}
            title="Nenhuma dieta montada ainda"
            description="Monte seu plano alimentar com horários e as refeições da sua biblioteca."
            className="py-16"
            action={
              <Button variant="dashed" size="sm" onClick={() => abrirDieta(null)}>
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Criar dieta
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="stagger grid grid-cols-12 gap-6">
          {dietas.map((dieta) => (
            <Card
              key={dieta.id}
              destaque={dieta.ativa}
              className="col-span-12 lg:col-span-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardLabel>
                    {dieta.refeicoes.length}{" "}
                    {dieta.refeicoes.length === 1 ? "refeição" : "refeições"}
                  </CardLabel>
                  <p className="mt-1.5 flex items-center gap-2 text-[16px] text-paper">
                    {dieta.nome}
                    {dieta.ativa && <StatusPill tone="mint">Ativa</StatusPill>}
                  </p>
                </div>
                <DotsMenu
                  items={[
                    ...(dieta.ativa
                      ? []
                      : [
                          {
                            label: "Ativar",
                            icon: Power,
                            onSelect: () =>
                              executar(async () => {
                                await ativarDieta(dieta.id);
                                toast.success(`${dieta.nome} agora é a dieta ativa`);
                              }),
                          },
                        ]),
                    {
                      label: "Editar metas",
                      icon: Pencil,
                      onSelect: () => abrirDieta(dieta),
                    },
                    {
                      label: "Duplicar",
                      icon: Copy,
                      onSelect: () =>
                        executar(async () => {
                          await duplicarDieta(dieta.id);
                          toast.success("Dieta duplicada");
                        }),
                    },
                    {
                      label: "Excluir",
                      icon: Trash2,
                      destructive: true,
                      onSelect: () =>
                        executar(async () => {
                          await deleteDieta(dieta.id);
                          toast.success("Dieta excluída");
                        }),
                    },
                  ]}
                />
              </div>

              <p className="tabular mt-4 text-[13px] text-mist">
                {Math.round(dieta.totais.kcal)} kcal montadas · meta {dieta.metas.kcal}{" "}
                kcal
              </p>
              <p className="tabular mt-1 text-[11.5px] text-steel">
                P {Math.round(dieta.totais.prot)}/{dieta.metas.prot}g · C{" "}
                {Math.round(dieta.totais.carb)}/{dieta.metas.carb}g · G{" "}
                {Math.round(dieta.totais.gord)}/{dieta.metas.gord}g
              </p>

              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setDetalheId(dieta.id)}
              >
                Ver refeições
              </Button>
            </Card>
          ))}

          <div className="col-span-12">
            <Button variant="dashed" size="sm" onClick={() => abrirDieta(null)}>
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Criar dieta
            </Button>
          </div>
        </div>
      )}

      {/* Sheet de metas da dieta */}
      <Sheet open={sheetDieta} onOpenChange={setSheetDieta}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>{editandoId ? "Editar dieta" : "Nova dieta"}</SheetTitle>
          <div className="mt-6 flex flex-col gap-5">
            <div>
              <Label htmlFor="dieta-nome">Nome</Label>
              <Input
                id="dieta-nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Cutting julho, Manutenção…"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {metasCampos.map((campo) => (
                <div key={campo.chave}>
                  <Label htmlFor={`dieta-${campo.chave}`}>{campo.label}</Label>
                  <Input
                    id={`dieta-${campo.chave}`}
                    type="number"
                    min={campo.chave === "metaKcal" ? 1 : 0}
                    value={form[campo.chave] as number}
                    onChange={(e) =>
                      setForm({ ...form, [campo.chave]: Number(e.target.value) || 0 })
                    }
                    className="tabular"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                onClick={salvarDieta}
                disabled={!form.nome.trim() || !(form.metaKcal > 0) || pending}
              >
                {pending ? "Salvando…" : "Salvar"}
              </Button>
              <Button variant="ghost" onClick={() => setSheetDieta(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet dos horários da dieta */}
      <Sheet open={!!detalhe} onOpenChange={(v) => !v && setDetalheId(null)}>
        <SheetContent aria-describedby={undefined}>
          {detalhe && (
            <>
              <SheetTitle>{detalhe.nome}</SheetTitle>
              <p className="mt-1 text-[12.5px] text-steel">
                Cada horário recebe as refeições da sua biblioteca. Com mais de uma,
                você escolhe no dia qual comeu.
              </p>

              <div className="mt-6 flex flex-col gap-4">
                {detalhe.refeicoes.length === 0 && (
                  <p className="text-[13px] text-steel">
                    Nenhum horário nesta dieta ainda.
                  </p>
                )}

                {detalhe.refeicoes.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-[14px] border border-stroke bg-surface-2 p-4"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[14px] text-paper">{r.nome}</p>
                      <div className="flex items-center gap-2">
                        {r.horario && (
                          <span className="tabular text-[11.5px] text-steel">
                            {r.horario}
                          </span>
                        )}
                        <button
                          aria-label={`Excluir ${r.nome}`}
                          onClick={() =>
                            executar(async () => {
                              await deleteRefeicao(r.id);
                              toast.success("Horário excluído da dieta");
                            })
                          }
                          className="rounded-md p-1 text-steel hover:text-coral"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                    <p className="mt-0.5 text-[11px] text-steel">
                      {r.opcoes.length === 0
                        ? "sem refeição vinculada"
                        : r.opcoes.length === 1
                          ? "1 refeição"
                          : `${r.opcoes.length} opções · você escolhe qual comeu no dia`}
                    </p>

                    <div className="mt-3 flex flex-col gap-2">
                      {r.opcoes.map((o) => (
                        <OpcaoVinculada
                          key={o.id}
                          opcao={o}
                          onDesvincular={() =>
                            executar(async () => {
                              await desvincularReceita(o.id);
                              toast.success("Refeição tirada do horário");
                            })
                          }
                        />
                      ))}

                      {escolhendo === r.id ? (
                        <EscolherReceita
                          receitas={receitas}
                          jaVinculadas={r.opcoes.map((o) => o.receitaId)}
                          onEscolher={(receitaId) =>
                            executar(async () => {
                              await vincularReceita(r.id, receitaId);
                              setEscolhendo(null);
                              toast.success("Refeição adicionada ao horário");
                            })
                          }
                          onCriarNova={() => {
                            setNovaReceita(r.id);
                            setEscolhendo(null);
                          }}
                          onCancelar={() => setEscolhendo(null)}
                        />
                      ) : (
                        r.opcoes.length < MAX_OPCOES && (
                          <Button
                            variant="dashed"
                            size="sm"
                            className="w-full"
                            onClick={() => setEscolhendo(r.id)}
                          >
                            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                            {r.opcoes.length === 0
                              ? "Vincular refeição"
                              : `Outra opção (${r.opcoes.length}/${MAX_OPCOES})`}
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                ))}

                <div className="rounded-[14px] border border-dashed border-stroke p-4">
                  <p className="microlabel">Novo horário</p>
                  <div className="mt-3 flex gap-2">
                    <Input
                      aria-label="Nome do horário"
                      value={novaRefeicao.nome}
                      onChange={(e) =>
                        setNovaRefeicao({ ...novaRefeicao, nome: e.target.value })
                      }
                      placeholder="Café da manhã"
                    />
                    <Input
                      aria-label="Horário"
                      value={novaRefeicao.horario}
                      onChange={(e) =>
                        setNovaRefeicao({ ...novaRefeicao, horario: e.target.value })
                      }
                      placeholder="07:30"
                      className="tabular w-24 text-center"
                    />
                  </div>
                  <Button
                    variant="soft"
                    size="sm"
                    className="mt-3"
                    disabled={!novaRefeicao.nome.trim() || pending}
                    onClick={() =>
                      startSalvar(async () => {
                        await createRefeicao(
                          detalhe.id,
                          novaRefeicao.nome,
                          novaRefeicao.horario
                        );
                        setNovaRefeicao({ nome: "", horario: "" });
                        toast.success("Horário criado");
                      })
                    }
                  >
                    Criar horário
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Criar refeição já vinculando no horário que pediu */}
      <ReceitaForm
        aberta={!!novaReceita}
        onOpenChange={(v) => !v && setNovaReceita(null)}
        receita={null}
        alimentos={alimentos}
        aoSalvar={async (receitaId) => {
          const mealId = novaReceita;
          if (!mealId) return;
          await vincularReceita(mealId, receitaId);
          setNovaReceita(null);
        }}
      />
    </>
  );
}

/** Refeição pendurada num horário: macros, ingredientes e o preparo sob demanda. */
function OpcaoVinculada({
  opcao,
  onDesvincular,
}: {
  opcao: OpcaoView;
  onDesvincular: () => void;
}) {
  const [aberta, setAberta] = useState(false);
  const passos = (opcao.descricao ?? "").split("\n").filter((l) => l.trim());

  return (
    <div className="rounded-[11px] border border-stroke bg-surface-1 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12.5px] text-ice">{opcao.nome}</p>
          <p className="tabular mt-0.5 text-[10.5px] text-steel">
            {Math.round(opcao.macros.kcal)} kcal · P {Math.round(opcao.macros.prot)}g · C{" "}
            {Math.round(opcao.macros.carb)}g · G {Math.round(opcao.macros.gord)}g
          </p>
        </div>
        <button
          aria-label={`Tirar ${opcao.nome} do horário`}
          onClick={onDesvincular}
          className="shrink-0 rounded-md p-1 text-steel transition-colors hover:text-coral"
          title="Tirar do horário (a refeição continua na biblioteca)"
        >
          <Link2Off className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>

      {opcao.ingredientes.length > 0 && (
        <p className="mt-1.5 text-[11.5px] text-mist">
          {opcao.ingredientes.map((i) => rotuloIngrediente(i)).join(" · ")}
        </p>
      )}

      {passos.length > 0 && (
        <>
          <button
            onClick={() => setAberta((v) => !v)}
            className="mt-2 flex items-center gap-1.5 text-[11.5px] text-steel transition-colors hover:text-ice"
          >
            <ChevronDown
              className={cn("h-3 w-3 transition-transform", aberta && "rotate-180")}
              strokeWidth={1.5}
            />
            {aberta ? "Esconder o preparo" : "Como faz"}
          </button>
          {aberta && (
            <ol className="mt-2 flex flex-col gap-1 border-l border-stroke pl-3">
              {passos.map((passo, i) => (
                <li key={i} className="text-[11.5px] leading-relaxed text-mist">
                  {passo}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

/** Escolhe uma refeição da biblioteca pra pendurar no horário. */
function EscolherReceita({
  receitas,
  jaVinculadas,
  onEscolher,
  onCriarNova,
  onCancelar,
}: {
  receitas: ReceitaView[];
  jaVinculadas: string[];
  onEscolher: (receitaId: string) => void;
  onCriarNova: () => void;
  onCancelar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase();
  const vinculadas = useMemo(() => new Set(jaVinculadas), [jaVinculadas]);

  const achadas = useMemo(
    () =>
      receitas
        .filter((r) => !vinculadas.has(r.id) && r.nome.toLowerCase().includes(termo))
        .slice(0, 8),
    [receitas, termo, vinculadas]
  );

  return (
    <div className="rounded-[11px] border border-stroke bg-surface-1 p-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-steel"
          strokeWidth={1.5}
        />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar na biblioteca…"
          className="h-8 pl-8"
          autoFocus
        />
      </div>

      <div className="mt-2 flex flex-col">
        {achadas.map((r) => (
          <button
            key={r.id}
            onClick={() => onEscolher(r.id)}
            className="flex items-center justify-between gap-2 rounded-[8px] px-2 py-1.5 text-left text-[12.5px] text-mist transition-colors hover:bg-surface-2 hover:text-ice"
          >
            <span className="truncate">{r.nome}</span>
            <span className="tabular shrink-0 text-[11px] text-steel">
              {Math.round(r.macros.kcal)} kcal
            </span>
          </button>
        ))}
        {achadas.length === 0 && (
          <p className="px-2 py-1.5 text-[12.5px] text-steel">
            {receitas.length === 0
              ? "Sua biblioteca está vazia."
              : "Nenhuma refeição disponível com esse nome."}
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Button variant="soft" size="sm" onClick={onCriarNova}>
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          Criar refeição nova
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
