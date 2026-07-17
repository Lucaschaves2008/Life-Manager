"use client";

/** Sparkline SVG puro — linha 1.5px, sem eixos, ponto no último valor. */
export function Sparkline({
  values,
  cor = "var(--color-mint)",
  width = 96,
  height = 28,
}: {
  values: number[];
  cor?: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) {
    return <div style={{ width, height }} />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 3;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={d} fill="none" stroke={cor} strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={cor} />
    </svg>
  );
}
