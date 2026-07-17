import type { Macros } from "@/lib/data/dieta";

function cor(pct: number): string {
  if (pct > 115) return "var(--color-coral)";
  if (pct >= 100) return "var(--color-amber)";
  return "var(--color-mint)";
}

/** Barras finas de P/C/G contra as metas da dieta ativa. */
export function MacroBars({
  consumido,
  metas,
}: {
  consumido: Macros;
  metas: Macros;
}) {
  const linhas = [
    { label: "Proteína", valor: consumido.prot, meta: metas.prot },
    { label: "Carboidrato", valor: consumido.carb, meta: metas.carb },
    { label: "Gordura", valor: consumido.gord, meta: metas.gord },
  ];

  return (
    <div className="flex flex-col gap-4">
      {linhas.map((linha) => {
        const pct = linha.meta > 0 ? (linha.valor / linha.meta) * 100 : 0;
        return (
          <div key={linha.label}>
            <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="text-mist">{linha.label}</span>
              <span className="tabular text-ice">
                {Math.round(linha.valor)}g / {linha.meta}g
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{
                  width: `${Math.min(100, pct)}%`,
                  background: cor(pct),
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
