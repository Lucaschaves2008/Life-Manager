"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Number ticker dos valores hero: anima de 0 até o valor em 1200ms
 * com cubic-bezier(0.16,1,0.3,1). Renderiza via função de formatação.
 */
export function NumberTicker({
  value,
  format,
  duration = 1200,
}: {
  value: number;
  format: (v: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduced) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    // aproximação de cubic-bezier(0.16,1,0.3,1) — ease-out expressivo
    const ease = (t: number) => 1 - Math.pow(1 - t, 4);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(value * ease(t));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);

  return <span suppressHydrationWarning>{format(display)}</span>;
}
