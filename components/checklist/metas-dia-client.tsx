"use client";

import { useEffect, useState } from "react";
import { Check, Plus, Target, Trash2 } from "lucide-react";
import { useAcao } from "@/lib/acao-cliente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardLabel } from "@/components/caverna/card";
import { criarMetaDia, excluirMetaDia, toggleMetaDia } from "@/app/actions/checklist";
import type { MetaDiaView, ResumoMetasDia } from "@/lib/data/checklist";
import { cn } from "@/lib/utils";

const PRIORIDADES = [
  { valor: 1, label: "Muito importante", curto: "Muito", cor: "text-coral", fundo: "bg-coral-soft" },
  { valor: 2, label: "Importante", curto: "Importante", cor: "text-amber", fundo: "bg-amber-soft" },
  { valor: 3, label: "Pouco importante", curto: "Pouco", cor: "text-mist", fundo: "bg-surface-2" },
] as const;

function prioridadeMeta(valor: number) {
  return PRIORIDADES.find((p) => p.valor === valor) ?? PRIORIDADES[1];
}

/**
 * Metas do dia: lista avulsa que vale só para hoje (não repete, não é rotina).
 * Cada meta carrega uma prioridade; a métrica mostra quantas foram cumpridas
 * hoje e na última semana.
 */
export function MetasDoDia({
  metas,
  resumo,
  dia,
}: {
  metas: MetaDiaView[];
  resumo: ResumoMetasDia;
  dia: string;
}) {
  const [, executar] = useAcao();
  const [lista, setLista] = useState(metas);
  const [titulo, setTitulo] = useState("");
  const [prioridade, setPrioridade] = useState(2);

  useEffect(() => setLista(metas), [metas]);

  const feitas = lista.filter((m) => m.feita).length;
  const pct = lista.length > 0 ? Math.round((feitas / lista.length) * 100) : 0;

  function adicionar() {
    const texto = titulo.trim();
    if (!texto) return;
    setTitulo("");
    executar(() => criarMetaDia(dia, texto, prioridade), {
      aoFalhar: () => setTitulo(texto),
    });
  }

  function alternar(id: string) {
    const anterior = lista;
    setLista((atuais) => atuais.map((m) => (m.id === id ? { ...m, feita: !m.feita } : m)));
    executar(() => toggleMetaDia(id), { aoFalhar: () => setLista(anterior) });
  }

  function remover(id: string) {
    const anterior = lista;
    setLista((atuais) => atuais.filter((m) => m.id !== id));
    executar(() => excluirMetaDia(id), { aoFalhar: () => setLista(anterior) });
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Target className="h-5 w-5 text-mist" strokeWidth={1.5} />
          <CardLabel>Metas do dia</CardLabel>
        </div>
        {lista.length > 0 && (
          <div className="flex items-baseline gap-2">
            <span className="display text-[22px] leading-none text-paper tabular">{pct}%</span>
            <span className="text-[12.5px] text-steel tabular">
              {feitas} de {lista.length} cumprida{lista.length === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </div>

      {lista.length > 0 && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-mint transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <form
        className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          adicionar();
        }}
      >
        <Input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="O que você precisa fazer hoje? Ex.: fechar o cliente X"
          maxLength={200}
        />
        <div className="flex items-center gap-2">
          <div className="flex shrink-0 rounded-full border border-stroke p-0.5">
            {PRIORIDADES.map((p) => (
              <button
                key={p.valor}
                type="button"
                onClick={() => setPrioridade(p.valor)}
                title={p.label}
                className={cn(
                  "cursor-pointer rounded-full px-2.5 py-1 text-[12px] transition-colors",
                  prioridade === p.valor ? cn(p.fundo, p.cor) : "text-steel hover:text-ice"
                )}
              >
                {p.curto}
              </button>
            ))}
          </div>
          <Button type="submit" variant="soft" size="sm" disabled={!titulo.trim()}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            Adicionar
          </Button>
        </div>
      </form>

      {lista.length === 0 ? (
        <p className="mt-4 text-[13px] text-steel">
          Nenhuma meta para hoje. Escreva o que precisa sair do papel, da mais importante para a
          menos.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-1.5">
          {lista.map((m) => {
            const p = prioridadeMeta(m.prioridade);
            return (
              <li
                key={m.id}
                className="group flex items-center gap-3 rounded-[14px] border border-stroke bg-surface-2/40 px-3 py-2.5"
              >
                <button
                  type="button"
                  onClick={() => alternar(m.id)}
                  aria-label={m.feita ? "Desmarcar meta" : "Marcar meta como cumprida"}
                  className={cn(
                    "flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors",
                    m.feita ? "border-mint bg-mint text-[var(--color-bg)]" : "border-stroke hover:border-mint"
                  )}
                >
                  {m.feita && <Check className="h-3 w-3" strokeWidth={2.5} />}
                </button>
                <span
                  className={cn(
                    "min-w-0 flex-1 text-[14px]",
                    m.feita ? "text-steel line-through" : "text-ice"
                  )}
                >
                  {m.titulo}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px]",
                    p.fundo,
                    p.cor,
                    m.feita && "opacity-60"
                  )}
                >
                  {p.label}
                </span>
                <button
                  type="button"
                  onClick={() => remover(m.id)}
                  aria-label="Excluir meta"
                  className="cursor-pointer text-steel opacity-0 transition-opacity hover:text-coral focus:opacity-100 group-hover:opacity-100 max-md:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {resumo.total > 0 && (
        <p className="mt-4 text-[12px] text-steel">
          Últimos 7 dias:{" "}
          <span className="tabular text-mist">
            {resumo.feitas} de {resumo.total} metas cumpridas ({resumo.pct}%)
          </span>
          {resumo.diasPerfeitos > 0 && (
            <>
              {" · "}
              <span className="tabular text-mist">
                {resumo.diasPerfeitos} {resumo.diasPerfeitos === 1 ? "dia" : "dias"} com tudo
                cumprido
              </span>
            </>
          )}
        </p>
      )}
    </div>
  );
}
