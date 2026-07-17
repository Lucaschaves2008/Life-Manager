/**
 * Tema único dos gráficos Recharts — nada de visual default.
 * Grid: só linhas horizontais rgba(143,169,205,.06).
 * Eixos: sem linha, sem ticks; labels 11px steel.
 */
export const chart = {
  grid: "rgba(143,169,205,.06)",
  axis: "#4E6A9C",
  mint: "#3EE08F",
  coral: "#FF6B6B",
  coralSoft: "rgba(255,107,107,.55)",
  amber: "#F5B14C",
  steel: "#4E6A9C",
  navy: "#1A3F75",
  mist: "#8FA9CD",
  surface2: "#101a2e",
  elevated: "#16213A",
  stroke: "#1c2a47",
  easing: "cubic-bezier(0.16, 1, 0.3, 1)" as const,
  animMs: 800,
};

export const axisProps = {
  axisLine: false as const,
  tickLine: false as const,
  tick: { fill: chart.axis, fontSize: 11 },
};
