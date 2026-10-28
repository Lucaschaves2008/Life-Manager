import { TrendingDown, TrendingUp } from "lucide-react";
import type { DiaResumoRotina } from "@/lib/data/rotinas";
import { cn } from "@/lib/utils";

const ALTURA = 76;

function media(dias: DiaResumoRotina[]): number {
  return dias.length ? dias.reduce((s, d) => s + d.pct, 0) / dias.length : 0;
}

/**
 * Últimos 7 dias do checklist: barra por dia (altura = % concluído), linha da
 * meta de 100%, média da semana e comparação com os 7 dias anteriores — o
 * número que diz se você está subindo ou caindo, não só como foi cada dia.
 * Recebe 14 dias (os 7 mais recentes são exibidos, os 7 anteriores só servem
 * de base de comparação).
 */
export function UltimosDias({ dias, hojeKey }: { dias: DiaResumoRotina[]; hojeKey: string }) {
  const atual = dias.slice(-7);
  const anterior = dias.slice(-14, -7);
  const mediaAtual = media(atual);
  const delta = anterior.length ? mediaAtual - media(anterior) : null;
  const perfeitos = atual.filter((d) => d.total > 0 && d.pct >= 100).length;
  const subiu = delta !== null && delta >= 0;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="microlabel">Últimos 7 dias</p>
        {delta !== null && Math.abs(delta) >= 1 && (
          <span
            className={cn(
              "tabular inline-flex items-center gap-1 text-[11.5px]",
              subiu ? "text-mint" : "text-mist"
            )}
            title="Média desta semana comparada à dos 7 dias anteriores"
          >
            {subiu ? (
              <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.75} />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            {subiu ? "+" : "−"}
            {Math.round(Math.abs(delta))} pts
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="display text-[34px] leading-none text-paper">{Math.round(mediaAtual)}%</span>
        <span className="text-[13px] text-steel">de média</span>
      </div>

      <div className="relative mt-5" style={{ height: ALTURA }}>
        <div
          className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-stroke"
          aria-hidden
        />
        <div className="relative flex h-full items-end justify-between gap-1.5">
          {atual.map((d) => {
            const hoje = d.key === hojeKey;
            const cheio = d.pct >= 100;
            return (
              <div
                key={d.key}
                className="group relative flex h-full flex-1 items-end"
                title={`${d.dia}/${d.key.slice(5, 7)} · ${d.feitos} de ${d.total} · ${Math.round(d.pct)}%`}
              >
                <div
                  className={cn(
                    "w-full rounded-t-[4px] transition-all duration-500",
                    cheio ? "bg-mint" : hoje ? "bg-mint/60" : d.pct > 0 ? "bg-mist/50" : "bg-surface-2"
                  )}
                  style={{ height: `${Math.max(d.pct, 3)}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-1.5 flex justify-between gap-1.5">
        {atual.map((d) => (
          <div
            key={d.key}
            className={cn(
              "flex flex-1 flex-col items-center text-[10px] leading-tight",
              d.key === hojeKey ? "text-paper" : "text-steel"
            )}
          >
            <span className="uppercase">{d.label.slice(0, 3)}</span>
            <span className="tabular text-[10.5px]">{Math.round(d.pct)}</span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[12px] text-steel">
        <span className="tabular text-mist">{perfeitos}</span>{" "}
        {perfeitos === 1 ? "dia fechado" : "dias fechados"} em 100% nos últimos 7
      </p>
    </>
  );
}
