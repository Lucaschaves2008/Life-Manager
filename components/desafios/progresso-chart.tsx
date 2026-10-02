import { cn } from "@/lib/utils";

const W = 300;
const H = 56;
const PAD_Y = 4;

/**
 * Evolução de uma meta do desafio: % ACUMULADO ao longo do período (eixo X =
 * tempo do período inteiro, eixo Y = 0 → meta). A linha sólida vai do início
 * até hoje; a tracejada diagonal é o ritmo ideal (linear até 100% no fim) —
 * linha acima dela = adiantado, abaixo = atrasado. A escala Y é fixa em 0–100%
 * (cresce só se passar da meta), nunca normalizada por min/max: sem isso uma
 * variação minúscula parecia uma montanha.
 */
export function ProgressoChart({
  serie,
  decorrido,
  pct,
  cor,
  encerrado,
}: {
  serie: number[];
  decorrido: number;
  pct: number;
  cor: string;
  encerrado?: boolean;
}) {
  const topo = Math.max(100, ...serie);
  const y = (v: number) => H - PAD_Y - (Math.max(0, v) / topo) * (H - PAD_Y * 2);
  const xFim = Math.max(0.02, decorrido) * W;
  const pts = serie.map((v, i) => {
    const x = serie.length > 1 ? (i / (serie.length - 1)) * xFim : 0;
    return [x, y(v)] as const;
  });
  const line = pts.map(([x, py]) => `${x.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `0,${H - PAD_Y} ${line} ${xFim.toFixed(1)},${H - PAD_Y}`;
  const [lx, ly] = pts[pts.length - 1];
  const gid = `prog-${cor.replace(/[^a-z0-9]/gi, "")}`;

  const esperado = Math.min(100, decorrido * 100);
  const diff = pct - esperado;
  const noRitmo = diff >= -2;
  const texto = encerrado
    ? `Resultado final ${Math.round(pct)}%`
    : decorrido <= 0.01
      ? "Começando"
      : noRitmo
        ? `${Math.round(Math.max(diff, 0))} pts à frente do ritmo`
        : `${Math.round(-diff)} pts atrás do ritmo`;

  return (
    <div>
      <div className="relative h-[56px] w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity={0.2} />
              <stop offset="100%" stopColor={cor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <line
            x1={0}
            x2={W}
            y1={y(100)}
            y2={y(100)}
            stroke="var(--color-stroke)"
            strokeDasharray="2 4"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={0}
            y1={y(0)}
            x2={W}
            y2={y(100)}
            stroke="var(--color-steel)"
            strokeOpacity={0.45}
            strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />
          <polygon points={area} fill={`url(#${gid})`} />
          <polyline
            points={line}
            fill="none"
            stroke={cor}
            strokeWidth={1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          className="absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${(lx / W) * 100}%`, top: `${(ly / H) * 100}%`, background: cor }}
        />
      </div>
      <p className={cn("mt-1 text-[10.5px]", encerrado || noRitmo ? "text-steel" : "text-amber")}>{texto}</p>
    </div>
  );
}
