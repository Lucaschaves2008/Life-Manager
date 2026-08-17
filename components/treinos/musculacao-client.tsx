"use client";

import { useEffect, useState, useTransition } from "react";
import { useAcao } from "@/lib/acao-cliente";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Dumbbell,
  Eye,
  Files,
  Pencil,
  Play,
  Plus,
  Trash2,
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
import { Card, CardLabel } from "@/components/caverna/card";
import { DotsMenu } from "@/components/caverna/dots-menu";
import { EmptyState } from "@/components/caverna/empty-state";
import { ExecucaoTreino, type ExercicioExec } from "@/components/treinos/execucao";
import { FichaPlanilha } from "@/components/treinos/ficha-planilha";
import { TreinoChooser } from "@/components/treinos/treino-chooser";
import {
  createExercise,
  createRoutine,
  deleteExercise,
  deleteRoutine,
  deleteSession,
  duplicarSemanaExercicios,
  duplicateRoutine,
  moveExercise,
  saveSession,
  setRoutineDias,
  setSemanaAtual,
  updateExercise,
  updateRoutine,
  type ExercicioInput,
} from "@/app/actions/treinos";
import { DIAS_SEMANA_LABEL, formatDiasSemana, formatDuracao } from "@/lib/data/treinos-format";
import { cn } from "@/lib/utils";

export type FichaView = {
  id: string;
  nome: string;
  foco: string | null;
  dias: number[];
  exercicios: ExercicioExec[];
  /** Semanas que já têm pelo menos um exercício — pro seletor de semana. */
  semanasComConteudo: number[];
};

const grupos = [
  "Peito",
  "Costas",
  "Pernas",
  "Ombro",
  "Bíceps",
  "Tríceps",
  "Panturrilha",
  "Abdômen",
];

const metodos = [
  "Nenhum",
  "Bi-set",
  "Tri-set",
  "Drop-set",
  "Superset",
  "Pirâmide",
  "Meta de repetição",
];

const exercicioVazio: ExercicioInput = {
  nome: "",
  grupoMuscular: "Peito",
  metodo: "Nenhum",
  tipoAlvo: "series",
  series: 3,
  repsAlvo: "8-12",
  cargaAtual: 0,
  tempoAlvoSeg: 60,
  descansoSeg: 90,
  observacao: "",
};

export function MusculacaoClient({
  fichas,
  semana,
}: {
  fichas: FichaView[];
  semana: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, executar] = useAcao();
  const [pending, startSalvar] = useTransition();

  const [escolhendo, setEscolhendo] = useState<FichaView | null>(null);
  const [marcandoFeito, setMarcandoFeito] = useState(false);
  const [treinando, setTreinando] = useState<FichaView | null>(null);
  const [visualizando, setVisualizando] = useState<FichaView | null>(null);
  const [sheetFicha, setSheetFicha] = useState(false);
  const [fichaEditandoId, setFichaEditandoId] = useState<string | null>(null);
  const [formFicha, setFormFicha] = useState<{
    nome: string;
    foco: string;
    dias: number[];
  }>({ nome: "", foco: "", dias: [] });

  const [sheetEx, setSheetEx] = useState<{ routineId: string; id: string | null } | null>(null);
  const [formEx, setFormEx] = useState<ExercicioInput>(exercicioVazio);

  const abrirNovo = params.get("novo") === "1";
  useEffect(() => {
    if (abrirNovo && fichas.length > 0) setEscolhendo(fichas[0]);
  }, [abrirNovo, fichas]);

  function limparNovo() {
    if (!abrirNovo) return;
    const next = new URLSearchParams(params.toString());
    next.delete("novo");
    router.replace(`/treinos?${next.toString()}`);
  }

  function marcarFeito(ficha: FichaView) {
    setMarcandoFeito(true);
    startSalvar(async () => {
      try {
        const sessaoId = await saveSession({ routineId: ficha.id, duracaoMin: 0, series: [] });
        toast.success(`${ficha.nome} marcado como feito`, {
          action: {
            label: "Desfazer",
            onClick: () => executar(() => deleteSession(sessaoId)),
          },
        });
        setEscolhendo(null);
        limparNovo();
      } finally {
        setMarcandoFeito(false);
      }
    });
  }

  function abrirFicha(ficha: FichaView | null) {
    setFichaEditandoId(ficha?.id ?? null);
    setFormFicha({
      nome: ficha?.nome ?? "",
      foco: ficha?.foco ?? "",
      dias: ficha?.dias ?? [],
    });
    setSheetFicha(true);
  }

  function salvarFicha() {
    startSalvar(async () => {
      if (fichaEditandoId) {
        await updateRoutine(fichaEditandoId, formFicha.nome, formFicha.foco);
        await setRoutineDias(fichaEditandoId, formFicha.dias);
        toast.success("Ficha atualizada");
      } else {
        const novoId = await createRoutine(formFicha.nome, formFicha.foco);
        if (formFicha.dias.length > 0) await setRoutineDias(novoId, formFicha.dias);
        toast.success("Ficha criada");
      }
      setSheetFicha(false);
    });
  }

  function abrirExercicio(routineId: string, ex: ExercicioExec | null) {
    setSheetEx({ routineId, id: ex?.id ?? null });
    setFormEx(
      ex
        ? {
            nome: ex.nome,
            grupoMuscular: ex.grupoMuscular,
            metodo: ex.metodo,
            tipoAlvo: ex.tipoAlvo,
            series: ex.series,
            repsAlvo: ex.repsAlvo,
            cargaAtual: ex.cargaAtual,
            tempoAlvoSeg: ex.tempoAlvoSeg,
            descansoSeg: ex.descansoSeg,
            observacao: ex.observacao ?? "",
          }
        : exercicioVazio
    );
  }

  // Cada semana é sua própria linha independente: editar sempre grava direto
  // no exercício (updateExercise); criar sempre entra na semana ativa.
  function salvarExercicio() {
    if (!sheetEx) return;
    startSalvar(async () => {
      if (sheetEx.id) {
        await updateExercise(sheetEx.id, formEx);
        toast.success("Exercício atualizado");
      } else {
        await createExercise(sheetEx.routineId, semana, formEx);
        toast.success("Exercício adicionado");
      }
      setSheetEx(null);
    });
  }

  function duplicarSemana(routineId: string, semanaOrigem: number) {
    executar(() => duplicarSemanaExercicios(routineId, semanaOrigem, semana), {
      sucesso: `Semana ${semana} criada a partir da semana ${semanaOrigem}`,
    });
  }

  function irParaSemana(n: number) {
    if (n === semana) return;
    executar(() => setSemanaAtual(n));
  }

  if (fichas.length === 0) {
    return (
      <>
        <Card>
          <EmptyState
            icon={Dumbbell}
            title="Nenhuma ficha criada ainda"
            description="Monte sua ficha com exercícios, séries e cargas para executar no dia do treino."
            className="py-16"
            action={
              <Button variant="dashed" size="sm" onClick={() => abrirFicha(null)}>
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Criar ficha
              </Button>
            }
          />
        </Card>
        <SheetFicha
          aberto={sheetFicha}
          onOpenChange={setSheetFicha}
          editando={!!fichaEditandoId}
          form={formFicha}
          setForm={setFormFicha}
          onSalvar={salvarFicha}
          pending={pending}
        />
      </>
    );
  }

  return (
    <>
      <SeletorSemana semana={semana} fichas={fichas} onIr={irParaSemana} />

      <div className="stagger grid grid-cols-12 gap-6">
        {fichas.map((ficha) => (
          <Card key={ficha.id} className="col-span-12 lg:col-span-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardLabel>{ficha.foco ?? "Sem foco definido"}</CardLabel>
                <p className="mt-1.5 text-[16px] text-paper">{ficha.nome}</p>
                <p className="mt-1 text-[11.5px] text-steel">
                  {formatDiasSemana(ficha.dias)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 lg:gap-1">
                <Button
                  variant="soft"
                  size="sm"
                  onClick={() => setEscolhendo(ficha)}
                  disabled={ficha.exercicios.length === 0}
                  className="lg:w-auto"
                >
                  <Play className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span className="hidden lg:inline">Treinar</span>
                  <span className="lg:hidden">Treino</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVisualizando(ficha)}
                  className="lg:w-auto"
                >
                  <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span className="hidden lg:inline">Ver ficha</span>
                  <span className="lg:hidden">Ficha</span>
                </Button>
                <DotsMenu
                  items={[
                    {
                      label: "Editar ficha",
                      icon: Pencil,
                      onSelect: () => abrirFicha(ficha),
                    },
                    {
                      label: "Duplicar",
                      icon: Copy,
                      onSelect: () =>
                        executar(async () => {
                          await duplicateRoutine(ficha.id);
                          toast.success("Ficha duplicada");
                        }),
                    },
                    {
                      label: "Excluir",
                      icon: Trash2,
                      destructive: true,
                      onSelect: () =>
                        executar(async () => {
                          await deleteRoutine(ficha.id);
                          toast.success("Ficha excluída");
                        }),
                    },
                  ]}
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col">
              {ficha.exercicios.length === 0 ? (
                <SemanaVaziaExercicios
                  ficha={ficha}
                  semana={semana}
                  onDuplicar={duplicarSemana}
                />
              ) : (
                ficha.exercicios.map((ex, i) => (
                  <div
                    key={ex.id}
                    className="group flex items-center gap-3 border-b border-stroke py-2.5 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13.5px] text-ice">{ex.nome}</p>
                        {ex.metodo !== "Nenhum" && (
                          <span className="shrink-0 rounded-full bg-mint-soft px-2 py-0.5 text-[10.5px] font-medium text-mint">
                            {ex.metodo}
                          </span>
                        )}
                      </div>
                      <p className="tabular text-[11.5px] text-steel">
                        {ex.tipoAlvo === "tempo"
                          ? `${ex.grupoMuscular} · ${formatDuracao(ex.tempoAlvoSeg)}`
                          : `${ex.grupoMuscular} · ${ex.series}×${ex.repsAlvo} · ${ex.cargaAtual} kg · ${ex.descansoSeg}s`}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        aria-label="Subir exercício"
                        disabled={i === 0}
                        onClick={() =>
                          executar(() => moveExercise(ex.id, -1))
                        }
                        className="rounded-md p-1 text-steel hover:text-ice disabled:opacity-30"
                      >
                        <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                      <button
                        aria-label="Descer exercício"
                        disabled={i === ficha.exercicios.length - 1}
                        onClick={() =>
                          executar(() => moveExercise(ex.id, 1))
                        }
                        className="rounded-md p-1 text-steel hover:text-ice disabled:opacity-30"
                      >
                        <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                      <button
                        aria-label="Editar exercício"
                        onClick={() => abrirExercicio(ficha.id, ex)}
                        className="rounded-md p-1 text-steel hover:text-ice"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                      <button
                        aria-label="Excluir exercício"
                        onClick={() =>
                          executar(async () => {
                            await deleteExercise(ex.id);
                            toast.success("Exercício excluído");
                          })
                        }
                        className="rounded-md p-1 text-steel hover:text-coral"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Button
              variant="dashed"
              size="sm"
              className="mt-4 w-full"
              onClick={() => abrirExercicio(ficha.id, null)}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              Adicionar exercício
            </Button>
          </Card>
        ))}

        <div className="col-span-12">
          <Button variant="dashed" size="sm" onClick={() => abrirFicha(null)}>
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Criar ficha
          </Button>
        </div>
      </div>

      <TreinoChooser
        aberto={!!escolhendo}
        onOpenChange={(v) => {
          if (!v) {
            setEscolhendo(null);
            limparNovo();
          }
        }}
        titulo={escolhendo?.nome ?? ""}
        subtitulo={
          escolhendo
            ? `${escolhendo.foco ?? "Musculação"} · ${escolhendo.exercicios.length} ${escolhendo.exercicios.length === 1 ? "exercício" : "exercícios"}`
            : undefined
        }
        marcando={marcandoFeito}
        onMarcarFeito={() => escolhendo && marcarFeito(escolhendo)}
        opcaoSecundaria={{
          label: "Começar treino",
          icon: Play,
          onSelect: () => {
            if (escolhendo) setTreinando(escolhendo);
            setEscolhendo(null);
          },
        }}
      />

      {treinando && (
        <ExecucaoTreino
          key={treinando.id}
          aberto={!!treinando}
          onOpenChange={(v) => {
            if (!v) {
              setTreinando(null);
              limparNovo();
            }
          }}
          routineId={treinando.id}
          nomeFicha={treinando.nome}
          exercicios={treinando.exercicios}
        />
      )}

      {/* planilha somente-leitura da ficha — mesma exibição usada no card "Treino de hoje" */}
      <FichaPlanilha
        ficha={
          visualizando
            ? {
                nome: visualizando.nome,
                foco: visualizando.foco,
                semana,
                exercicios: visualizando.exercicios,
              }
            : null
        }
        onOpenChange={(v) => !v && setVisualizando(null)}
      />

      <SheetFicha
        aberto={sheetFicha}
        onOpenChange={setSheetFicha}
        editando={!!fichaEditandoId}
        form={formFicha}
        setForm={setFormFicha}
        onSalvar={salvarFicha}
        pending={pending}
      />

      <Sheet open={!!sheetEx} onOpenChange={(v) => !v && setSheetEx(null)}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>
            {sheetEx?.id
              ? `Editar exercício · Semana ${semana}`
              : `Novo exercício · Semana ${semana}`}
          </SheetTitle>
          <div className="mt-6 flex flex-col gap-5">
            <div>
              <Label htmlFor="ex-nome">Nome</Label>
              <Input
                id="ex-nome"
                value={formEx.nome}
                onChange={(e) => setFormEx({ ...formEx, nome: e.target.value })}
                placeholder="Supino reto, Agachamento…"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Grupo muscular</Label>
                <Select
                  value={formEx.grupoMuscular}
                  onValueChange={(v) => setFormEx({ ...formEx, grupoMuscular: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {grupos.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Método</Label>
                <Select
                  value={formEx.metodo}
                  onValueChange={(v) => setFormEx({ ...formEx, metodo: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {metodos.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Tipo</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {(
                  [
                    { v: "series", label: "Séries e carga" },
                    { v: "tempo", label: "Por tempo" },
                  ] as const
                ).map(({ v, label }) => {
                  const on = (formEx.tipoAlvo ?? "series") === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setFormEx({ ...formEx, tipoAlvo: v })}
                      aria-pressed={on}
                      className={cn(
                        "h-9 rounded-[10px] border text-[12.5px] font-medium transition-colors",
                        on
                          ? "border-[var(--mint-border)] bg-mint-soft text-mint"
                          : "border-stroke bg-surface-2 text-steel hover:text-ice"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-steel">
                Por tempo = sem séries/reps/carga (aquecimento, alongamento…).
              </p>
            </div>

            {formEx.tipoAlvo === "tempo" ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ex-tempo">Duração (s)</Label>
                  <Input
                    id="ex-tempo"
                    type="number"
                    min={5}
                    step={5}
                    value={formEx.tempoAlvoSeg ?? 60}
                    onChange={(e) =>
                      setFormEx({
                        ...formEx,
                        tempoAlvoSeg: Number(e.target.value) || 5,
                      })
                    }
                    className="tabular"
                  />
                </div>
                <div>
                  <Label htmlFor="ex-descanso">Descanso após (s)</Label>
                  <Input
                    id="ex-descanso"
                    type="number"
                    min={0}
                    step={15}
                    value={formEx.descansoSeg}
                    onChange={(e) =>
                      setFormEx({ ...formEx, descansoSeg: Number(e.target.value) || 0 })
                    }
                    className="tabular"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ex-series">Séries</Label>
                    <Input
                      id="ex-series"
                      type="number"
                      min={1}
                      max={10}
                      value={formEx.series}
                      onChange={(e) =>
                        setFormEx({ ...formEx, series: Number(e.target.value) || 1 })
                      }
                      className="tabular"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ex-reps">Repetições alvo</Label>
                    <Input
                      id="ex-reps"
                      value={formEx.repsAlvo}
                      onChange={(e) => setFormEx({ ...formEx, repsAlvo: e.target.value })}
                      placeholder="8-12"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ex-carga">Carga atual (kg)</Label>
                    <Input
                      id="ex-carga"
                      type="number"
                      step="0.5"
                      min={0}
                      value={formEx.cargaAtual}
                      onChange={(e) =>
                        setFormEx({ ...formEx, cargaAtual: Number(e.target.value) || 0 })
                      }
                      className="tabular"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ex-descanso">Descanso (s)</Label>
                    <Input
                      id="ex-descanso"
                      type="number"
                      min={0}
                      step={15}
                      value={formEx.descansoSeg}
                      onChange={(e) =>
                        setFormEx({ ...formEx, descansoSeg: Number(e.target.value) || 0 })
                      }
                      className="tabular"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="ex-obs">Observação</Label>
              <Textarea
                id="ex-obs"
                value={formEx.observacao ?? ""}
                onChange={(e) => setFormEx({ ...formEx, observacao: e.target.value })}
                className="min-h-16"
                placeholder="Pegada fechada, cadência 2-0-2…"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                onClick={salvarExercicio}
                disabled={!formEx.nome.trim() || pending}
              >
                {pending ? "Salvando…" : "Salvar"}
              </Button>
              <Button variant="ghost" onClick={() => setSheetEx(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function SheetFicha({
  aberto,
  onOpenChange,
  editando,
  form,
  setForm,
  onSalvar,
  pending,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  editando: boolean;
  form: { nome: string; foco: string; dias: number[] };
  setForm: (v: { nome: string; foco: string; dias: number[] }) => void;
  onSalvar: () => void;
  pending: boolean;
}) {
  function toggleDia(d: number) {
    setForm({
      ...form,
      dias: form.dias.includes(d)
        ? form.dias.filter((x) => x !== d)
        : [...form.dias, d],
    });
  }
  return (
    <Sheet open={aberto} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>{editando ? "Editar ficha" : "Nova ficha"}</SheetTitle>
        <div className="mt-6 flex flex-col gap-5">
          <div>
            <Label htmlFor="ficha-nome">Nome</Label>
            <Input
              id="ficha-nome"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ficha A"
            />
          </div>
          <div>
            <Label htmlFor="ficha-foco">Foco</Label>
            <Input
              id="ficha-foco"
              value={form.foco}
              onChange={(e) => setForm({ ...form, foco: e.target.value })}
              placeholder="Peito e tríceps"
            />
          </div>
          <div>
            <Label>Dias da semana</Label>
            <div className="mt-1.5 flex gap-1.5">
              {DIAS_SEMANA_LABEL.map((label, d) => {
                const on = form.dias.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDia(d)}
                    aria-pressed={on}
                    className={cn(
                      "h-9 flex-1 rounded-[10px] border text-[11.5px] font-medium transition-colors",
                      on
                        ? "border-[var(--mint-border)] bg-mint-soft text-mint"
                        : "border-stroke bg-surface-2 text-steel hover:text-ice"
                    )}
                  >
                    {label.slice(0, 1)}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-steel">
              Quais dias esta ficha roda (ex.: Seg e Qua).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              onClick={onSalvar}
              disabled={!form.nome.trim() || pending}
            >
              {pending ? "Salvando…" : "Salvar"}
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

/**
 * Salto direto entre semanas — cada pill é uma semana; preenchida quando tem
 * conteúdo em pelo menos uma ficha, tracejada quando ainda está vazia. Mais
 * rápido que ficar clicando "próxima" N vezes pra chegar na semana 6.
 */
function SeletorSemana({
  semana,
  fichas,
  onIr,
}: {
  semana: number;
  fichas: FichaView[];
  onIr: (n: number) => void;
}) {
  const maxComConteudo = Math.max(0, ...fichas.flatMap((f) => f.semanasComConteudo));
  const maxPill = Math.max(1, maxComConteudo + 1, semana);
  const pills = Array.from({ length: maxPill }, (_, i) => i + 1);
  const temConteudo = (n: number) => fichas.some((f) => f.semanasComConteudo.includes(n));

  return (
    <div className="rounded-[14px] border border-stroke bg-surface-2 px-3 py-2.5">
      <CardLabel>Periodização</CardLabel>
      <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {pills.map((n) => (
          <button
            key={n}
            aria-label={`Semana ${n}`}
            aria-current={n === semana}
            onClick={() => onIr(n)}
            className={cn(
              "tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[12.5px] font-medium transition-colors",
              n === semana
                ? "border-transparent bg-mint text-[var(--color-bg)]"
                : temConteudo(n)
                  ? "border-stroke bg-surface text-ice hover:border-[var(--mint-border)]"
                  : "border-dashed border-stroke text-steel hover:text-ice"
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Semana ainda sem exercícios nesta ficha: duplicar de outra semana ou começar do zero. */
function SemanaVaziaExercicios({
  ficha,
  semana,
  onDuplicar,
}: {
  ficha: FichaView;
  semana: number;
  onDuplicar: (routineId: string, semanaOrigem: number) => void;
}) {
  const anteriores = ficha.semanasComConteudo.filter((n) => n < semana).sort((a, b) => b - a);
  const origemSugerida = anteriores[0] ?? ficha.semanasComConteudo[0];

  return (
    <div className="flex flex-col items-center gap-2.5 py-5 text-center">
      <p className="text-[13px] text-steel">
        {ficha.semanasComConteudo.length === 0
          ? "Nenhum exercício nesta ficha."
          : `A semana ${semana} ainda não tem exercícios.`}
      </p>
      {origemSugerida != null && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDuplicar(ficha.id, origemSugerida)}
        >
          <Files className="h-3.5 w-3.5" strokeWidth={1.5} />
          Duplicar da semana {origemSugerida}
        </Button>
      )}
    </div>
  );
}
