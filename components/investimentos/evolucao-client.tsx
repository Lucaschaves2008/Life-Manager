"use client";

import { useState } from "react";
import { Segmented } from "@/components/caverna/segmented";
import { AreaEvolution, type AreaPoint } from "@/components/charts/area-evolution";
import { formatBRLCompact } from "@/lib/money";

type Periodo = "mes" | "ano" | "total";

/** Evolução patrimonial com seletor de janela. */
export function EvolucaoClient({
  series,
}: {
  series: Record<Periodo, AreaPoint[]>;
}) {
  const [periodo, setPeriodo] = useState<Periodo>("ano");
  const data = series[periodo];

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <p className="microlabel">Evolução do patrimônio</p>
        <Segmented
          options={[
            { label: "6 meses", value: "mes" },
            { label: "1 ano", value: "ano" },
            { label: "Total", value: "total" },
          ]}
          value={periodo}
          onChange={setPeriodo}
        />
      </div>
      <div className="mt-5">
        <AreaEvolution
          data={data}
          formatValue={(v) => formatBRLCompact(v)}
          nome="Patrimônio"
        />
      </div>
    </>
  );
}
