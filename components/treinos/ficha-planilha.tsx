"use client";

import { CalendarDays, Layers, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { formatDuracao } from "@/lib/data/treinos-format";
import type { ExercicioExec } from "@/components/treinos/execucao";

export type FichaPlanilhaInfo = {
  nome: string;
  foco?: string | null;
  semana: number;
  exercicios: ExercicioExec[];
};

/** Planilha somente-leitura de uma ficha de musculação — mesma exibição na Home e em Treinos. */
export function FichaPlanilha({
  ficha,
  hojeLabel,
  onOpenChange,
}: {
  ficha: FichaPlanilhaInfo | null;
  /** Data de hoje formatada; omitido quando a ficha é aberta fora do contexto "hoje". */
  hojeLabel?: string;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Sheet open={!!ficha} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>{ficha?.nome}</SheetTitle>
        <p className="mt-1 text-[12.5px] text-steel">
          Configuração desta semana — só consulta, nada aqui é salvo.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {hojeLabel && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-stroke bg-surface-2 px-2.5 py-1 text-[11px] text-mist">
              <CalendarDays className="h-3 w-3" strokeWidth={1.5} />
              {hojeLabel}
            </span>
          )}
          {ficha && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(13,110,253,.25)] bg-mint-soft px-2.5 py-1 text-[11px] font-medium text-mint">
              <Layers className="h-3 w-3" strokeWidth={1.5} />
              Periodização · Semana {ficha.semana}
            </span>
          )}
        </div>

        <div className="mt-6 flex flex-col">
          {!ficha || ficha.exercicios.length === 0 ? (
            <p className="py-3 text-[13px] text-steel">Nenhum exercício nesta ficha.</p>
          ) : (
            ficha.exercicios.map((ex, i) => (
              <div key={ex.id} className="flex gap-3 border-b border-stroke py-3.5 last:border-0">
                <span className="tabular mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-medium text-steel">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13.5px] text-paper">{ex.nome}</p>
                    {ex.metodo !== "Nenhum" && (
                      <span className="shrink-0 rounded-full bg-mint-soft px-2 py-0.5 text-[10.5px] font-medium text-mint">
                        {ex.metodo}
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-mist">{ex.grupoMuscular}</p>
                  <div className="tabular mt-2 flex flex-wrap gap-1.5">
                    {ex.tipoAlvo === "tempo" ? (
                      <Chip label="tempo" value={formatDuracao(ex.tempoAlvoSeg)} />
                    ) : (
                      <>
                        <Chip label="séries" value={`${ex.series}×${ex.repsAlvo}`} />
                        <Chip label="carga" value={`${ex.cargaAtual} kg`} />
                      </>
                    )}
                    <Chip label="descanso" value={`${ex.descansoSeg}s`} />
                  </div>
                  {ex.observacao && (
                    <p className="mt-2 text-[11.5px] text-steel">{ex.observacao}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            Fechar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[8px] border border-stroke bg-surface px-2 py-1 text-[11.5px] text-mist">
      <span className="text-steel">{label}</span>
      <span className="text-ice">{value}</span>
    </span>
  );
}
