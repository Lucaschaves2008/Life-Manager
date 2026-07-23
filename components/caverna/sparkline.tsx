/** Mini-sparkline SVG (sem dependência): linha + área suave sob a curva. */
export function Sparkline({ serie, cor }: { serie: number[]; cor: string }) {
  const w = 100;
  const h = 28;
  if (serie.length < 2) {
    return (
      <div className="h-[28px] w-full rounded-full bg-surface-2">
        <div className="h-full rounded-full opacity-40" style={{ width: "100%", background: cor }} />
      </div>
    );
  }
  const min = Math.min(...serie);
  const max = Math.max(...serie);
  const span = max - min || 1;
  const step = w / (serie.length - 1);
  const pts = serie.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / span) * (h - 4) - 2;
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  const gid = `spark-${cor.replace(/[^a-z0-9]/gi, "")}`;
  const [lx, ly] = pts[pts.length - 1];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-[28px] w-full" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cor} stopOpacity={0.22} />
          <stop offset="100%" stopColor={cor} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline
        points={line}
        fill="none"
        stroke={cor}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lx} cy={ly} r={2} fill={cor} />
    </svg>
  );
}
