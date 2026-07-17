import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/money";

/**
 * Badge de variação ↗/↘.
 * Semântica fixa: verde = positivo p/ o usuário, coral = negativo.
 * `upIsBad` inverte a cor (gastos: subir é ruim), nunca a seta.
 */
export function VariationBadge({
  pct,
  upIsBad = false,
  suffix,
  className,
}: {
  pct: number;
  upIsBad?: boolean;
  suffix?: string;
  className?: string;
}) {
  const up = pct >= 0;
  const good = upIsBad ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium",
        good ? "bg-mint-soft text-mint" : "bg-coral-soft text-coral",
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {formatPercent(Math.abs(pct), false)}
      {suffix && <span className="font-normal opacity-80">{suffix}</span>}
    </span>
  );
}
