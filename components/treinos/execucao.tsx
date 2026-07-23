"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  Settings2,
  SkipForward,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { saveSession, type SerieRealizada } from "@/app/actions/treinos";
import { formatDuracao } from "@/lib/data/treinos-format";
import { cn } from "@/lib/utils";

export type ExercicioExec = {
  id: string;
  nome: string;
  grupoMuscular: string;
  metodo: string;
  // "series" (padrão, com reps/carga) | "tempo" (bloco cronometrado, sem métricas — ex.: aquecimento)
  tipoAlvo: string;
  series: number;
  repsAlvo: string;
  cargaAtual: number;
  tempoAlvoSeg: number;
  descansoSeg: number;
  observacao: string | null;
  // periodização: config já resolvida p/ a semana atual (ver weekConfig)
  herdado?: boolean;
  origem?: number;
};

type LinhaSerie = { reps: string; carga: string; feita: boolean };

/** Extrai o alvo superior de "8-12" → 12; de "10" → 10. */
function repsPadrao(repsAlvo: string): string {
  const nums = repsAlvo.match(/\d+/g);
  return nums?.[nums.length - 1] ?? "10";
}

function beep() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
  } catch {
    // ambiente sem AudioContext (SSR/teste) — silencioso
  }
}

export function ExecucaoTreino({
  aberto,
  onOpenChange,
  routineId,
  nomeFicha,
  exercicios: exerciciosProp,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  routineId: string;
  nomeFicha: string;
  exercicios: ExercicioExec[];
}) {
  const router = useRouter();
  const [pending, startSalvar] = useTransition();

  // ordem é local à sessão (não persiste na ficha) — reordenável no menu
  const [ordem, setOrdem] = useState(() => exerciciosProp.map((e) => e.id));
  const exercicios = ordem
    .map((id) => exerciciosProp.find((e) => e.id === id))
    .filter((e): e is ExercicioExec => !!e);

  const [segundos, setSegundos] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);

  const [descanso, setDescanso] = useState<{ restante: number; total: number } | null>(null);
  const avisou = useRef(false);

  const [tempoAtivo, setTempoAtivo] = useState<{ restante: number; total: number } | null>(null);

  const [foco, setFoco] = useState(0);
  const atual = exercicios[foco];

  // série revelada progressivamente: só mostra até esse índice (inclusive)
  const [serieAtual, setSerieAtual] = useState<Record<string, number>>({});

  const [linhas, setLinhas] = useState<Record<string, LinhaSerie[]>>(() =>
    Object.fromEntries(
      exerciciosProp
        .filter((e) => e.tipoAlvo !== "tempo")
        .map((e) => [
          e.id,
          Array.from({ length: e.series }, () => ({
            reps: repsPadrao(e.repsAlvo),
            carga: String(e.cargaAtual),
            feita: false,
          })),
        ])
    )
  );
  const [tempoFeito, setTempoFeito] = useState<Record<string, boolean>>({});
  const [obs, setObs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!aberto || pausado) return;
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [aberto, pausado]);

  useEffect(() => {
    if (descanso == null || pausado) return;
    if (descanso.restante <= 0) {
      if (!avisou.current) {
        avisou.current = true;
        beep();
        toast.success("Descanso concluído — próxima série!");
      }
      return;
    }
    const t = setTimeout(
      () => setDescanso((d) => (d == null ? null : { ...d, restante: d.restante - 1 })),
      1000
    );
    return () => clearTimeout(t);
  }, [descanso, pausado]);

  useEffect(() => {
    if (tempoAtivo == null || pausado) return;
    if (tempoAtivo.restante <= 0) {
      if (!avisou.current) {
        avisou.current = true;
        beep();
        toast.success("Tempo concluído!");
        if (atual) {
          setTempoFeito((t) => ({ ...t, [atual.id]: true }));
          setDescanso({ restante: atual.descansoSeg, total: atual.descansoSeg });
          avisou.current = false;
        }
      }
      setTempoAtivo(null);
      return;
    }
    const t = setTimeout(
      () => setTempoAtivo((v) => (v == null ? null : { ...v, restante: v.restante - 1 })),
      1000
    );
    return () => clearTimeout(t);
  }, [tempoAtivo, pausado, atual]);

  const feitas: SerieRealizada[] = exercicios.flatMap((e) => {
    if (e.tipoAlvo === "tempo") {
      return tempoFeito[e.id] ? [{ exerciseId: e.id, serie: 1, reps: 1, cargaKg: 0 }] : [];
    }
    return (linhas[e.id] ?? [])
      .map((linha, i) => ({ linha, i }))
      .filter(({ linha }) => linha.feita && Number(linha.reps) > 0)
      .map(({ linha, i }) => ({
        exerciseId: e.id,
        serie: i + 1,
        reps: Number(linha.reps),
        cargaKg: Number(linha.carga) || 0,
      }));
  });

  const feitasUnidades = exercicios.reduce(
    (s, e) =>
      s +
      (e.tipoAlvo === "tempo"
        ? tempoFeito[e.id]
          ? 1
          : 0
        : (linhas[e.id] ?? []).filter((l) => l.feita).length),
    0
  );

  function indiceSerieVisivel(exercicioId: string): number {
    return serieAtual[exercicioId] ?? 0;
  }

  function marcarSerie(exercicioId: string, index: number, descansoSeg: number) {
    setLinhas((prev) => {
      const copia = { ...prev };
      const lista = [...copia[exercicioId]];
      lista[index] = { ...lista[index], feita: true };
      copia[exercicioId] = lista;
      return copia;
    });
    avisou.current = false;
    setDescanso({ restante: descansoSeg, total: descansoSeg });
    setSerieAtual((prev) => ({
      ...prev,
      [exercicioId]: Math.min(index + 1, (linhas[exercicioId]?.length ?? 1) - 1),
    }));
  }

  function iniciarTempo(e: ExercicioExec) {
    avisou.current = false;
    setTempoAtivo({ restante: e.tempoAlvoSeg, total: e.tempoAlvoSeg });
  }

  function irPara(i: number) {
    if (i < 0 || i >= exercicios.length) return;
    setFoco(i);
  }

  function mover(id: string, direcao: -1 | 1) {
    setOrdem((prev) => {
      const i = prev.indexOf(id);
      const j = i + direcao;
      if (j < 0 || j >= prev.length) return prev;
      const copia = [...prev];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      // mantém o exercício em foco acompanhando seu item, se for ele
      if (exercicios[foco]?.id === id) setFoco(j);
      return copia;
    });
  }

  function concluir() {
    startSalvar(async () => {
      const duracaoMin = Math.max(1, Math.round(segundos / 60));
      const notas = Object.entries(obs)
        .filter(([, v]) => v.trim())
        .map(([id, v]) => {
          const ex = exercicios.find((e) => e.id === id);
          return `${ex?.nome ?? "Exercício"}: ${v.trim()}`;
        })
        .join("\n");
      await saveSession({
        routineId,
        duracaoMin,
        series: feitas,
        notas: notas || null,
      });
      toast.success(`${nomeFicha} concluído · ${duracaoMin} min`);
      onOpenChange(false);
      router.refresh();
    });
  }

  function fechar() {
    if (feitasUnidades === 0) {
      onOpenChange(false);
      return;
    }
    if (confirm("Sair sem salvar o treino? O progresso desta sessão será perdido.")) {
      onOpenChange(false);
    }
  }

  if (!aberto || !atual) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      {/* topo: só controles, sem competir com o cronômetro */}
      <div className="flex shrink-0 items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          onClick={fechar}
          aria-label="Fechar execução"
          className="rounded-full p-2 text-steel transition-colors hover:bg-surface-2 hover:text-ice"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <button
          onClick={() => setMenuAberto(true)}
          aria-label="Ordem dos exercícios"
          className="rounded-full p-2 text-steel transition-colors hover:bg-surface-2 hover:text-ice"
        >
          <Settings2 className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      {/* o cronômetro geral é o herói da tela — igual o relógio do Strava */}
      <div className="flex shrink-0 flex-col items-center gap-1 pt-2">
        <p className="tabular display text-[92px] leading-none text-paper sm:text-[104px]">
          {formatDuracao(segundos)}
        </p>
        <p className="text-[12px] uppercase tracking-[0.1em] text-steel">Tempo de treino</p>
      </div>

      {/* corpo: contexto do exercício atual — compacto, ele já sabe o que fazer */}
      <div className="flex flex-1 flex-col overflow-y-auto px-5 pt-6">
        <div className="mx-auto flex w-full max-w-[420px] flex-col gap-5 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] text-steel">
                {foco + 1}/{exercicios.length} · {atual.grupoMuscular}
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                <p className="truncate text-[17px] text-paper">{atual.nome}</p>
                {atual.metodo !== "Nenhum" && (
                  <span className="shrink-0 rounded-full bg-mint-soft px-2 py-0.5 text-[10px] font-medium text-mint">
                    {atual.metodo}
                  </span>
                )}
              </div>
            </div>
            {atual.tipoAlvo !== "tempo" && (
              <p className="tabular shrink-0 text-[13px] text-mist">
                alvo {atual.repsAlvo} · {atual.cargaAtual} kg
              </p>
            )}
          </div>

          {atual.tipoAlvo === "tempo" ? (
            <BlocoTempo
              exercicio={atual}
              ativo={tempoAtivo}
              feito={!!tempoFeito[atual.id]}
              onIniciar={() => iniciarTempo(atual)}
            />
          ) : (
            <SerieAtual
              linhas={linhas[atual.id] ?? []}
              indice={indiceSerieVisivel(atual.id)}
              onVoltar={(i) =>
                setSerieAtual((prev) => ({ ...prev, [atual.id]: Math.max(0, i - 1) }))
              }
              onChange={(i, campo, v) =>
                setLinhas((prev) => {
                  const copia = { ...prev };
                  const lista = [...copia[atual.id]];
                  lista[i] = { ...lista[i], [campo]: v };
                  copia[atual.id] = lista;
                  return copia;
                })
              }
              onConcluir={(i) => marcarSerie(atual.id, i, atual.descansoSeg)}
            />
          )}

          {atual.observacao && (
            <p className="text-center text-[12px] text-mist">{atual.observacao}</p>
          )}

          <Textarea
            value={obs[atual.id] ?? ""}
            onChange={(e) => setObs((o) => ({ ...o, [atual.id]: e.target.value }))}
            placeholder="Nota deste exercício (opcional)…"
            className="min-h-9 resize-none border-none bg-transparent text-center text-[12px] placeholder:text-steel focus:bg-surface-2"
          />
        </div>
      </div>

      {/* descanso: card discreto, não-bloqueante */}
      {descanso != null && (
        <div className="mx-4 mb-3 flex shrink-0 items-center gap-3 rounded-[14px] border border-stroke bg-surface-2 px-4 py-2.5">
          <span className="text-[11px] uppercase tracking-[0.08em] text-steel">Descanso</span>
          <span className="tabular flex-1 text-[16px] text-paper">
            {formatDuracao(Math.max(0, descanso.restante))}
          </span>
          <button
            onClick={() => setDescanso(null)}
            className="flex items-center gap-1 text-[12px] text-steel hover:text-ice"
          >
            <SkipForward className="h-3.5 w-3.5" strokeWidth={1.5} />
            Pular
          </button>
        </div>
      )}

      {/* rodapé: play/pause central (Strava) — anterior de um lado, próximo do outro */}
      <div className="flex shrink-0 items-center gap-3 border-t border-stroke px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => irPara(foco - 1)}
          disabled={foco === 0}
          className="flex-1"
        >
          Anterior
        </Button>

        <button
          onClick={() => setPausado((p) => !p)}
          aria-label={pausado ? "Retomar" : "Pausar"}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-mint text-[var(--color-bg)] shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          {pausado ? (
            <Play className="h-6 w-6" strokeWidth={2} />
          ) : (
            <Pause className="h-6 w-6" strokeWidth={2} />
          )}
        </button>

        {foco < exercicios.length - 1 ? (
          <Button variant="soft" onClick={() => irPara(foco + 1)} className="flex-1">
            Próximo
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={concluir}
            disabled={feitasUnidades === 0 || pending}
            className="flex-1"
          >
            {pending ? "Salvando…" : "Concluir"}
          </Button>
        )}
      </div>

      <MenuOrdem
        aberto={menuAberto}
        onOpenChange={setMenuAberto}
        exercicios={exercicios}
        focoId={atual.id}
        onSelecionar={(id) => {
          const i = exercicios.findIndex((e) => e.id === id);
          if (i >= 0) setFoco(i);
          setMenuAberto(false);
        }}
        onMover={mover}
        concluido={(e) =>
          e.tipoAlvo === "tempo"
            ? !!tempoFeito[e.id]
            : (linhas[e.id] ?? []).every((l) => l.feita)
        }
      />
    </div>
  );
}

/** Mostra só a série ATUAL do exercício — revela a próxima ao concluir a anterior. */
function SerieAtual({
  linhas,
  indice,
  onVoltar,
  onChange,
  onConcluir,
}: {
  linhas: LinhaSerie[];
  indice: number;
  onVoltar: (i: number) => void;
  onChange: (i: number, campo: "reps" | "carga", v: string) => void;
  onConcluir: (i: number) => void;
}) {
  const linha = linhas[indice];
  const todasFeitas = linhas.every((l) => l.feita);

  if (!linha) return null;

  if (todasFeitas) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-[14px] border border-stroke bg-surface-2 py-3.5">
        <Check className="h-4 w-4 text-mint" strokeWidth={1.5} />
        <p className="text-[12.5px] text-mist">
          {linhas.length} {linhas.length === 1 ? "série concluída" : "séries concluídas"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full items-center gap-3 rounded-[16px] border border-stroke bg-surface-2 px-4 py-3.5">
      <span className="tabular shrink-0 text-[12px] text-steel">
        Série {indice + 1}/{linhas.length}
      </span>

      <div className="flex flex-1 items-center justify-center gap-2">
        <input
          aria-label="Repetições"
          value={linha.reps}
          inputMode="numeric"
          onChange={(ev) => onChange(indice, "reps", ev.target.value)}
          className="tabular h-10 w-14 rounded-[10px] border border-stroke bg-surface text-center text-[17px] text-paper outline-none focus:border-[var(--mint-border)]"
        />
        <span className="text-[11px] text-steel">reps</span>
        <input
          aria-label="Carga em kg"
          value={linha.carga}
          inputMode="decimal"
          onChange={(ev) => onChange(indice, "carga", ev.target.value)}
          className="tabular h-10 w-16 rounded-[10px] border border-stroke bg-surface text-center text-[17px] text-paper outline-none focus:border-[var(--mint-border)]"
        />
        <span className="text-[11px] text-steel">kg</span>
      </div>

      {indice > 0 && (
        <button
          onClick={() => onVoltar(indice)}
          aria-label="Voltar série"
          className="shrink-0 text-[11px] text-steel hover:text-ice"
        >
          Voltar
        </button>
      )}
      <button
        onClick={() => onConcluir(indice)}
        aria-label="Concluir série"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent bg-mint text-[var(--color-bg)] transition-colors hover:opacity-90"
      >
        <Check className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}

/** Bloco de exercício por tempo (aquecimento/alongamento): sem séries/reps/carga. */
function BlocoTempo({
  exercicio,
  ativo,
  feito,
  onIniciar,
}: {
  exercicio: ExercicioExec;
  ativo: { restante: number; total: number } | null;
  feito: boolean;
  onIniciar: () => void;
}) {
  return (
    <div className="flex w-full items-center gap-3 rounded-[16px] border border-stroke bg-surface-2 px-4 py-3.5">
      <span className="tabular flex-1 text-[17px] text-paper">
        {formatDuracao(ativo ? Math.max(0, ativo.restante) : exercicio.tempoAlvoSeg)}
      </span>
      {feito && !ativo && <span className="text-[11px] text-mist">Concluído</span>}
      <button
        onClick={onIniciar}
        aria-label={feito ? "Repetir" : "Iniciar"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent bg-mint text-[var(--color-bg)] transition-colors hover:opacity-90"
      >
        <Play className="h-4 w-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}

/** Menu de ordem (ícone de engrenagem): reordena só esta sessão, sem afetar a ficha. */
function MenuOrdem({
  aberto,
  onOpenChange,
  exercicios,
  focoId,
  onSelecionar,
  onMover,
  concluido,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  exercicios: ExercicioExec[];
  focoId: string;
  onSelecionar: (id: string) => void;
  onMover: (id: string, direcao: -1 | 1) => void;
  concluido: (e: ExercicioExec) => boolean;
}) {
  return (
    <Sheet open={aberto} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined} className="max-w-[380px]">
        <SheetTitle>Ordem</SheetTitle>
        <p className="mt-1 text-[12.5px] text-steel">
          Vale só para este treino — a ficha não muda.
        </p>
        <div className="mt-5 flex flex-col gap-1">
          {exercicios.map((e, i) => (
            <div
              key={e.id}
              className={cn(
                "flex items-center gap-2 rounded-[12px] px-2 py-1.5 transition-colors",
                e.id === focoId ? "bg-surface-2" : ""
              )}
            >
              <button
                onClick={() => onSelecionar(e.id)}
                className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
              >
                {concluido(e) ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-mint" strokeWidth={2} />
                ) : (
                  <span className="tabular w-3.5 shrink-0 text-[11px] text-steel">
                    {i + 1}
                  </span>
                )}
                <span
                  className={cn(
                    "truncate text-[13.5px]",
                    e.id === focoId ? "text-paper" : "text-ice"
                  )}
                >
                  {e.nome}
                </span>
              </button>
              <div className="flex items-center gap-0.5">
                <button
                  aria-label="Mover para cima"
                  disabled={i === 0}
                  onClick={() => onMover(e.id, -1)}
                  className="rounded-md p-1 text-steel hover:text-ice disabled:opacity-25"
                >
                  <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
                <button
                  aria-label="Mover para baixo"
                  disabled={i === exercicios.length - 1}
                  onClick={() => onMover(e.id, 1)}
                  className="rounded-md p-1 text-steel hover:text-ice disabled:opacity-25"
                >
                  <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
