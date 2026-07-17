"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";
import { FlipClock } from "@/components/caverna/flip-clock";

/**
 * Relógio flip da Home: clicar abre o modo tela cheia (relógio de mesa).
 * Tenta a Fullscreen API; se o navegador recusar, a sobreposição fixa
 * sozinha já cobre a tela.
 */
export function Relogio({ dataLonga }: { dataLonga: string }) {
  const [cheio, setCheio] = useState(false);

  const abrir = useCallback(async () => {
    setCheio(true);
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // sem fullscreen nativo: a sobreposição continua valendo
    }
  }, []);

  const fechar = useCallback(async () => {
    setCheio(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      // sair do fullscreen é best-effort
    }
  }, []);

  // Esc fecha; sair do fullscreen pelo navegador também fecha a sobreposição
  useEffect(() => {
    if (!cheio) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void fechar();
    };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setCheio(false);
    };

    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [cheio, fechar]);

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label="Abrir o relógio em tela cheia"
        className="group hidden cursor-pointer flex-col items-end gap-2 rounded-[16px] p-2 transition-colors hover:bg-surface/60 md:flex"
      >
        <FlipClock size="clamp(38px, 4.4vw, 54px)" />
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-steel transition-colors group-hover:text-mint">
          <Maximize2 className="h-3 w-3" strokeWidth={1.5} />
          tela cheia
        </span>
      </button>

      {/* Portal no body: o header animado (transform) viraria o bloco de
          contenção do `fixed` e prenderia a sobreposição à sua faixa. */}
      {cheio &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex animate-[fade-in_220ms_ease-out] flex-col items-center justify-center gap-9 bg-bg">
            <FlipClock size="clamp(56px, min(15vw, 24vh), 210px)" />
            <p className="text-[15px] text-steel first-letter:uppercase">
              {dataLonga}
            </p>

            <button
              type="button"
              onClick={fechar}
              aria-label="Sair da tela cheia"
              className="absolute right-6 top-6 rounded-full p-2.5 text-steel opacity-40 transition-opacity hover:opacity-100"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
