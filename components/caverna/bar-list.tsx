import { cn } from "@/lib/utils";

export type BarListItem = {
  id: string;
  label: string;
  emoji?: string;
  /** valor absoluto (para largura relativa) */
  value: number;
  /** rótulo do valor à direita */
  valueLabel: string;
  /** % do orçamento consumido (define a cor); null = sem orçamento */
  budgetPct?: number | null;
  /** % do total (legenda) */
  sharePct?: number;
};

function corDaBarra(budgetPct: number | null | undefined): string {
  if (budgetPct == null) return "var(--color-navy)";
  if (budgetPct > 100) return "var(--color-coral)";
  if (budgetPct >= 70) return "var(--color-amber)";
  return "var(--color-mint)";
}

/**
 * Barras horizontais de top categorias: % do total + consumo do orçamento
 * (verde <70%, âmbar 70–100%, coral >100%).
 */
export function BarList({
  items,
  className,
}: {
  items: BarListItem[];
  className?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className={cn("flex flex-col gap-3.5", className)}>
      {items.map((item) => (
        <div key={item.id}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-ice">
              {item.emoji && <span className="mr-1.5">{item.emoji}</span>}
              {item.label}
              {item.sharePct != null && (
                <span className="tabular ml-2 text-[11.5px] text-steel">
                  {Math.round(item.sharePct)}%
                </span>
              )}
            </span>
            <span className="tabular shrink-0 text-mist">{item.valueLabel}</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{
                width: `${Math.min(100, (item.value / max) * 100)}%`,
                background: corDaBarra(item.budgetPct),
              }}
            />
          </div>
          {item.budgetPct != null && (
            <p className="tabular mt-1 text-[11px] text-steel">
              {Math.round(item.budgetPct)}% do orçamento
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
