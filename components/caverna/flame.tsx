"use client";

/**
 * Foguinho de streak — chama vetorial com profundidade por camadas (corpo +
 * núcleo quente), glow e flicker orgânico. Sem dependências 3D: escala em
 * qualquer tamanho e respeita `prefers-reduced-motion`.
 *
 * COR EVOLUTIVA por streak (estilo Duolingo/TikTok): quanto maior a ofensiva,
 * mais "nobre" a chama fica — do fogo laranja comum até a chama roxa/azul de
 * streaks lendários. Ver `flameTier()`.
 *
 * viewBox 0 0 32 40. Gota-de-fogo simétrica; o "recorte" vem do núcleo claro.
 */

import { useId } from "react";
import { cn } from "@/lib/utils";

export type FlameTier = {
  /** nome do nível, p/ label/debug */
  nome: string;
  /** stops do corpo (base→topo), 4 cores */
  body: [string, string, string, string];
  /** stops do núcleo (base→topo), 3 cores */
  core: [string, string, string];
  /** cor RGB "r,g,b" do halo/glow */
  glowRGB: string;
  /** cor secundária do halo */
  glow2RGB: string;
};

/**
 * Nível da chama pelo streak. As faixas espelham marcos de engajamento:
 * cada patamar "sobe de tier" e muda a cor, dando ao usuário algo novo pra
 * perseguir (o gancho do Duolingo/TikTok).
 */
export function flameTier(streak: number): FlameTier {
  if (streak >= 100)
    // Lendária — chama roxa/violeta
    return {
      nome: "lendária",
      body: ["#6d28d9", "#8b5cf6", "#c084fc", "#f5d0fe"],
      core: ["#a855f7", "#d8b4fe", "#faf5ff"],
      glowRGB: "168,85,247",
      glow2RGB: "99,102,241",
    };
  if (streak >= 50)
    // Azul-quente (transição pro roxo)
    return {
      nome: "azul",
      body: ["#1d4ed8", "#3b82f6", "#38bdf8", "#a5f3fc"],
      core: ["#22d3ee", "#a5f3fc", "#f0fdff"],
      glowRGB: "56,189,248",
      glow2RGB: "59,130,246",
    };
  if (streak >= 30)
    // Fogo bravo — vermelho profundo + branco quente
    return {
      nome: "bravo",
      body: ["#991b1b", "#dc2626", "#f97316", "#fed7aa"],
      core: ["#f97316", "#fdba74", "#fff7ed"],
      glowRGB: "249,115,22",
      glow2RGB: "220,38,38",
    };
  if (streak >= 7)
    // Fogo forte — âmbar/dourado
    return {
      nome: "forte",
      body: ["#b45309", "#f59e0b", "#fbbf24", "#fef3c7"],
      core: ["#fbbf24", "#fde68a", "#fffbeb"],
      glowRGB: "245,158,11",
      glow2RGB: "251,191,36",
    };
  // Comum (1–6) — laranja/vermelho clássico
  return {
    nome: "comum",
    body: ["#c2410c", "#ef4444", "#f59e0b", "#fde68a"],
    core: ["#fbbf24", "#fde68a", "#fffbeb"],
    glowRGB: "245,158,11",
    glow2RGB: "239,68,68",
  };
}

export function Flame({
  streak = 0,
  size = 40,
  className,
  animate = true,
}: {
  streak?: number;
  size?: number;
  className?: string;
  animate?: boolean;
}) {
  const lit = streak > 0;
  const heat = Math.min(1, streak / 30);
  const glow = lit ? 0.35 + heat * 0.45 : 0;
  const tier = flameTier(streak);

  const rawId = useId();
  const uid = `flame${rawId.replace(/:/g, "")}`;
  const on = animate && lit;

  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* halo difuso por trás da chama — cor do tier */}
      {lit && (
        <span
          className={cn("absolute inset-0 rounded-full", on && "flame-glow")}
          style={{
            background: `radial-gradient(circle at 50% 60%, rgba(${tier.glowRGB},${glow}) 0%, rgba(${tier.glow2RGB},${
              glow * 0.5
            }) 42%, transparent 72%)`,
            filter: `blur(${Math.max(2, size * 0.12)}px)`,
          }}
        />
      )}

      <svg
        viewBox="0 0 32 40"
        width={size}
        height={size}
        className={cn("relative", on && "flame-body")}
        style={{ overflow: "visible", transformOrigin: "50% 92%" }}
      >
        <defs>
          <linearGradient id={`${uid}-body`} x1="16" y1="40" x2="16" y2="2" gradientUnits="userSpaceOnUse">
            {lit ? (
              <>
                <stop offset="0" stopColor={tier.body[0]} />
                <stop offset="0.35" stopColor={tier.body[1]} />
                <stop offset="0.7" stopColor={tier.body[2]} />
                <stop offset="1" stopColor={tier.body[3]} />
              </>
            ) : (
              <>
                <stop offset="0" stopColor="var(--color-surface-2)" />
                <stop offset="1" stopColor="var(--color-navy)" />
              </>
            )}
          </linearGradient>

          <linearGradient id={`${uid}-core`} x1="16" y1="38" x2="16" y2="14" gradientUnits="userSpaceOnUse">
            {lit ? (
              <>
                <stop offset="0" stopColor={tier.core[0]} />
                <stop offset="0.55" stopColor={tier.core[1]} />
                <stop offset="1" stopColor={tier.core[2]} />
              </>
            ) : (
              <>
                <stop offset="0" stopColor="var(--color-steel)" stopOpacity="0.5" />
                <stop offset="1" stopColor="var(--color-mist)" stopOpacity="0.3" />
              </>
            )}
          </linearGradient>
        </defs>

        {/* CHAMA EXTERNA — gota de fogo simétrica, sem entalhes */}
        <path
          className={on ? "flame-outer" : undefined}
          style={{ transformOrigin: "50% 88%" }}
          d="M16 2
             C 19 9, 24 12, 26 19
             C 28 24, 28 29, 25.5 33
             C 23.5 36.5, 20 39, 16 39
             C 12 39, 8.5 36.5, 6.5 33
             C 4 29, 4 24, 6 19
             C 7.5 14.5, 9.5 12.5, 10 9
             C 11.5 12, 13.5 12, 13 7
             C 13.4 4.5, 14.6 3, 16 2 Z"
          fill={`url(#${uid}-body)`}
        />

        {/* NÚCLEO QUENTE — menor, deslocado pra base */}
        <path
          className={on ? "flame-inner" : undefined}
          style={{ transformOrigin: "50% 85%" }}
          d="M16.5 15
             C 18.5 20, 21 22.5, 21 27
             C 21 31.5, 19 35, 16 35
             C 13 35, 11 31.5, 11 27.5
             C 11 24, 13 22, 13.5 18
             C 14.5 20.5, 15.8 20, 16.5 15 Z"
          fill={`url(#${uid}-core)`}
          opacity={lit ? 0.95 : 0.5}
        />
      </svg>
    </span>
  );
}
