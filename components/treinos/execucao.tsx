"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, SkipForward, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { saveSession, type SerieRealizada } from "@/app/actions/treinos";
import { formatDuracao, formatTonelagem } from "@/lib/data/treinos";
import { cn } from "@/lib/utils";

export type ExercicioExec = {
  id: string;
  nome: string;
  grupoMuscular: string;
  series: number;
  repsAlvo: string;
  cargaAtual: number;
  descansoSeg: number;
  observacao: string | null;
};

type LinhaSerie = { reps: string; carga: string; feita: boolean };

/** Extrai o alvo superior de "8-12" → 12; de "10" → 10. */
function repsPadrao(repsAlvo: string): string {
  const nums = repsAlvo.match(/\d+/g);
  return nums?.[nums.length - 1] ?? "10";
}

export function ExecucaoTreino({
  aberto,
  onOpenChange,
  routineId,
  nomeFicha,
  exercicios,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  routineId: string;
  nomeFicha: string;
  exercicios: ExercicioExec[];
}) {
  const router = useRouter();
  const [pending, startSalvar] = useTransition();
  const [segundos, setSegundos] = useState(0);
  const [descanso, setDescanso] = useState<number | null>(null);
  const avisou = useRef(false);

  const [linhas, setLinhas] = useState<Record<string, LinhaSerie[]>>(() =>
    Object.fromEntries(
      exercicios.map((e) => [
        e.id,
        Array.from({ length: e.series }, () => ({
          reps: repsPadrao(e.repsAlvo),
          carga: String(e.cargaAtual),
          feita: false,
        })),
      ])
    )
  );

  // cronômetro da sessão
  useEffect(() => {
    if (!aberto) return;
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [aberto]);

  // timer de descanso
  useEffect(() => {
    if (descanso == null) return;
    if (descanso <= 0) {
      if (!avisou.current) {
        avisou.current = true;
        toast.success("Descanso concluído — próxima série!");
      }
      setDescanso(null);
      return;
    }
    const t = setTimeout(() => setDescanso((d) => (d == null ? null : d - 1)), 1000);
    return () => clearTimeout(t);
  }, [descanso]);

  const feitas: SerieRealizada[] = exercicios.flatMap((e) =>
    (linhas[e.id] ?? [])
      .map((linha, i) => ({ linha, i }))
      .filter(({ linha }) => linha.feita && Number(linha.reps) > 0)
      .map(({ linha, i }) => ({
        exerciseId: e.id,
        serie: i + 1,
        reps: Number(linha.reps),
        cargaKg: Number(linha.carga) || 0,
      }))
  );

  const tonelagem = feitas.reduce((s, f) => s + f.reps * f.cargaKg, 0);

  function marcar(exercicioId: string, index: number, descansoSeg: number) {
    setLinhas((atual) => {
      const copia = { ...atual };
      const lista = [...copia[exercicioId]];
      lista[index] = { ...lista[index], feita: !lista[index].feita };
      copia[exercicioId] = lista;
      return copia;
    });
    const jaFeita = linhas[exercicioId]?.[index]?.feita;
    if (!jaFeita) {
      avisou.current = false;
      setDescanso(descansoSeg);
    }
  }

  function concluir() {
    startSalvar(async () => {
      const duracaoMin = Math.max(1, Math.round(segundos / 60));
      await saveSession({ routineId, duracaoMin, series: feitas });
      toast.success(
        `${nomeFicha} concluído · ${duracaoMin} min · ${formatTonelagem(tonelagem)}`
      );
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[88vh] w-[min(760px,94vw)] overflow-y-auto"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <DialogTitle>{nomeFicha}</DialogTitle>
            <p className="mt-1 text-[12.5px] text-steel">
              {feitas.length} de{" "}
              {exercicios.reduce((s, e) => s + e.series, 0)} séries ·{" "}
              <span className="tabular">{formatTonelagem(tonelagem)}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {descanso != null && (
              <span className="tabular inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-3 py-1 text-[13px] text-amber">
                <Timer className="h-3.5 w-3.5" strokeWidth={1.5} />
                {formatDuracao(descanso)}
                <button
                  onClick={() => setDescanso(null)}
                  aria-label="Pular descanso"
                  className="ml-1 text-amber/70 hover:text-amber"
                >
                  <SkipForward className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </span>
            )}
            <span className="tabular rounded-full bg-surface-2 px-3 py-1 text-[13px] text-mist">
              {formatDuracao(segundos)}
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-5">
          {exercicios.map((e) => (
            <div key={e.id} className="rounded-[14px] border border-stroke bg-surface-2 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[14px] text-paper">{e.nome}</p>
                <p className="text-[11.5px] text-steel">
                  {e.grupoMuscular} · {e.series}×{e.repsAlvo} · descanso {e.descansoSeg}s
                </p>
              </div>
              {e.observacao && (
                <p className="mt-1 text-[11.5px] text-steel">{e.observacao}</p>
              )}

              <div className="mt-3 flex flex-col gap-2">
                {(linhas[e.id] ?? []).map((linha, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="tabular w-6 text-[12px] text-steel">{i + 1}</span>
                    <Input
                      aria-label={`Repetições da série ${i + 1}`}
                      value={linha.reps}
                      inputMode="numeric"
                      onChange={(ev) =>
                        setLinhas((atual) => {
                          const copia = { ...atual };
                          const lista = [...copia[e.id]];
                          lista[i] = { ...lista[i], reps: ev.target.value };
                          copia[e.id] = lista;
                          return copia;
                        })
                      }
                      className="tabular h-8.5 w-16 text-center"
                    />
                    <span className="text-[12px] text-steel">reps</span>
                    <Input
                      aria-label={`Carga da série ${i + 1}`}
                      value={linha.carga}
                      inputMode="decimal"
                      onChange={(ev) =>
                        setLinhas((atual) => {
                          const copia = { ...atual };
                          const lista = [...copia[e.id]];
                          lista[i] = { ...lista[i], carga: ev.target.value };
                          copia[e.id] = lista;
                          return copia;
                        })
                      }
                      className="tabular h-8.5 w-20 text-center"
                    />
                    <span className="text-[12px] text-steel">kg</span>
                    <button
                      onClick={() => marcar(e.id, i, e.descansoSeg)}
                      aria-label={`Concluir série ${i + 1}`}
                      className={cn(
                        "ml-auto flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
                        linha.feita
                          ? "border-transparent bg-mint text-[var(--color-bg)]"
                          : "border-stroke text-steel hover:border-mint hover:text-mint"
                      )}
                    >
                      <Check className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button
            variant="primary"
            onClick={concluir}
            disabled={feitas.length === 0 || pending}
          >
            {pending ? "Salvando…" : "Concluir treino"}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Sair sem salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
