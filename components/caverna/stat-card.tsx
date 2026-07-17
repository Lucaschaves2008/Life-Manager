import { Card, CardLabel } from "@/components/caverna/card";
import { VariationBadge } from "@/components/caverna/variation-badge";
import { cn } from "@/lib/utils";

/**
 * Stat-card: micro-label, número grande, badge de variação + contexto.
 * Apenas UM por linha pode ter `destaque`.
 */
export function StatCard({
  label,
  value,
  pct,
  upIsBad,
  contexto = "vs mês anterior",
  extra,
  destaque = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  pct?: number | null;
  upIsBad?: boolean;
  contexto?: string;
  extra?: React.ReactNode;
  destaque?: boolean;
  className?: string;
}) {
  return (
    <Card destaque={destaque} className={cn("flex flex-col gap-3 p-5", className)}>
      <CardLabel>{label}</CardLabel>
      <div className="tabular text-[26px] font-semibold leading-none text-paper">
        {value}
      </div>
      <div className="mt-auto flex items-center gap-2 text-[12.5px] text-steel">
        {typeof pct === "number" && (
          <VariationBadge pct={pct} upIsBad={upIsBad} />
        )}
        {extra ?? <span>{contexto}</span>}
      </div>
    </Card>
  );
}
