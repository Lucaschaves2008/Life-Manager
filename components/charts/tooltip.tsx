"use client";

/**
 * Tooltip custom dos gráficos: fundo elevated, borda stroke, raio 12px,
 * valores formatados pelo chamador.
 */
export function ChartTooltip({
  active,
  label,
  rows,
}: {
  active?: boolean;
  label?: React.ReactNode;
  rows: { cor: string; nome: string; valor: string; dashed?: boolean }[];
}) {
  if (!active || rows.length === 0) return null;
  return (
    <div className="rounded-[12px] border border-stroke bg-elevated px-3.5 py-2.5 shadow-[0_16px_48px_rgba(0,0,0,.5)]">
      {label && <p className="microlabel mb-1.5 !text-[10px]">{label}</p>}
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <div key={row.nome} className="flex items-center gap-2 text-[12.5px]">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{
                background: row.dashed ? "transparent" : row.cor,
                border: row.dashed ? `1.5px dashed ${row.cor}` : undefined,
              }}
            />
            <span className="text-mist">{row.nome}</span>
            <span className="tabular ml-auto pl-4 font-medium text-ice">
              {row.valor}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
