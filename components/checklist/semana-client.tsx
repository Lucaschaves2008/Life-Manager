"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Card, CardLabel } from "@/components/caverna/card";
import { EmptyState } from "@/components/caverna/empty-state";
import { TIPO_META } from "@/components/checklist/item-form";
import type { DiaSemanaMontado, RotinaPlanoView } from "@/lib/data/rotinas";
import { cn } from "@/lib/utils";

/**
 * A semana montada, de segunda a domingo.
 *
 * O checklist do dia mostra só hoje — e com plano alternativo, recorrência por
 * dia da semana e fim de semana diferente, era impossível conferir se a semana
 * inteira ficou como o planejado sem navegar dia a dia. Aqui uma tira com os 7
 * dias (data + quantos itens) fica sempre visível — dá pra ver a semana
 * inteira de relance — e o dia escolhido abre embaixo com a mesma lista
 * legível do checklist de hoje. Antes disso era um grid de 7 colunas
 * espremendo cada nome em ~3 caracteres truncados; ficava ilegível.
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
  const hojeKey = diasFiltrados.find((d) => d.hoje)?.dayKey ?? diasFiltrados[0]?.dayKey ?? null;
  const [diaKey, setDiaKey] = useState<string | null>(hojeKey);
  const diaAtivo = diasFiltrados.find((d) => d.dayKey === diaKey) ?? diasFiltrados[0];

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
        <>
          <div className="grid grid-cols-7 gap-2">
            {diasFiltrados.map((d) => {
              const selecionado = d.dayKey === diaAtivo?.dayKey;
              return (
                <button
                  key={d.dayKey}
                  type="button"
                  onClick={() => setDiaKey(d.dayKey)}
                  aria-current={d.hoje ? "date" : undefined}
                  aria-pressed={selecionado}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-[14px] border py-2.5 text-center transition-colors",
                    selecionado
                      ? "border-[rgba(13,110,253,.4)] bg-mint-soft"
                      : "border-stroke bg-surface-2 hover:border-[rgba(143,169,205,.25)]"
                  )}
                >
                  <span className={cn("microlabel", selecionado ? "text-mint" : "text-steel")}>
                    {d.diaSemana.slice(0, 3)}
                  </span>
                  <span
                    className={cn(
                      "tabular text-[17px] leading-none",
                      selecionado ? "text-ice" : "text-mist"
                    )}
                  >
                    {d.dataLabel.slice(0, 2)}
                  </span>
                  <span
                    className={cn(
                      "h-1 w-1 rounded-full",
                      d.hoje ? "bg-mint" : "bg-transparent"
                    )}
                    aria-hidden="true"
                  />
                  <span className="text-[10.5px] text-steel">
                    {d.itens.length > 0 ? d.itens.length : "livre"}
                  </span>
                </button>
              );
            })}
          </div>

          <Card destaque={diaAtivo.hoje}>
            <div className="flex items-baseline justify-between gap-2">
              <CardLabel>
                {diaAtivo.diaSemana} · {diaAtivo.dataLabel}
                {diaAtivo.hoje ? " · hoje" : ""}
              </CardLabel>
              <span className="tabular text-[11px] text-steel">
                {diaAtivo.itens.length} {diaAtivo.itens.length === 1 ? "item" : "itens"}
              </span>
            </div>

            {diaAtivo.itens.length === 0 ? (
              <p className="mt-4 text-[13px] text-steel">Dia livre — nada montado.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {diaAtivo.itens.map((i, idx) => (
                  <li
                    key={`${i.id}-${idx}`}
                    className="flex items-center gap-3 rounded-[14px] border border-stroke bg-surface-2 px-4 py-3"
                  >
                    <span className="tabular w-11 shrink-0 text-[12.5px] text-steel">
                      {i.horaInicio ?? "—"}
                    </span>
                    <span className="text-[15px] leading-none">
                      {(TIPO_META[i.tipo] ?? TIPO_META.livre).emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] text-mist">{i.nome}</p>
                      {i.opcoes.length > 0 && (
                        <p className="mt-1 truncate text-[11px] text-steel">
                          {i.opcoes.join(" ou ")}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
