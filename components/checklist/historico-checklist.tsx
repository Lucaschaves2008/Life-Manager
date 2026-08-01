import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/caverna/empty-state";
import type { DiaRegistroView } from "@/lib/data/rotinas";

export function HistoricoChecklist({ registros }: { registros: DiaRegistroView[] }) {
  if (registros.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nenhum registro ainda"
        description="Feche um dia com 100% do checklist e escreva como foi — o histórico aparece aqui."
        className="py-14"
      />
    );
  }

  return (
    <div className="flex flex-col">
      {registros.map((r) => (
        <div key={r.id} className="flex gap-4 border-b border-stroke py-4 last:border-0">
          <div className="w-[76px] shrink-0">
            <p className="tabular text-[12.5px] text-steel">{r.diaLabel}</p>
            <p
              className={`mt-1 text-[13px] font-semibold ${
                r.pct >= 100 ? "text-mint" : "text-amber"
              }`}
            >
              {r.pct}%
            </p>
          </div>
          <p className="text-[13.5px] leading-relaxed text-mist">{r.descricao}</p>
        </div>
      ))}
    </div>
  );
}
