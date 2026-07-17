"use client";

import { AreaEvolution, type AreaPoint } from "@/components/charts/area-evolution";
import { formatBRLCompact } from "@/lib/money";

export function HomePatrimonioChart({ data }: { data: AreaPoint[] }) {
  return (
    <AreaEvolution
      data={data}
      height={240}
      formatValue={(v) => formatBRLCompact(v)}
      nome="Patrimônio"
    />
  );
}
