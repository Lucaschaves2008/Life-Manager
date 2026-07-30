"use client";

/**
 * Celebração de streak estilo Duolingo/TikTok. Recebe o `streak` atual (do
 * server) e compara com o último valor que o usuário JÁ VIU (localStorage).
 * Se o foguinho subiu, embaça TODA a tela (glassmorphism) e mostra o foguinho
 * grande PERFEITAMENTE CENTRALIZADO por ~2,5s (marcos duram mais).
 *
 * IMPORTANTE — renderizado via Portal no <body>: o topbar tem backdrop-blur,
 * que cria um containing block e faria um `position:fixed` interno ancorar no
 * header em vez da viewport. O portal escapa disso e centraliza de verdade.
 *
 * A cor do foguinho evolui com o streak (ver flameTier): laranja → dourado →
 * fogo bravo → azul → roxo lendário. Some sozinho; clicar dispensa antes.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Flame, flameTier } from "@/components/caverna/flame";

const STORAGE_KEY = "lc-streak-visto";
const MARCOS = [1, 5, 7, 10, 15, 30, 50, 75, 100, 150, 200, 365];

function ehMarco(n: number) {
  return MARCOS.includes(n) || (n > 100 && n % 100 === 0);
}

function copyDoStreak(streak: number, marco: boolean): { titulo: string; sub: string } {
  if (marco) {
    if (streak >= 365) return { titulo: "Um ano de ofensiva!", sub: "Chama lendária — você é implacável." };
    if (streak >= 100) return { titulo: `${streak} dias · chama lendária!`, sub: "O foguinho ficou roxo. Território de lenda." };
    if (streak >= 50) return { titulo: `${streak} dias seguidos!`, sub: "A chama virou azul — nível raro." };
    if (streak >= 30) return { titulo: `${streak} dias seguidos!`, sub: "Fogo bravo. Isso virou seu estilo de vida." };
    if (streak >= 10) return { titulo: `${streak} dias seguidos!`, sub: "O hábito está pegando fogo." };
    if (streak >= 7) return { titulo: `${streak} dias · chama forte!`, sub: "Uma semana inteira. Fogo mais intenso." };
    if (streak >= 5) return { titulo: `${streak} dias seguidos!`, sub: "Consistência de verdade." };
    return { titulo: "Foguinho aceso!", sub: "O primeiro dia da sua ofensiva." };
  }
  return { titulo: `${streak} dias seguidos`, sub: "Foguinho mantido — bora amanhã de novo." };
}

export function StreakCelebration({ streak }: { streak: number }) {
  const [montado, setMontado] = useState(false);
  const [mostrar, setMostrar] = useState<null | { streak: number; marco: boolean }>(null);
  const [saindo, setSaindo] = useState(false);

  // createPortal só no cliente (evita mismatch de SSR)
  useEffect(() => setMontado(true), []);

  useEffect(() => {
    let visto = 0;
    try {
      visto = parseInt(window.localStorage.getItem(STORAGE_KEY) ?? "0", 10) || 0;
    } catch {
      visto = 0;
    }
    if (streak > visto) setMostrar({ streak, marco: ehMarco(streak) });
    try {
      window.localStorage.setItem(STORAGE_KEY, String(streak));
    } catch {
      /* localStorage indisponível — só não persiste */
    }
  }, [streak]);

  useEffect(() => {
    if (!mostrar) return;
    const dur = mostrar.marco ? 3400 : 2600;
    const t1 = setTimeout(() => setSaindo(true), dur - 400);
    const t2 = setTimeout(() => {
      setMostrar(null);
      setSaindo(false);
    }, dur);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [mostrar]);

  if (!montado || !mostrar) return null;

  const { streak: s, marco } = mostrar;
  const { titulo } = copyDoStreak(s, marco);
  const tier = flameTier(s);

  const fechar = () => {
    setSaindo(true);
    setTimeout(() => {
      setMostrar(null);
      setSaindo(false);
    }, 400);
  };

  const overlay = (
    // Overlay ocupa a viewport inteira e centraliza o conteúdo (V + H).
    // O glassmorphism (blur + leve escurecida) é aplicado aqui, na tela toda.
    <div
      className="streak-overlay fixed inset-0 z-[9999] flex items-center justify-center"
      data-leaving={saindo}
      onClick={fechar}
      role="status"
      aria-live="polite"
      aria-label={titulo}
    >
      {/* conteúdo centralizado — coluna, tudo empilhado no meio da tela */}
      <div className="relative flex flex-col items-center">
        {/* halo grande atrás do foguinho — cor do tier */}
        <span
          className="pointer-events-none absolute left-1/2 top-[52px] h-[440px] w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: `radial-gradient(circle, rgba(${tier.glowRGB},.30) 0%, rgba(${tier.glow2RGB},.13) 42%, transparent 70%)`,
            filter: "blur(34px)",
          }}
        />

        {/* raios de marco — wrapper centraliza; filho só gira (rotate puro) */}
        {marco && (
          <div className="pointer-events-none absolute left-1/2 top-[52px] h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2">
            <span
              className="streak-rays block h-full w-full"
              style={{
                background: `conic-gradient(from 0deg, transparent 0deg, rgba(${tier.glowRGB},.22) 6deg, transparent 14deg, transparent 24deg, rgba(${tier.glowRGB},.22) 30deg, transparent 38deg)`,
                maskImage: "radial-gradient(circle, transparent 30%, black 42%, transparent 72%)",
                WebkitMaskImage: "radial-gradient(circle, transparent 30%, black 42%, transparent 72%)",
              }}
            />
          </div>
        )}

        {/* faíscas subindo ao redor da chama */}
        <div className="pointer-events-none absolute left-1/2 top-[52px] -translate-x-1/2">
          {SPARKS.map((sp, i) => (
            <span
              key={i}
              className="streak-spark absolute rounded-full"
              style={{
                left: 0,
                top: 0,
                width: sp.size,
                height: sp.size,
                background: sp.cor,
                animationDelay: `${sp.delay}ms`,
                // @ts-expect-error CSS custom props
                "--spark-dx": `${sp.dx}px`,
                "--spark-dy": `${sp.dy}px`,
              }}
            />
          ))}
        </div>

        {/* foguinho grande — o centro de tudo */}
        <div className="streak-pop relative">
          <Flame streak={Math.max(s, 1)} size={marco ? 148 : 124} />
        </div>

        {/* número gigante */}
        <p className="streak-copy tabular relative mt-1 text-[72px] font-bold leading-none text-paper">
          {s}
        </p>

        {/* copy — só o título (sem subtítulo) */}
        <div className="streak-copy relative mt-3 flex flex-col items-center px-6 text-center">
          <p className="text-[20px] font-semibold text-ice">{titulo}</p>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

// faíscas pré-computadas (posições estáticas — nada de Math.random no render)
const SPARKS = [
  { size: 6, dx: -40, dy: -120, cor: "#fcd34d", delay: 120 },
  { size: 5, dx: 38, dy: -140, cor: "#f59e0b", delay: 0 },
  { size: 7, dx: -10, dy: -160, cor: "#fbbf24", delay: 260 },
  { size: 5, dx: 48, dy: -100, cor: "#fde68a", delay: 340 },
  { size: 4, dx: -54, dy: -88, cor: "#f59e0b", delay: 180 },
  { size: 6, dx: 18, dy: -148, cor: "#fde68a", delay: 440 },
  { size: 4, dx: -28, dy: -132, cor: "#fcd34d", delay: 540 },
];
