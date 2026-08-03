"use client";

import { useState } from "react";
import { Segmented } from "@/components/caverna/segmented";
import { VolumeChart, type PeriodoPonto } from "@/components/treinos/cardio-charts";
import { MODALIDADE, type ModalidadeCardio } from "@/lib/data/treinos-format";

export function PeriodoChartClient({
  meses,
  anos,
  modalidade,
}: {
  meses: PeriodoPonto[];
  anos: PeriodoPonto[];
  modalidade: ModalidadeCardio;
}) {
  const [periodo, setPeriodo] = useState<"mes" | "ano">("mes");
  const unidade = MODALIDADE[modalidade].unidade === "m" ? "Metros" : "Km";

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="microlabel">{unidade} por período</p>
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
        <VolumeChart
          data={periodo === "mes" ? meses : anos}
          modalidade={modalidade}
          rotulo="Distância"
          barra={32}
        />
      </div>
    </>
  );
}
