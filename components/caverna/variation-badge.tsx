import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/money";

/**
 * Polaridade de uma métrica: decide se "subir" é bom, ruim, ou nem uma coisa
 * nem outra. Nunca deriva do sinal do número — patrimônio subindo é ótimo,
 * gasto subindo é ruim, cadência não significa nada. `"neutral"` é o caso de
 * métrica sem meta definida pelo usuário (ex.: peso sem meta) — não pode
 * pintar de vermelho um ganho de peso de quem está em bulking.
 */
export type Polaridade = boolean | "neutral";

/**
 * Badge de variação ↗/↘.
 * Semântica fixa: verde = positivo p/ o usuário, coral = negativo, cinza = neutro.
 * `upIsBad` inverte a cor (gastos: subir é ruim), nunca a seta.
 * `upIsBad="neutral"` remove a cor de sinal por completo (sem meta definida).
 */
export function VariationBadge({
  pct,
  upIsBad = false,
  suffix,
  className,
}: {
  pct: number;
  upIsBad?: Polaridade;
  suffix?: string;
  className?: string;
}) {
  const up = pct >= 0;
  const neutral = upIsBad === "neutral";
  const good = upIsBad === true ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium",
        neutral
          ? "bg-surface-2 text-mist"
          : good
          ? "bg-mint-soft text-mint"
          : "bg-coral-soft text-coral",
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {formatPercent(Math.abs(pct), false)}
      {suffix && <span className="font-normal opacity-80">{suffix}</span>}
    </span>
  );
}
