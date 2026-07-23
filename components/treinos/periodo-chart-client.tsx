"use client";

import { useState } from "react";
import { Segmented } from "@/components/caverna/segmented";
import { PeriodoChart, type PeriodoPonto } from "@/components/treinos/corrida-charts";

export function PeriodoChartClient({
  meses,
  anos,
}: {
  meses: PeriodoPonto[];
  anos: PeriodoPonto[];
}) {
  const [periodo, setPeriodo] = useState<"mes" | "ano">("mes");

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="microlabel">Km por período</p>
        <Segmented
          options={[
            { label: "Mês", value: "mes" },
            { label: "Ano", value: "ano" },
          ]}
          value={periodo}
          onChange={setPeriodo}
        />
      </div>
      <div className="mt-5">
        <PeriodoChart data={periodo === "mes" ? meses : anos} />
      </div>
    </>
  );
}
