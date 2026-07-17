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
    md: { main: "text-[28px]", small: "text-[15px]" },
    lg: { main: "text-[40px]", small: "text-[18px]" },
    xl: { main: "text-[52px]", small: "text-[22px]" },
  }[size];

  return (
    <span
      className={cn(
        "tabular inline-flex items-baseline gap-1 font-semibold leading-none text-paper",
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
