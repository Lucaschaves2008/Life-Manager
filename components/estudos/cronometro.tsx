"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Maximize2, Minimize2, Pause, Play, Square, X } from "lucide-react";
import { FlipTime } from "@/components/caverna/flip-clock";
import { Button } from "@/components/ui/button";
import {
  finalizarSessao,
  iniciarSessao,
  pausarSessao,
  retomarSessao,
} from "@/app/actions/estudos";
import { formatHoras, type SessaoView } from "@/lib/data/estudos";
import { cn } from "@/lib/utils";

type Tempos = { bruto: number; pausado: number; liquido: number };

function segDaPausa(
  p: { startedAt: string; endedAt: string | null },
  agoraMs: number
): number {
  const ini = Date.parse(p.startedAt);
  const fim = p.endedAt ? Date.parse(p.endedAt) : agoraMs;
  return Math.max(0, Math.round((fim - ini) / 1000));
}

function calcular(s: SessaoView, agoraMs: number): Tempos {
  const ini = Date.parse(s.startedAt);
  const bruto = Math.max(0, Math.round((agoraMs - ini) / 1000));
  const pausado = s.pausas.reduce((t, p) => t + segDaPausa(p, agoraMs), 0);
  return { bruto, pausado, liquido: Math.max(0, bruto - pausado) };
}

const SUGESTOES = ["Trabalho", "Inglês", "Programação", "Leitura", "Projeto LC"];
const METAS = [
  { label: "Livre", min: null },
  { label: "25 min", min: 25 },
  { label: "45 min", min: 45 },
  { label: "1h", min: 60 },
  { label: "1h30", min: 90 },
  { label: "2h", min: 120 },
];

export function Cronometro({
  sessaoInicial,
}: {
  sessaoInicial: SessaoView | null;
}) {
  const router = useRouter();
  const [local, setLocal] = useState<SessaoView | null>(sessaoInicial);
  const [pending, startTransition] = useTransition();
  const [agora, setAgora] = useState(() => Date.now());
  const [cheio, setCheio] = useState(false);
  const [subject, setSubject] = useState("");
  const [metaMin, setMetaMin] = useState<number | null>(null);

  // adota o estado do servidor quando não há ação otimista em voo
  useEffect(() => {
    if (!pending) setLocal(sessaoInicial);
  }, [pending, sessaoInicial]);

  // tique de 1s enquanto houver sessão viva
  useEffect(() => {
    if (!local) return;
    const t = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(t);
  }, [local]);

  const tempos = useMemo(
    () => (local ? calcular(local, agora) : null),
    [local, agora]
  );
  const pausada = local?.pausadaAgora ?? false;

  const comeca = () => {
    const nome = subject.trim() || "Estudo";
    const otimista: SessaoView = {
      id: "pending",
      subject: nome,
      startedAt: new Date(agora).toISOString(),
      endedAt: null,
      emAndamento: true,
      pausadaAgora: false,
      brutoSec: 0,
      liquidoSec: 0,
      pausadoSec: 0,
      rating: 0,
      notes: null,
      targetMinutes: metaMin,
      pausas: [],
    };
    setLocal(otimista);
    startTransition(async () => {
      const id = await iniciarSessao({ subject: nome, targetMinutes: metaMin });
      setLocal((prev) => (prev ? { ...prev, id } : prev));
      router.refresh();
    });
  };

  const pausa = () => {
    if (!local || local.id === "pending") return;
    const nowISO = new Date().toISOString();
    setLocal((prev) =>
      prev
        ? {
            ...prev,
            pausadaAgora: true,
            pausas: [
              ...prev.pausas,
              {
                id: `tmp-${prev.pausas.length}`,
                startedAt: nowISO,
                endedAt: null,
                durationSec: 0,
                label: null,
                aberta: true,
              },
            ],
          }
        : prev
    );
    const id = local.id;
    startTransition(async () => {
      await pausarSessao(id);
      router.refresh();
    });
  };

  const retoma = () => {
    if (!local || local.id === "pending") return;
    const nowISO = new Date().toISOString();
    setLocal((prev) =>
      prev
        ? {
            ...prev,
            pausadaAgora: false,
            pausas: prev.pausas.map((p) =>
              p.aberta ? { ...p, endedAt: nowISO, aberta: false } : p
            ),
          }
        : prev
    );
    const id = local.id;
    startTransition(async () => {
      await retomarSessao(id);
      router.refresh();
    });
  };

  const finaliza = () => {
    if (!local || local.id === "pending") return;
    const id = local.id;
    setLocal(null);
    setCheio(false);
    startTransition(async () => {
      await finalizarSessao(id);
      router.refresh();
    });
  };

  // Esc sai do modo tela cheia
  useEffect(() => {
    if (!cheio) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCheio(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cheio]);

  const rodando = !!local;
  const liquido = tempos?.liquido ?? 0;

  // ---- Painel de controles (reutilizado em normal e tela cheia) ----
  const controles = (grande: boolean) => (
    <div className="flex items-center justify-center gap-3">
      {pausada ? (
        <Button
          variant="primary"
          size={grande ? "md" : "md"}
          onClick={retoma}
          className={grande ? "h-11 px-6 text-[14px]" : ""}
        >
          <Play className="h-4 w-4" strokeWidth={2} fill="currentColor" />
          Retomar
        </Button>
      ) : (
        <Button
          variant="outline"
          onClick={pausa}
          className={grande ? "h-11 px-6 text-[14px]" : ""}
        >
          <Pause className="h-4 w-4" strokeWidth={2} />
          Pausar
        </Button>
      )}
      <Button
        variant="danger"
        onClick={finaliza}
        className={grande ? "h-11 px-6 text-[14px]" : ""}
      >
        <Square className="h-4 w-4" strokeWidth={2} fill="currentColor" />
        Finalizar
      </Button>
    </div>
  );

  const statusLinha = local && (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[12.5px] text-steel">
      <span>
        Bruto{" "}
        <span className="tabular text-mist">
          {formatHoras(tempos?.bruto ?? 0)}
        </span>
      </span>
      <span>
        Descanso{" "}
        <span className="tabular text-mist">
          {formatHoras(tempos?.pausado ?? 0)}
        </span>
      </span>
      {local.pausas.length > 0 && (
        <span>
          {local.pausas.length}{" "}
          {local.pausas.length === 1 ? "parada" : "paradas"}
        </span>
      )}
      {local.targetMinutes && (
        <span>
          Meta{" "}
          <span className="tabular text-mist">{local.targetMinutes} min</span>
        </span>
      )}
    </div>
  );

  return (
    <>
      <div className="flex flex-col items-center gap-7 py-4">
        {/* Assunto + estado */}
        <div className="flex flex-col items-center gap-2">
          {rodando ? (
            <>
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-[12px] font-medium",
                  pausada
                    ? "border-[rgba(245,177,76,.3)] bg-amber-soft text-amber"
                    : "border-[rgba(13,110,253,.3)] bg-mint-soft text-mint"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    pausada ? "bg-amber" : "animate-pulse bg-mint"
                  )}
                />
                {pausada ? "Pausado" : "Estudando"}
              </span>
              <h2 className="display text-[24px] text-paper">{local!.subject}</h2>
            </>
          ) : (
            <p className="microlabel">Pronto para começar</p>
          )}
        </div>

        {/* Cronômetro flip */}
        <div className="relative">
          <FlipTime
            segundos={liquido}
            size="clamp(46px, 8vw, 82px)"
            sempreHoras={liquido >= 3600}
          />
          {rodando && (
            <button
              type="button"
              onClick={() => setCheio(true)}
              aria-label="Abrir em tela cheia"
              className="absolute -right-11 top-1/2 hidden -translate-y-1/2 rounded-full p-2 text-steel transition-colors hover:bg-surface-2 hover:text-mint md:inline-flex"
            >
              <Maximize2 className="h-4.5 w-4.5" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {rodando ? (
          <div className="flex flex-col items-center gap-4">
            {statusLinha}
            {controles(false)}
          </div>
        ) : (
          // ---- Formulário de início ----
          <div className="flex w-full max-w-md flex-col gap-4">
            <div>
              <label className="microlabel mb-2 block">Assunto</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                list="sugestoes-estudo"
                placeholder="Ex.: Trabalho, Inglês, Projeto LC…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") comeca();
                }}
                className="h-11 w-full rounded-[14px] border border-stroke bg-surface-2 px-4 text-[14.5px] text-ice outline-none transition-colors focus:border-[rgba(13,110,253,.4)] placeholder:text-steel"
              />
              <datalist id="sugestoes-estudo">
                {SUGESTOES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="microlabel mb-2 block">Meta (opcional)</label>
              <div className="flex flex-wrap gap-2">
                {METAS.map((m) => (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => setMetaMin(m.min)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors",
                      metaMin === m.min
                        ? "border-[rgba(13,110,253,.4)] bg-mint-soft text-mint"
                        : "border-stroke text-mist hover:border-[rgba(143,169,205,.22)]"
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              variant="primary"
              onClick={comeca}
              disabled={pending}
              className="mt-1 h-11 text-[14px]"
            >
              <Play className="h-4 w-4" strokeWidth={2} fill="currentColor" />
              Começar a estudar
            </Button>
          </div>
        )}
      </div>

      {/* ---- Tela cheia ---- */}
      {cheio &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex animate-[fade-in_220ms_ease-out] flex-col items-center justify-center gap-10 bg-bg">
            <div className="flex flex-col items-center gap-3">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px] font-medium",
                  pausada
                    ? "border-[rgba(245,177,76,.3)] bg-amber-soft text-amber"
                    : "border-[rgba(13,110,253,.3)] bg-mint-soft text-mint"
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    pausada ? "bg-amber" : "animate-pulse bg-mint"
                  )}
                />
                {pausada ? "Pausado" : "Estudando"}
              </span>
              <h2 className="display text-[30px] text-paper">
                {local?.subject}
              </h2>
            </div>

            <FlipTime
              segundos={liquido}
              size="clamp(64px, min(15vw, 22vh), 190px)"
              sempreHoras={liquido >= 3600}
            />

            {statusLinha}
            {controles(true)}

            <button
              type="button"
              onClick={() => setCheio(false)}
              aria-label="Sair da tela cheia"
              className="absolute right-6 top-6 inline-flex items-center gap-2 rounded-full p-2.5 text-steel opacity-50 transition-opacity hover:opacity-100"
            >
              <Minimize2 className="h-5 w-5" strokeWidth={1.5} />
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
