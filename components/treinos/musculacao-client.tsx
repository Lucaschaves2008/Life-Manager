"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Dumbbell,
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
import {
  createExercise,
  createRoutine,
  deleteExercise,
  deleteRoutine,
  duplicateRoutine,
  moveExercise,
  updateExercise,
  updateRoutine,
  type ExercicioInput,
} from "@/app/actions/treinos";

export type FichaView = {
  id: string;
  nome: string;
  foco: string | null;
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

const exercicioVazio: ExercicioInput = {
  nome: "",
  grupoMuscular: "Peito",
  series: 3,
  repsAlvo: "8-12",
  cargaAtual: 0,
  descansoSeg: 90,
  observacao: "",
};

export function MusculacaoClient({ fichas }: { fichas: FichaView[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [pending, startSalvar] = useTransition();

  const [treinando, setTreinando] = useState<FichaView | null>(null);
  const [sheetFicha, setSheetFicha] = useState(false);
  const [fichaEditandoId, setFichaEditandoId] = useState<string | null>(null);
  const [formFicha, setFormFicha] = useState({ nome: "", foco: "" });

  const [sheetEx, setSheetEx] = useState<{ routineId: string; id: string | null } | null>(
    null
  );
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
    setFormFicha({ nome: ficha?.nome ?? "", foco: ficha?.foco ?? "" });
    setSheetFicha(true);
  }

  function salvarFicha() {
    startSalvar(async () => {
      if (fichaEditandoId) {
        await updateRoutine(fichaEditandoId, formFicha.nome, formFicha.foco);
        toast.success("Ficha atualizada");
      } else {
        await createRoutine(formFicha.nome, formFicha.foco);
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
            series: ex.series,
            repsAlvo: ex.repsAlvo,
            cargaAtual: ex.cargaAtual,
            descansoSeg: ex.descansoSeg,
            observacao: ex.observacao ?? "",
          }
        : exercicioVazio
    );
  }

  function salvarExercicio() {
    if (!sheetEx) return;
    startSalvar(async () => {
      if (sheetEx.id) {
        await updateExercise(sheetEx.id, formEx);
        toast.success("Exercício atualizado");
      } else {
        await createExercise(sheetEx.routineId, formEx);
        toast.success("Exercício adicionado");
      }
      setSheetEx(null);
    });
  }

  if (fichas.length === 0) {
    return (
      <>
        <Card>
          <EmptyState
            icon={Dumbbell}
            title="Nenhuma ficha criada ainda."
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
      <div className="stagger grid grid-cols-12 gap-6">
        {fichas.map((ficha) => (
          <Card key={ficha.id} className="col-span-12 lg:col-span-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardLabel>{ficha.foco ?? "Sem foco definido"}</CardLabel>
                <p className="mt-1.5 text-[16px] text-paper">{ficha.nome}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="soft"
                  size="sm"
                  onClick={() => setTreinando(ficha)}
                  disabled={ficha.exercicios.length === 0}
                >
                  <Play className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Treinar
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
                      <p className="truncate text-[13.5px] text-ice">{ex.nome}</p>
                      <p className="tabular text-[11.5px] text-steel">
                        {ex.grupoMuscular} · {ex.series}×{ex.repsAlvo} ·{" "}
                        {ex.cargaAtual} kg · {ex.descansoSeg}s
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
            {sheetEx?.id ? "Editar exercício" : "Novo exercício"}
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
  form: { nome: string; foco: string };
  setForm: (v: { nome: string; foco: string }) => void;
  onSalvar: () => void;
  pending: boolean;
}) {
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
