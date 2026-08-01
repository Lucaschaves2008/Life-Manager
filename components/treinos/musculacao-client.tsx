"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Dumbbell,
  Eye,
  Pencil,
  Play,
  Plus,
  RotateCcw,
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
import {
  createExercise,
  createRoutine,
  deleteExercise,
  deleteRoutine,
  duplicateRoutine,
  moveExercise,
  resetWeekExercise,
  setRoutineDias,
  setSemanaAtual,
  setWeekExercise,
  updateExercise,
  updateExerciseMeta,
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

const metodos = ["Nenhum", "Bi-set", "Tri-set", "Drop-set", "Superset"];

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
  const [, startTransition] = useTransition();
  const [pending, startSalvar] = useTransition();

  const [treinando, setTreinando] = useState<FichaView | null>(null);
  const [visualizando, setVisualizando] = useState<FichaView | null>(null);
  const [sheetFicha, setSheetFicha] = useState(false);
  const [fichaEditandoId, setFichaEditandoId] = useState<string | null>(null);
  const [formFicha, setFormFicha] = useState<{
    nome: string;
    foco: string;
    dias: number[];
  }>({ nome: "", foco: "", dias: [] });

  const [sheetEx, setSheetEx] = useState<{
    routineId: string;
    id: string | null;
    herdado: boolean;
    origem: number;
  } | null>(null);
  const [formEx, setFormEx] = useState<ExercicioInput>(exercicioVazio);

  const abrirNovo = params.get("novo") === "1";
  useEffect(() => {
    if (abrirNovo && fichas.length > 0) setTreinando(fichas[0]);
  }, [abrirNovo, fichas]);

  function limparNovo() {
    if (!abrirNovo) return;
    const next = new URLSearchParams(params.toString());
    next.delete("novo");
    router.replace(`/treinos?${next.toString()}`);
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
    setSheetEx({
      routineId,
      id: ex?.id ?? null,
      herdado: ex?.herdado ?? false,
      origem: ex?.origem ?? 1,
    });
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

  // A partir da semana 2, séries/reps/carga vão para o override daquela semana
  // (setWeekExercise) e os metadados (nome/grupo/método/descanso/obs), que não
  // variam por semana, vão por updateExerciseMeta — sem tocar a base da sem. 1.
  // Exercícios por tempo (aquecimento/alongamento) não têm periodização: sempre
  // salvam via updateExerciseMeta, mesmo na semana 1.
  function salvarExercicio() {
    if (!sheetEx) return;
    const porTempo = formEx.tipoAlvo === "tempo";
    startSalvar(async () => {
      if (sheetEx.id) {
        if (semana > 1 && !porTempo) {
          await setWeekExercise(sheetEx.id, semana, {
            series: formEx.series,
            repsAlvo: formEx.repsAlvo,
            cargaAtual: formEx.cargaAtual,
          });
          await updateExerciseMeta(sheetEx.id, {
            nome: formEx.nome,
            grupoMuscular: formEx.grupoMuscular,
            metodo: formEx.metodo ?? "Nenhum",
            descansoSeg: formEx.descansoSeg,
            observacao: formEx.observacao,
            tipoAlvo: formEx.tipoAlvo,
            tempoAlvoSeg: formEx.tempoAlvoSeg,
          });
          toast.success(`Semana ${semana} atualizada`);
        } else {
          await updateExercise(sheetEx.id, formEx);
          toast.success("Exercício atualizado");
        }
      } else {
        await createExercise(sheetEx.routineId, formEx);
        toast.success("Exercício adicionado");
      }
      setSheetEx(null);
    });
  }

  function resetarSemana() {
    if (!sheetEx?.id || semana <= 1) return;
    startSalvar(async () => {
      await resetWeekExercise(sheetEx.id!, semana);
      toast.success(`Semana ${semana} voltou a herdar`);
      setSheetEx(null);
    });
  }

  function mudarSemana(delta: number) {
    const alvo = Math.max(1, semana + delta);
    if (alvo === semana) return;
    startTransition(() => void setSemanaAtual(alvo));
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
      <SeletorSemana semana={semana} onMudar={mudarSemana} />

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
                  onClick={() => setTreinando(ficha)}
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
                        startTransition(async () => {
                          await duplicateRoutine(ficha.id);
                          toast.success("Ficha duplicada");
                        }),
                    },
                    {
                      label: "Excluir",
                      icon: Trash2,
                      destructive: true,
                      onSelect: () =>
                        startTransition(async () => {
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
                <p className="py-3 text-[13px] text-steel">
                  Nenhum exercício nesta ficha.
                </p>
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
                          startTransition(() => void moveExercise(ex.id, -1))
                        }
                        className="rounded-md p-1 text-steel hover:text-ice disabled:opacity-30"
                      >
                        <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                      <button
                        aria-label="Descer exercício"
                        disabled={i === ficha.exercicios.length - 1}
                        onClick={() =>
                          startTransition(() => void moveExercise(ex.id, 1))
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
                          startTransition(async () => {
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
              ? semana > 1
                ? `Editar exercício · Semana ${semana}`
                : "Editar exercício"
              : "Novo exercício"}
          </SheetTitle>
          {sheetEx?.id && semana > 1 && (
            <div className="mt-4 rounded-[12px] border border-stroke bg-surface-2 px-3.5 py-3">
              <p className="text-[12px] text-mist">
                {sheetEx.herdado
                  ? `Séries, reps e carga estão herdando da semana ${sheetEx.origem}. Editar cria uma versão própria para a semana ${semana} (e as seguintes até você mudar de novo).`
                  : `Você está editando a versão da semana ${semana}. Nome, grupo e descanso valem para todas as semanas.`}
              </p>
              {!sheetEx.herdado && (
                <button
                  onClick={resetarSemana}
                  className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-steel hover:text-ice"
                >
                  <RotateCcw className="h-3 w-3" strokeWidth={1.5} />
                  Resetar semana {semana} (voltar a herdar)
                </button>
              )}
            </div>
          )}
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

/** Navegação entre semanas do ciclo (virada manual). Semana mín. = 1. */
function SeletorSemana({
  semana,
  onMudar,
}: {
  semana: number;
  onMudar: (delta: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-[14px] border border-stroke bg-surface-2 px-3 py-2.5">
      <div>
        <CardLabel>Periodização</CardLabel>
        <p className="mt-0.5 text-[14px] text-paper">Semana {semana}</p>
      </div>
      <div className="flex items-center gap-1">
        <button
          aria-label="Semana anterior"
          disabled={semana <= 1}
          onClick={() => onMudar(-1)}
          className="rounded-[10px] border border-stroke p-2 text-steel transition-colors hover:text-ice disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <button
          aria-label="Próxima semana"
          onClick={() => onMudar(1)}
          className="rounded-[10px] border border-stroke p-2 text-steel transition-colors hover:text-ice"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
