import { cn } from "@/lib/utils";

/**
 * Marca LC: "L" e "C" itálicos de corte reto, barras ascendentes no vão do C
 * e o swoosh inferior. As letras herdam `currentColor`; só as barras usam o acento.
 */
export function LcLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 100"
      className={cn("h-6 w-auto text-paper", className)}
      fill="none"
      role="img"
      aria-label="LC"
    >
      <g transform="skewX(-10) translate(4 0)">
        <path
          d="M22 12 L38 6 V54 H80 L74 68 H16 Z"
          fill="currentColor"
        />
        <path
          d="M124 6 H88 A31 31 0 0 0 88 68 H124 L112 54 H90 A17 17 0 0 1 90 20 H112 Z"
          fill="currentColor"
        />
        <rect x="96" y="44" width="7" height="9" rx="1.5" fill="var(--color-steel)" />
        <rect x="107" y="37" width="7" height="16" rx="1.5" fill="var(--color-mist)" />
        <rect x="118" y="30" width="7" height="23" rx="1.5" fill="var(--color-brand)" />
        <path
          d="M28 78 L134 71 L108 86 L10 92 Z"
          fill="currentColor"
          opacity="0.45"
        />
      </g>
    </svg>
  );
}
