"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  Dumbbell,
  Eye,
  Layers,
  Pencil,
  Play,
  Plus,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardLabel } from "@/components/caverna/card";
import { EmptyState } from "@/components/caverna/empty-state";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAcao } from "@/lib/acao-cliente";
import { ExecucaoTreino, type ExercicioExec } from "@/components/treinos/execucao";
import { FichaPlanilha } from "@/components/treinos/ficha-planilha";
import { TreinoChooser } from "@/components/treinos/treino-chooser";
import {
  createRun,
  deleteRun,
  deleteSession,
  restoreRun,
  restoreSession,
  saveSession,
} from "@/app/actions/treinos";
import { ICONE_MODALIDADE } from "@/components/treinos/plano-cardio-client";
import {
  MODALIDADE,
  campoDistancia,
  formatDistanciaMod,
  formatRitmo,
  numeroDigitado,
  paraKm,
} from "@/lib/data/treinos-format";
import type { TreinoHojeView } from "@/lib/data/treinos";
import { cn } from "@/lib/utils";

export function TreinoHojeCard({
  treinos,
  hoje,
  hojeLabel,
}: {
  treinos: TreinoHojeView[];
  hoje: string;
  hojeLabel: string;
}) {
  const [, executar] = useAcao();
  const [marcando, startMarcar] = useTransition();

  const [escolhendo, setEscolhendo] = useState<TreinoHojeView | null>(null);
  const [treinando, setTreinando] = useState<TreinoHojeView | null>(null);
  const [fichaVisualizando, setFichaVisualizando] = useState<TreinoHojeView | null>(null);
  const [cardioVisualizando, setCardioVisualizando] = useState<TreinoHojeView | null>(null);
  const [registrando, setRegistrando] = useState<TreinoHojeView | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState(false);

  // Feito hoje some da lista principal e vai pro histórico discreto — a lista
  // acima só mostra o que ainda falta fazer.
  const pendentes = treinos.filter((t) => !t.feito);
  const feitos = treinos.filter((t) => t.feito);

  function marcarFeito(t: TreinoHojeView) {
    startMarcar(async () => {
      try {
        if (t.tipo === "musculacao") {
          const sessaoId = await saveSession({ routineId: t.id, duracaoMin: 0, series: [] });
          toast.success(`${t.nome} marcado como feito`, {
            action: { label: "Desfazer", onClick: () => executar(() => deleteSession(sessaoId)) },
          });
        } else {
          const runId = await createRun({
            data: hoje,
            km: t.kmAlvo,
            segundos: 0,
            tipo: t.tipoSessao,
            modalidade: t.modalidade,
            sensacao: 3,
            notas: null,
            runSessionId: t.id,
            quantificar: true,
          });
          toast.success(`${t.nome} marcado como feito`, {
            action: { label: "Desfazer", onClick: () => executar(() => deleteRun(runId)) },
          });
        }
        setEscolhendo(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível marcar como feito.");
      }
    });
  }

  // Desfazer do histórico apaga o registro, mas oferece "Refazer" — se era uma
  // sessão detalhada (com séries reais, não só o "marcar feito" rápido), o
  // usuário não pode perder o registro sem chance de voltar atrás.
  function desfazer(t: TreinoHojeView) {
    if (!t.registroId) return;
    if (t.tipo === "musculacao") {
      executar(async () => {
        const sessao = await deleteSession(t.registroId!);
        if (!sessao) return;
        toast(`${t.nome} voltou para hoje`, {
          action: {
            label: "Refazer",
            onClick: () =>
              restoreSession({
                data: sessao.data,
                duracaoMin: sessao.duracaoMin,
                notas: sessao.notas,
                routineId: sessao.routineId,
                setLogs: sessao.setLogs.map((s) => ({
                  serie: s.serie,
                  reps: s.reps,
                  cargaKg: s.cargaKg,
                  exerciseId: s.exerciseId,
                })),
              }),
          },
        });
      });
    } else {
      executar(async () => {
        const run = await deleteRun(t.registroId!);
        if (!run) return;
        toast(`${t.nome} voltou para hoje`, {
          action: {
            label: "Refazer",
            onClick: () =>
              restoreRun({
                data: run.data,
                km: run.km,
                segundos: run.segundos,
                tipo: run.tipo,
                modalidade: run.modalidade,
                sensacao: run.sensacao,
                notas: run.notas,
                stravaLink: run.stravaLink,
                runSessionId: run.runSessionId,
                quantificar: run.quantificar,
              }),
          },
        });
      });
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardLabel>Treino de hoje</CardLabel>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-steel">
          <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.5} />
          {hojeLabel}
        </span>
      </div>

      {treinos.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="Nenhum treino agendado para hoje"
          description="Dia livre no plano. Se treinou mesmo assim, registre para manter a sequência."
          action={
            <Button variant="dashed" size="sm" asChild>
              <Link href="/treinos">
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Registrar treino
              </Link>
            </Button>
          }
          className="py-10"
        />
      ) : pendentes.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="Tudo feito por hoje"
          description="Os treinos de hoje já foram marcados. Bom trabalho."
          className="py-10"
        />
      ) : (
        <ul className="mt-4 flex flex-col">
          {pendentes.map((t) => {
            const IconeCardio = t.tipo === "cardio" ? ICONE_MODALIDADE[t.modalidade] : Dumbbell;
            return (
              <li
                key={`${t.tipo}-${t.id}`}
                className="group flex flex-col gap-3 border-b border-stroke py-3.5 last:border-0 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-mist ring-1 ring-inset ring-[var(--mint-border)] transition-colors duration-300 group-hover:text-mint group-hover:ring-[rgba(13,110,253,.35)]">
                    <span className="absolute inset-0 rounded-full bg-mint/0 blur-[6px] transition-colors duration-300 group-hover:bg-mint/15" />
                    <IconeCardio className="relative h-4.5 w-4.5" strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13.5px] text-ice">{t.nome}</p>
                      <span className="tabular shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-medium text-steel">
                        Semana {t.semana}
                      </span>
                    </div>
                    <p className="tabular mt-0.5 text-[11.5px] text-steel">
                      {t.tipo === "musculacao"
                        ? `${t.foco ?? "Musculação"} · ${t.exercicios.length} ${t.exercicios.length === 1 ? "exercício" : "exercícios"}`
                        : `${t.tipoSessao} · alvo ${formatDistanciaMod(t.kmAlvo, t.modalidade)}`}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 pl-[52px] sm:pl-0">
                  <Button variant="primary" size="sm" onClick={() => setEscolhendo(t)}>
                    <Play className="h-3.5 w-3.5" strokeWidth={2} />
                    Treinar agora
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      t.tipo === "musculacao" ? setFichaVisualizando(t) : setCardioVisualizando(t)
                    }
                  >
                    <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Ver treino
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {feitos.length > 0 && (
        <div className="mt-2 border-t border-stroke pt-2">
          <button
            onClick={() => setHistoricoAberto((v) => !v)}
            className="flex w-full items-center justify-between py-2 text-[12px] text-steel transition-colors hover:text-ice"
          >
            <span>
              Feitos hoje · {feitos.length} {feitos.length === 1 ? "treino" : "treinos"}
            </span>
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", historicoAberto && "rotate-180")}
              strokeWidth={1.5}
            />
          </button>
          {historicoAberto && (
            <ul className="flex flex-col">
              {feitos.map((t) => (
                <li
                  key={`${t.tipo}-${t.id}`}
                  className="flex items-center gap-3 border-t border-stroke py-2.5 first:border-0"
                >
                  <p className="min-w-0 flex-1 truncate text-[12.5px] text-mist">{t.nome}</p>
                  <button
                    onClick={() => desfazer(t)}
                    className="flex shrink-0 items-center gap-1 text-[11.5px] text-steel hover:text-ice"
                  >
                    <Undo2 className="h-3 w-3" strokeWidth={1.5} />
                    Desfazer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <TreinoChooser
        aberto={!!escolhendo}
        onOpenChange={(v) => !v && setEscolhendo(null)}
        titulo={escolhendo?.nome ?? ""}
        subtitulo={
          escolhendo
            ? escolhendo.tipo === "musculacao"
              ? `${escolhendo.foco ?? "Musculação"} · ${escolhendo.exercicios.length} ${escolhendo.exercicios.length === 1 ? "exercício" : "exercícios"}`
              : `${escolhendo.tipoSessao} · alvo ${formatDistanciaMod(escolhendo.kmAlvo, escolhendo.modalidade)}`
            : undefined
        }
        marcando={marcando}
        onMarcarFeito={() => escolhendo && marcarFeito(escolhendo)}
        opcaoSecundaria={
          escolhendo?.tipo === "musculacao"
            ? {
                label: "Começar treino",
                icon: Play,
                onSelect: () => {
                  setTreinando(escolhendo);
                  setEscolhendo(null);
                },
              }
            : {
                label: "Registrar com detalhes",
                icon: Pencil,
                onSelect: () => {
                  setRegistrando(escolhendo);
                  setEscolhendo(null);
                },
              }
        }
      />

      {/* execução real da musculação — cronômetro completo já existente */}
      {treinando && treinando.tipo === "musculacao" && (
        <ExecucaoTreino
          key={treinando.id}
          aberto={!!treinando}
          onOpenChange={(v) => !v && setTreinando(null)}
          routineId={treinando.id}
          nomeFicha={treinando.nome}
          exercicios={treinando.exercicios as ExercicioExec[]}
        />
      )}

      {/* planilha somente-leitura da ficha de musculação — mesma exibição usada em Treinos */}
      <FichaPlanilha
        ficha={
          fichaVisualizando?.tipo === "musculacao"
            ? {
                nome: fichaVisualizando.nome,
                foco: fichaVisualizando.foco,
                semana: fichaVisualizando.semana,
                exercicios: fichaVisualizando.exercicios,
              }
            : null
        }
        hojeLabel={hojeLabel}
        onOpenChange={(v) => !v && setFichaVisualizando(null)}
      />

      {/* alvo da sessão de cardio — só consulta */}
      <SessaoCardioSheet
        sessao={cardioVisualizando}
        hojeLabel={hojeLabel}
        onOpenChange={(v) => !v && setCardioVisualizando(null)}
      />

      {/* registro detalhado de cardio */}
      <RegistrarCardioSheet
        sessao={registrando}
        hoje={hoje}
        onOpenChange={(v) => !v && setRegistrando(null)}
      />
    </Card>
  );
}

function SessaoCardioSheet({
  sessao,
  hojeLabel,
  onOpenChange,
}: {
  sessao: TreinoHojeView | null;
  hojeLabel: string;
  onOpenChange: (v: boolean) => void;
}) {
  const treino = sessao?.tipo === "cardio" ? sessao : null;
  return (
    <Sheet open={!!treino} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>{treino?.nome}</SheetTitle>
        <p className="mt-1 text-[12.5px] text-steel">Alvo desta sessão — só consulta.</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-stroke bg-surface-2 px-2.5 py-1 text-[11px] text-mist">
            <CalendarDays className="h-3 w-3" strokeWidth={1.5} />
            {hojeLabel}
          </span>
          {treino && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(13,110,253,.25)] bg-mint-soft px-2.5 py-1 text-[11px] font-medium text-mint">
              <Layers className="h-3 w-3" strokeWidth={1.5} />
              Periodização · Semana {treino.semana}
            </span>
          )}
        </div>

        {treino && (
          <div className="mt-6 flex flex-col gap-3">
            <div className="rounded-[14px] border border-stroke bg-surface-2 px-4 py-3.5">
              <p className="text-[13px] text-mist">Plano</p>
              <p className="mt-0.5 text-[14px] text-paper">{treino.planoNome}</p>
            </div>
            <div className="rounded-[14px] border border-stroke bg-surface-2 px-4 py-3.5">
              <p className="text-[13px] text-mist">Tipo</p>
              <p className="mt-0.5 text-[14px] text-paper">{treino.tipoSessao}</p>
            </div>
            <div className="rounded-[14px] border border-stroke bg-surface-2 px-4 py-3.5">
              <p className="text-[13px] text-mist">Distância alvo</p>
              <p className="tabular mt-0.5 text-[14px] text-paper">
                {formatDistanciaMod(treino.kmAlvo, treino.modalidade)}
              </p>
            </div>
          </div>
        )}

        <div className="mt-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            Fechar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RegistrarCardioSheet({
  sessao,
  hoje,
  onOpenChange,
}: {
  sessao: TreinoHojeView | null;
  hoje: string;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startSalvar] = useTransition();
  const [distancia, setDistancia] = useState("");
  const [h, setH] = useState("0");
  const [min, setMin] = useState("");
  const [seg, setSeg] = useState("");
  const [sensacao, setSensacao] = useState(3);

  const cardio = sessao?.tipo === "cardio" ? sessao : null;
  // A modalidade da sessão manda: um item de natação registra metros, não km.
  const modalidade = cardio?.modalidade ?? "corrida";
  const cfg = MODALIDADE[modalidade];

  // reseta o form sempre que abre para uma sessão nova
  const [ultimoId, setUltimoId] = useState<string | null>(null);
  if (cardio && cardio.id !== ultimoId) {
    setUltimoId(cardio.id);
    setDistancia(campoDistancia(cardio.kmAlvo, cardio.modalidade));
    setH("0");
    setMin("");
    setSeg("");
    setSensacao(3);
  }

  const segundos = (Number(h) || 0) * 3600 + (Number(min) || 0) * 60 + (Number(seg) || 0);
  const kmNum = paraKm(numeroDigitado(distancia), modalidade);
  const ritmo = formatRitmo(segundos, kmNum, modalidade);

  function salvar() {
    if (!cardio) return;
    startSalvar(async () => {
      await createRun({
        data: hoje,
        km: kmNum,
        segundos,
        tipo: cardio.tipoSessao,
        modalidade: cardio.modalidade,
        sensacao,
        notas: "",
        stravaLink: null,
        runSessionId: cardio.id,
      });
      toast.success(`Registrado · ${ritmo}`);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={!!sessao} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>Registrar · {sessao?.nome}</SheetTitle>
        <div className="mt-6 flex flex-col gap-5">
          <div>
            <Label htmlFor="hoje-run-km">Distância ({cfg.unidade})</Label>
            <Input
              id="hoje-run-km"
              inputMode="decimal"
              value={distancia}
              onChange={(e) => setDistancia(e.target.value)}
              placeholder={cfg.placeholderDistancia}
              className="tabular"
            />
          </div>
          <div>
            <Label>Tempo</Label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { v: h, set: setH, ph: "h" },
                { v: min, set: setMin, ph: "min" },
                { v: seg, set: setSeg, ph: "s" },
              ].map((campo) => (
                <Input
                  key={campo.ph}
                  aria-label={campo.ph}
                  inputMode="numeric"
                  value={campo.v}
                  onChange={(e) => campo.set(e.target.value)}
                  placeholder={campo.ph}
                  className="tabular text-center"
                />
              ))}
            </div>
            {ritmo !== "—" && (
              <p className="tabular mt-2 text-[12.5px] text-mint">
                {cfg.ritmoLabel} {ritmo}
              </p>
            )}
          </div>
          <div>
            <Label>Sensação</Label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`Sensação ${n}`}
                  onClick={() => setSensacao(n)}
                  className={cn(
                    "h-6 w-6 rounded-full border transition-colors",
                    n <= sensacao
                      ? "border-transparent bg-mint"
                      : "border-stroke bg-surface-2 hover:border-mint"
                  )}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              onClick={salvar}
              disabled={(kmNum <= 0 && segundos <= 0) || pending}
            >
              {pending ? "Salvando…" : "Salvar"}
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
          {kmNum <= 0 && segundos <= 0 && (
            <p className="text-[12px] text-steel">
              Preencha a distância ou o tempo para salvar.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
