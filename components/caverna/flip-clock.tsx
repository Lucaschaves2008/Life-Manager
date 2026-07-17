"use client";

import { useEffect, useRef, useState } from "react";
import { TZDate } from "@date-fns/tz";
import { TIMEZONE } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Painel de dois dígitos que "vira" quando o valor muda.
 * Enquanto anima: metade de cima estática já mostra o valor NOVO (revelado
 * conforme a metade velha tomba) e a de baixo segura o valor ANTIGO até a
 * nova descer por cima.
 */
function FlipPanel({ value, label }: { value: string; label?: string }) {
  const [estado, setEstado] = useState({
    atual: value,
    anterior: value,
    virando: false,
  });
  // a primeira troca é só o placeholder "--" virando hora: não anima
  const primeiraTroca = useRef(true);

  useEffect(() => {
    setEstado((e) => {
      if (e.atual === value) return e;
      const semAnimacao = primeiraTroca.current;
      primeiraTroca.current = false;
      return { atual: value, anterior: e.atual, virando: !semAnimacao };
    });
  }, [value]);

  // efeito separado: se `atual` estivesse nas deps do de cima, o cleanup
  // mataria este timer antes da hora e `virando` travaria em true
  useEffect(() => {
    if (!estado.virando) return;
    const t = setTimeout(
      () => setEstado((e) => ({ ...e, virando: false })),
      520
    );
    return () => clearTimeout(t);
  }, [estado.virando, estado.atual]);

  const { atual, anterior, virando } = estado;

  return (
    <div className="flex flex-col items-center gap-[0.14em]">
      <div className="flip-panel" aria-hidden>
        <div className="flip-half flip-half-top">
          <span>{atual}</span>
        </div>
        <div className="flip-half flip-half-bottom">
          <span>{virando ? anterior : atual}</span>
        </div>

        {/* key = valor novo: remonta as metades e reinicia a animação */}
        {virando && (
          <div key={atual}>
            <div className="flip-half flip-half-top flip-anim-top">
              <span>{anterior}</span>
            </div>
            <div className="flip-half flip-half-bottom flip-anim-bottom">
              <span>{atual}</span>
            </div>
          </div>
        )}
      </div>
      {label && (
        <span className="text-[0.13em] uppercase tracking-[0.18em] text-steel">
          {label}
        </span>
      )}
    </div>
  );
}

export type FlipClockProps = {
  /** font-size do painel — comanda todo o tamanho do relógio */
  size?: string;
  /** rótulos "horas"/"minutos" sob os painéis */
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
      className={cn("flex items-start gap-[0.12em]", className)}
      style={{ fontSize: size }}
      role="timer"
      aria-label={agora ? `Agora são ${hora}:${minuto}` : "Carregando o relógio"}
      suppressHydrationWarning
    >
      <FlipPanel value={hora} label={labels ? "horas" : undefined} />
      <FlipPanel value={minuto} label={labels ? "minutos" : undefined} />
      {segundos && (
        <FlipPanel value={segundo} label={labels ? "segundos" : undefined} />
      )}
    </div>
  );
}
