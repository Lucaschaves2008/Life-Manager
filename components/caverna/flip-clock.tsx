"use client";

import { useEffect, useState } from "react";
import { Oswald } from "next/font/google";
import { TZDate } from "@date-fns/tz";
import { TIMEZONE } from "@/lib/dates";
import { cn } from "@/lib/utils";

// condensado bold, o mesmo desenho dos relógios flip estilo "fliqlo"
const fonteFlip = Oswald({ subsets: ["latin"], weight: "600", display: "swap" });

/** duração total da virada (as duas metades do CSS, 240ms cada) */
const VIRADA_MS = 480;

/**
 * Painel de dois dígitos que "vira" quando o valor muda.
 * Enquanto anima: metade de cima estática já mostra o valor NOVO (revelado
 * conforme a metade velha tomba) e a de baixo segura o valor ANTIGO até a
 * nova descer por cima.
 */
export function FlipPanel({ value, label }: { value: string; label?: string }) {
  const [estado, setEstado] = useState({
    atual: value,
    anterior: value,
    virando: false,
  });

  useEffect(() => {
    setEstado((e) => {
      if (e.atual === value) return e;
      // só o placeholder "--" virando hora não anima; qualquer outra troca
      // (inclusive o 1º segundo do cronômetro, 00 → 01) vira
      return { atual: value, anterior: e.atual, virando: e.atual !== "--" };
    });
  }, [value]);

  // efeito separado: se `atual` estivesse nas deps do de cima, o cleanup
  // mataria este timer antes da hora e `virando` travaria em true
  useEffect(() => {
    if (!estado.virando) return;
    const t = setTimeout(
      () => setEstado((e) => ({ ...e, virando: false })),
      VIRADA_MS
    );
    return () => clearTimeout(t);
  }, [estado.virando, estado.atual]);

  const { atual, anterior, virando } = estado;

  return (
    <div className="flip-panel" aria-hidden>
      {label && <span className="flip-label">{label}</span>}
      {/* servidor e cliente renderizam em instantes diferentes: com sessão
          rodando o segundo difere, e isso é esperado */}
      <div className="flip-half flip-half-top">
        <span suppressHydrationWarning>{atual}</span>
      </div>
      <div className="flip-half flip-half-bottom">
        <span suppressHydrationWarning>{virando ? anterior : atual}</span>
      </div>

      {/* key = valor novo: remonta as metades e reinicia a animação */}
      {virando && (
        <div key={atual} className="flip-anim">
          <div className="flip-half flip-half-top flip-anim-top">
            <span>{anterior}</span>
          </div>
          <div className="flip-half flip-half-bottom flip-anim-bottom">
            <span>{atual}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export type FlipClockProps = {
  /** font-size do painel — comanda todo o tamanho do relógio */
  size?: string;
  /** rótulos "h"/"min" no canto do painel */
  labels?: boolean;
  segundos?: boolean;
  className?: string;
};

/**
 * Relógio de parede em painéis flip (3.5.12), sempre em 24 h e no fuso de SP.
 * Renderiza vazio no servidor: a hora só existe depois de montar no cliente.
 */
export function FlipClock({
  size = "64px",
  labels = false,
  segundos = false,
  className,
}: FlipClockProps) {
  const [agora, setAgora] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setAgora(new TZDate(new Date(), TIMEZONE));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const dois = (n: number) => String(n).padStart(2, "0");
  const hora = agora ? dois(agora.getHours()) : "--";
  const minuto = agora ? dois(agora.getMinutes()) : "--";
  const segundo = agora ? dois(agora.getSeconds()) : "--";

  return (
    <div
      className={cn("flex items-start", fonteFlip.className, className)}
      style={{ fontSize: size, gap: "0.08em" }}
      role="timer"
      aria-label={agora ? `Agora são ${hora}:${minuto}` : "Carregando o relógio"}
      suppressHydrationWarning
    >
      <FlipPanel value={hora} label={labels ? "h" : undefined} />
      <FlipPanel value={minuto} label={labels ? "min" : undefined} />
      {segundos && (
        <FlipPanel value={segundo} label={labels ? "seg" : undefined} />
      )}
    </div>
  );
}

function dois(n: number) {
  return String(Math.floor(Math.abs(n))).padStart(2, "0");
}

export type FlipTimeProps = {
  /** total de segundos decorridos */
  segundos: number;
  /** font-size do painel — comanda todo o tamanho do cronômetro */
  size?: string;
  labels?: boolean;
  /** mostra o painel de horas mesmo com 0h */
  sempreHoras?: boolean;
  className?: string;
};

/**
 * Cronômetro em painéis flip: HH MM SS a partir de um total de segundos.
 * O painel de horas some quando ainda não passou de 1h (a menos de `sempreHoras`).
 */
export function FlipTime({
  segundos,
  size = "64px",
  labels = false,
  sempreHoras = false,
  className,
}: FlipTimeProps) {
  const total = Math.max(0, Math.floor(segundos));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mostraHoras = sempreHoras || h > 0;

  return (
    <div
      className={cn("flex items-start", fonteFlip.className, className)}
      style={{ fontSize: size, gap: "0.08em" }}
      role="timer"
      aria-label={`${h}h ${m}min ${s}s`}
    >
      {mostraHoras && (
        <FlipPanel value={dois(h)} label={labels ? "h" : undefined} />
      )}
      <FlipPanel value={dois(m)} label={labels ? "min" : undefined} />
      <FlipPanel value={dois(s)} label={labels ? "seg" : undefined} />
    </div>
  );
}
