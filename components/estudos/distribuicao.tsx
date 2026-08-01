import { formatHoras } from "@/lib/data/estudos-format";
import type { BarraEstudo } from "@/lib/data/estudos";

/**
 * Distribuições do tópico. SVG/CSS puro (sem Recharts): são leituras de
 * padrão — "estudo mais na terça, quase sempre de manhã" — e não precisam de
 * tooltip nem de JS no cliente.
 */

/** Barras horizontais por dia da semana. */
export function PorDiaSemana({
  dados,
  cor,
}: {
  dados: BarraEstudo[];
  cor: string;
}) {
  const max = Math.max(1, ...dados.map((d) => d.segundos));
  return (
    <div className="flex flex-col gap-2.5">
      {dados.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-8 shrink-0 text-[11.5px] capitalize text-steel">
            {d.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(d.segundos / max) * 100}%`,
                background: d.segundos > 0 ? cor : "transparent",
                opacity: d.segundos === max ? 1 : 0.55,
              }}
            />
          </div>
          <span className="tabular w-[68px] shrink-0 text-right text-[11.5px] text-mist">
            {d.segundos > 0 ? formatHoras(d.segundos) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Colunas por hora de início da sessão (0h–23h). */
export function PorHora({ dados, cor }: { dados: BarraEstudo[]; cor: string }) {
  const max = Math.max(1, ...dados.map((d) => d.segundos));
  return (
    <div>
      <div className="flex h-[110px] items-end gap-[3px]">
        {dados.map((d, h) => (
          <div
            key={d.label}
            title={`${d.label} · ${formatHoras(d.segundos)}`}
            className="flex-1 rounded-[3px] transition-opacity"
            style={{
              height: `${Math.max(d.segundos > 0 ? 4 : 2, (d.segundos / max) * 100)}%`,
              background: d.segundos > 0 ? cor : "var(--color-surface-2)",
              opacity: d.segundos === 0 ? 1 : 0.45 + (d.segundos / max) * 0.55,
            }}
            aria-label={`${h}h: ${formatHoras(d.segundos)}`}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10.5px] text-steel">
        <span>00h</span>
        <span>06h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
    </div>
  );
}
