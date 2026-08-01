"use client";

import { splitBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import { NumberTicker } from "@/components/caverna/number-ticker";

/**
 * Valor hero: R$ e centavos menores em mist, inteiro grande em paper.
 * Ex.: R$ 611<small>,17</small>
 */
export function HeroMoney({
  centavos,
  className,
  size = "lg",
  ticker = false,
}: {
  centavos: number;
  className?: string;
  size?: "md" | "lg" | "xl";
  ticker?: boolean;
}) {
  const { sinal, inteiro, centavos: cents } = splitBRL(centavos);
  const sizes = {
    md: { main: "text-[clamp(20px,6vw,28px)]", small: "text-[clamp(12px,3.4vw,15px)]" },
    lg: { main: "text-[clamp(24px,8vw,40px)]", small: "text-[clamp(13px,4vw,18px)]" },
    xl: { main: "text-[clamp(28px,10vw,52px)]", small: "text-[clamp(14px,4.6vw,22px)]" },
  }[size];

  return (
    <span
      className={cn(
        "tabular inline-flex max-w-full flex-wrap items-baseline gap-1 font-semibold leading-none text-paper",
        sizes.main,
        className
      )}
    >
      {sinal && <span>{sinal}</span>}
      <span className={cn("font-medium text-mist", sizes.small)}>R$</span>
      {ticker ? (
        <NumberTicker
          value={parseFloat(inteiro.replace(/\./g, ""))}
        />
      ) : (
        <span>{inteiro}</span>
      )}
      <span className={cn("font-medium text-mist", sizes.small)}>,{cents}</span>
    </span>
  );
}
