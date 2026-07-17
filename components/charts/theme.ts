/**
 * Tema único dos gráficos Recharts — nada de visual default.
 * Grid: só linhas horizontais rgba(143,169,205,.06).
 * Eixos: sem linha, sem ticks; labels 11px steel.
 */
export const chart = {
  grid: "var(--grid-line)",
  axis: "var(--color-steel)",
  mint: "var(--color-mint)",
  coral: "var(--color-coral)",
  coralSoft: "var(--color-coral-soft)",
  amber: "var(--color-amber)",
  steel: "var(--color-steel)",
  navy: "var(--color-navy)",
  mist: "var(--color-mist)",
  surface2: "var(--color-surface-2)",
  elevated: "var(--color-elevated)",
  stroke: "var(--color-stroke)",
  easing: "cubic-bezier(0.16, 1, 0.3, 1)" as const,
  animMs: 800,
};

export const axisProps = {
  axisLine: false as const,
  tickLine: false as const,
  tick: { fill: chart.axis, fontSize: 11 },
};
