import { cn } from "@/lib/utils";

export type HeatmapCell = {
  key: string; // "yyyy-MM-dd"
  value: number; // 0 = vazio
  label?: string; // tooltip nativo
};

/**
 * Mapa de calor estilo GitHub.
 * Intensidade proporcional ao valor: escala de surface-2 até `cor`
 * (menta p/ treinos, coral p/ gastos).
 */
export function Heatmap({
  cells,
  cor = "62, 224, 143", // rgb da cor máxima
  columns = 7,
  cellSize = 13,
  gap = 3,
  max,
  className,
}: {
  cells: HeatmapCell[];
  cor?: string;
  columns?: number;
  cellSize?: number;
  gap?: number;
  max?: number;
  className?: string;
}) {
  const computedMax = max ?? Math.max(1, ...cells.map((c) => c.value));

  return (
    <div
      className={cn("grid w-fit", className)}
      style={{
        gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`,
        gap: `${gap}px`,
      }}
    >
      {cells.map((cell) => {
        const t = Math.min(1, cell.value / computedMax);
        const alpha = cell.value === 0 ? 0 : 0.18 + t * 0.72;
        return (
          <div
            key={cell.key}
            title={cell.label}
            className="rounded-[3.5px]"
            style={{
              width: cellSize,
              height: cellSize,
              background:
                cell.value === 0
                  ? "var(--color-surface-2)"
                  : `rgba(${cor}, ${alpha.toFixed(2)})`,
            }}
          />
        );
      })}
    </div>
  );
}
