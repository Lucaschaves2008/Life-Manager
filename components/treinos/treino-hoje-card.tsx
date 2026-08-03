"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Dumbbell, Eye, Layers, Play, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardLabel } from "@/components/caverna/card";
import { EmptyState } from "@/components/caverna/empty-state";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ExecucaoTreino, type ExercicioExec } from "@/components/treinos/execucao";
import { FichaPlanilha } from "@/components/treinos/ficha-planilha";
import { createRun } from "@/app/actions/treinos";
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
  const [treinando, setTreinando] = useState<TreinoHojeView | null>(null);
  const [fichaVisualizando, setFichaVisualizando] = useState<TreinoHojeView | null>(null);
  const [cardioVisualizando, setCardioVisualizando] = useState<TreinoHojeView | null>(null);
  const [registrando, setRegistrando] = useState<TreinoHojeView | null>(null);

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
      ) : (
        <ul className="mt-4 flex flex-col">
          {treinos.map((t) => {
            const feito = t.tipo === "cardio" && t.cumprida;
            const IconeCardio = t.tipo === "cardio" ? ICONE_MODALIDADE[t.modalidade] : Dumbbell;
            return (
              <li
                key={`${t.tipo}-${t.id}`}
                className="group flex flex-col gap-3 border-b border-stroke py-3.5 last:border-0 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={cn(
                      "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-mist ring-1 ring-inset ring-[var(--mint-border)] transition-colors duration-300",
                      !feito && "group-hover:text-mint group-hover:ring-[rgba(13,110,253,.35)]"
                    )}
                  >
                    {!feito && (
                      <span className="absolute inset-0 rounded-full bg-mint/0 blur-[6px] transition-colors duration-300 group-hover:bg-mint/15" />
                    )}
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
                        ? `${t.foco ?? "Musculação"} · ${t.exercicios.length} exercícios`
                        : `${t.tipoSessao} · alvo ${formatDistanciaMod(t.kmAlvo, t.modalidade)}`}
                    </p>
                  </div>
                </div>

                {feito ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-mint-soft px-2.5 py-1 text-[11px] font-medium text-mint sm:self-auto">
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                    Concluído
                  </span>
                ) : (
                  <div className="flex shrink-0 items-center gap-2 pl-[52px] sm:pl-0">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        t.tipo === "musculacao" ? setTreinando(t) : setRegistrando(t)
                      }
                    >
                      <Play className="h-3.5 w-3.5" strokeWidth={2} />
                      Treinar agora
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        t.tipo === "musculacao"
                          ? setFichaVisualizando(t)
                          : setCardioVisualizando(t)
                      }
                    >
                      <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Ver treino
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

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

      {/* registro rápido de cardio */}
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
              disabled={kmNum <= 0 || segundos <= 0 || pending}
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
