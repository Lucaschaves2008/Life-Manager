import { cn } from "@/lib/utils";

export type DonutSegment = {
  label: string;
  value: number;
  cor: string;
};

/**
 * Donut/anel de progresso SVG com % central grande e legenda por pontinhos.
 * Modo 1: `pct` — anel de progresso simples (ex.: kcal, meta de treinos).
 * Modo 2: `segments` — alocação multi-segmento (ex.: classes de ativos).
 */
export function Donut({
  pct,
  segments,
  size = 148,
  strokeWidth = 12,
  center,
  centerSub,
  cor = "var(--color-mint)",
  legend = false,
  formatValue,
  className,
}: {
  pct?: number;
  segments?: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  center?: React.ReactNode;
  centerSub?: React.ReactNode;
  cor?: string;
  legend?: boolean;
  formatValue?: (v: number) => string;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * radius;
  const total = segments?.reduce((s, x) => s + x.value, 0) ?? 0;

  let offsetAcc = 0;
  const arcs =
    segments && total > 0
      ? segments.map((seg) => {
          const frac = seg.value / total;
          const arc = { ...seg, frac, offset: offsetAcc };
          offsetAcc += frac;
          return arc;
        })
      : null;

  const progress = Math.max(0, Math.min(pct ?? 0, 200)) / 100;

  return (
    <div className={cn("flex items-center gap-5", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-surface-2)"
            strokeWidth={strokeWidth}
          />
          {arcs
            ? arcs.map((arc) => (
                <circle
                  key={arc.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={arc.cor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="butt"
                  strokeDasharray={`${Math.max(arc.frac * circ - 3, 1)} ${circ}`}
                  strokeDashoffset={-arc.offset * circ}
                />
              ))
            : (pct ?? 0) > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={cor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={`${Math.min(progress, 1) * circ} ${circ}`}
                  style={{
                    transition: "stroke-dasharray 800ms cubic-bezier(0.16,1,0.3,1)",
                  }}
                />
              )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-[24px] font-semibold leading-none text-paper">
            {center ?? `${Math.round(pct ?? 0)}%`}
          </span>
          {centerSub && (
            <span className="mt-1 text-[11px] text-steel">{centerSub}</span>
          )}
        </div>
      </div>

      {legend && segments && (
        <ul className="flex flex-col gap-2">
          {segments.map((seg) => (
            <li key={seg.label} className="flex items-center gap-2 text-[13px]">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: seg.cor }}
              />
              <span className="text-mist">{seg.label}</span>
              {total > 0 && (
                <span className="tabular ml-1 text-steel">
                  {Math.round((seg.value / total) * 100)}%
                </span>
              )}
              {formatValue && (
                <span className="tabular ml-auto pl-3 text-ice">
                  {formatValue(seg.value)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
