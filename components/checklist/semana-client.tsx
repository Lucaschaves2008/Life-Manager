"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import { EmptyState } from "@/components/caverna/empty-state";
import { TIPO_META } from "@/components/checklist/item-form";
import type { DiaSemanaMontado, RotinaPlanoView } from "@/lib/data/rotinas";
import { cn } from "@/lib/utils";

/**
 * A semana montada, de segunda a domingo, lado a lado.
 *
 * O checklist do dia mostra só hoje — e com plano alternativo, recorrência por
 * dia da semana e fim de semana diferente, era impossível conferir se a semana
 * inteira ficou como o planejado sem navegar dia a dia. Aqui cada coluna é um
 * dia real (com a data), ordenada por horário, e o seletor troca de plano sem
 * ida ao servidor: os itens de todos os planos já vêm carregados.
 */
export function SemanaMontada({
  dias,
  planos,
  planoAtivoId,
}: {
  dias: DiaSemanaMontado[];
  planos: RotinaPlanoView[];
  planoAtivoId: string | null;
}) {
  const [planoId, setPlanoId] = useState<string | null>(planoAtivoId);

  // Item "comum" (planoId=null) aparece em qualquer plano — é justamente o que
  // não muda entre o Plano A e o B.
  const diasFiltrados = useMemo(
    () =>
      dias.map((d) => ({
        ...d,
        itens: d.itens.filter((i) => i.planoId === null || i.planoId === planoId),
      })),
    [dias, planoId]
  );

  const total = diasFiltrados.reduce((s, d) => s + d.itens.length, 0);

  return (
    <div className="flex flex-col gap-4">
      {planos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="microlabel mr-1">Plano</span>
          {planos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlanoId(p.id)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors",
                planoId === p.id
                  ? "border-[rgba(13,110,253,.4)] bg-mint-soft text-mint"
                  : "border-stroke text-mist hover:border-[rgba(143,169,205,.22)]"
              )}
            >
              {p.nome}
              {p.padrao ? " · padrão" : ""}
            </button>
          ))}
        </div>
      )}

      {total === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarDays}
            title="Nada montado nesta semana"
            description={
              planos.length > 0
                ? "Nenhum item deste plano cai nos próximos dias. Troque de plano acima ou adicione itens no checklist."
                : "Adicione itens no checklist para ver a semana inteira aqui."
            }
            className="py-14"
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {diasFiltrados.map((d) => (
            <Card
              key={d.dayKey}
              destaque={d.hoje}
              className={cn("min-w-0", d.fimDeSemana && !d.hoje && "opacity-90")}
            >
              <div className="flex items-baseline justify-between gap-2">
                <CardLabel>{d.diaSemana}</CardLabel>
                <span className="tabular text-[11px] text-steel">{d.dataLabel}</span>
              </div>

              {d.itens.length === 0 ? (
                <p className="mt-3 text-[12px] text-steel/70">Dia livre</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {d.itens.map((i, idx) => (
                    <li
                      key={`${i.id}-${idx}`}
                      className="flex items-start gap-2 rounded-[10px] bg-surface-2 px-2.5 py-2"
                    >
                      <span className="tabular w-[38px] shrink-0 pt-[1px] text-[11px] text-steel">
                        {i.horaInicio ?? "—"}
                      </span>
                      <span className="shrink-0 text-[12px] leading-[1.35]">
                        {(TIPO_META[i.tipo] ?? TIPO_META.livre).emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] leading-[1.35] text-mist">{i.nome}</p>
                        {i.opcoes.length > 0 && (
                          <p className="truncate text-[10.5px] text-steel">
                            {i.opcoes.join(" ou ")}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-3 text-[11px] text-steel/70">
                {d.itens.length} {d.itens.length === 1 ? "item" : "itens"}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
